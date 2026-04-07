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
    cursor = await db.execute("SELECT id, name, description, container_name FROM topics ORDER BY id")
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


@router.get("/topics/{topic_id}")
async def get_topic(topic_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        "SELECT id, name, description, container_name FROM topics WHERE id = ?",
        (topic_id,),
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(404, "Topic not found")
    return dict(row)


@router.post("/topics")
async def create_topic(req: CreateTopicRequest, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        "INSERT INTO topics (name, description, container_name) VALUES (?, ?, ?)",
        (req.name, req.description, req.container_name),
    )
    await db.commit()
    return {"id": cursor.lastrowid, "name": req.name}


@router.put("/topics/{topic_id}")
async def update_topic(topic_id: int, req: UpdateTopicRequest, db: aiosqlite.Connection = Depends(get_db)):
    updates = []
    values = []
    if req.name is not None:
        updates.append("name = ?")
        values.append(req.name)
    if req.description is not None:
        updates.append("description = ?")
        values.append(req.description)

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
