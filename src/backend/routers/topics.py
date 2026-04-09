from fastapi import APIRouter, Depends, HTTPException

import aiosqlite

from src.backend.config import Settings, get_settings
from src.backend.database import get_connection
from src.backend.models import CreateTopicRequest, UpdateTopicRequest

router = APIRouter(prefix="/api", tags=["topics"])


async def get_db(settings: Settings = Depends(get_settings)):
    db = await get_connection(settings.db_path)
    try:
        yield db
    finally:
        await db.close()


@router.get("/topics")
async def list_topics(db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        "SELECT id, name, description, container_name, cluster_id, default_curriculum_id FROM topics ORDER BY id"
    )
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


@router.get("/topics/{topic_id}")
async def get_topic(topic_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        "SELECT id, name, description, container_name, cluster_id, default_curriculum_id FROM topics WHERE id = ?",
        (topic_id,),
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(404, "Topic not found")
    return dict(row)


@router.post("/topics")
async def create_topic(req: CreateTopicRequest, db: aiosqlite.Connection = Depends(get_db)):
    # cluster_id 가 명시되어 있으면 거기에, 없으면 기본 cluster 에 할당
    if req.cluster_id is not None:
        cluster_id = req.cluster_id
    else:
        cur = await db.execute("SELECT id FROM clusters WHERE is_default = 1 LIMIT 1")
        default_row = await cur.fetchone()
        cluster_id = default_row["id"] if default_row else None

    cursor = await db.execute(
        "INSERT INTO topics (name, description, container_name, cluster_id) VALUES (?, ?, ?, ?)",
        (req.name, req.description, req.container_name, cluster_id),
    )
    await db.commit()
    return {"id": cursor.lastrowid, "name": req.name}


@router.put("/topics/{topic_id}")
async def update_topic(topic_id: int, req: UpdateTopicRequest, db: aiosqlite.Connection = Depends(get_db)):
    # default_curriculum_id 는 null 로 set 가능 (= 별자리에서 토픽 숨김).
    # "필드 자체가 absent" 와 "필드가 명시적으로 null" 을 구분하기 위해
    # Pydantic V2 의 model_fields_set 을 사용한다.
    fields_set = req.model_fields_set
    updates: list[str] = []
    values: list = []
    if "name" in fields_set and req.name is not None:
        updates.append("name = ?")
        values.append(req.name)
    if "description" in fields_set and req.description is not None:
        updates.append("description = ?")
        values.append(req.description)
    if "cluster_id" in fields_set and req.cluster_id is not None:
        updates.append("cluster_id = ?")
        values.append(req.cluster_id)
    if "default_curriculum_id" in fields_set:
        # null 도 명시적 unset 으로 받아들임
        updates.append("default_curriculum_id = ?")
        values.append(req.default_curriculum_id)

    if not updates:
        raise HTTPException(400, "No fields to update")

    values.append(topic_id)
    await db.execute(
        f"UPDATE topics SET {', '.join(updates)} WHERE id = ?", values
    )
    await db.commit()
    return {"ok": True}


@router.delete("/topics/{topic_id}")
async def delete_topic(topic_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT id FROM topics WHERE id = ?", (topic_id,))
    if not await cursor.fetchone():
        raise HTTPException(404, "Topic not found")

    # Collect all curriculum IDs for this topic
    cursor = await db.execute("SELECT id FROM curricula WHERE topic_id = ?", (topic_id,))
    curriculum_ids = [r["id"] for r in await cursor.fetchall()]

    if curriculum_ids:
        ph = ",".join("?" * len(curriculum_ids))
        # Collect subject IDs
        cursor = await db.execute(f"SELECT id FROM subjects WHERE curriculum_id IN ({ph})", curriculum_ids)
        subject_ids = [r["id"] for r in await cursor.fetchall()]

        if subject_ids:
            sph = ",".join("?" * len(subject_ids))
            await db.execute(f"DELETE FROM knowledge WHERE subject_id IN ({sph})", subject_ids)
            await db.execute(f"DELETE FROM exercises WHERE subject_id IN ({sph})", subject_ids)

        await db.execute(f"DELETE FROM subjects WHERE curriculum_id IN ({ph})", curriculum_ids)
        await db.execute(f"DELETE FROM checkpoints WHERE curriculum_id IN ({ph})", curriculum_ids)
        # topics.default_curriculum_id → curricula.id FK 가 걸려 있어서 curricula 를
        # 먼저 삭제하면 이 토픽의 default_curriculum_id 참조 때문에 실패한다.
        # 참조를 끊은 뒤 삭제.
        await db.execute(
            "UPDATE topics SET default_curriculum_id = NULL WHERE id = ?",
            (topic_id,),
        )
        await db.execute(f"DELETE FROM curricula WHERE topic_id = ?", (topic_id,))

    # Delete topic-level knowledge, notebooks, chat sessions/messages
    await db.execute("DELETE FROM knowledge WHERE topic_id = ?", (topic_id,))
    cursor = await db.execute("SELECT id FROM chat_sessions WHERE topic_id = ?", (topic_id,))
    session_ids = [r["id"] for r in await cursor.fetchall()]
    if session_ids:
        sph = ",".join("?" * len(session_ids))
        await db.execute(f"DELETE FROM chat_messages WHERE session_id IN ({sph})", session_ids)
    await db.execute("DELETE FROM chat_sessions WHERE topic_id = ?", (topic_id,))
    await db.execute("DELETE FROM notebooks WHERE topic_id = ?", (topic_id,))
    await db.execute("DELETE FROM topics WHERE id = ?", (topic_id,))
    await db.commit()
    return {"ok": True}


@router.get("/topics/{topic_id}/stats")
async def get_topic_stats(topic_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT COUNT(*) as cnt FROM curricula WHERE topic_id = ?", (topic_id,))
    curriculum_count = (await cursor.fetchone())["cnt"]

    cursor = await db.execute(
        "SELECT COUNT(*) as cnt FROM subjects WHERE curriculum_id IN (SELECT id FROM curricula WHERE topic_id = ?)",
        (topic_id,),
    )
    subject_count = (await cursor.fetchone())["cnt"]

    cursor = await db.execute(
        "SELECT COUNT(*) as cnt FROM exercises WHERE subject_id IN "
        "(SELECT id FROM subjects WHERE curriculum_id IN (SELECT id FROM curricula WHERE topic_id = ?))",
        (topic_id,),
    )
    exercise_count = (await cursor.fetchone())["cnt"]

    return {"curriculum_count": curriculum_count, "subject_count": subject_count, "exercise_count": exercise_count}
