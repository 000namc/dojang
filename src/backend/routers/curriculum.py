import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import aiosqlite

from src.backend.config import Settings, get_settings
from src.backend.database import get_connection
from src.backend.models import CreateTopicRequest, UpdateTopicRequest

router = APIRouter(prefix="/api", tags=["curriculum"])


async def get_db(settings: Settings = Depends(get_settings)):
    db = await get_connection(settings.db_path)
    try:
        yield db
    finally:
        await db.close()


# --- Curricula CRUD ---

@router.get("/domains/{domain_id}/curricula")
async def list_curricula(domain_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        "SELECT id, domain_id, name, description, is_default FROM curricula WHERE domain_id = ? ORDER BY is_default DESC, id",
        (domain_id,),
    )
    return [dict(r) for r in await cursor.fetchall()]


class CreateCurriculumRequest(BaseModel):
    name: str
    description: str = ""


@router.post("/domains/{domain_id}/curricula")
async def create_curriculum(
    domain_id: int, req: CreateCurriculumRequest, db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute(
        "INSERT INTO curricula (domain_id, name, description) VALUES (?, ?, ?)",
        (domain_id, req.name, req.description),
    )
    await db.commit()
    return {"id": cursor.lastrowid, "name": req.name}


@router.delete("/curricula/{curriculum_id}")
async def delete_curriculum(curriculum_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT is_default FROM curricula WHERE id = ?", (curriculum_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(404, "Curriculum not found")
    if row["is_default"]:
        raise HTTPException(400, "기본 커리큘럼은 삭제할 수 없습니다")
    # Delete exercises → topics → curriculum
    await db.execute(
        "DELETE FROM exercises WHERE topic_id IN (SELECT id FROM topics WHERE curriculum_id = ?)",
        (curriculum_id,),
    )
    await db.execute("DELETE FROM topics WHERE curriculum_id = ?", (curriculum_id,))
    await db.execute("DELETE FROM curricula WHERE id = ?", (curriculum_id,))
    await db.commit()
    return {"ok": True}


# --- Curriculum Tree ---

@router.get("/curricula/{curriculum_id}/tree")
async def get_curriculum_tree(curriculum_id: int, db: aiosqlite.Connection = Depends(get_db)):
    # Curriculum + domain
    cursor = await db.execute(
        "SELECT c.*, d.name as domain_name, d.container_name "
        "FROM curricula c JOIN domains d ON c.domain_id = d.id WHERE c.id = ?",
        (curriculum_id,),
    )
    cur = await cursor.fetchone()
    if not cur:
        raise HTTPException(404, "Curriculum not found")

    # Topics
    cursor = await db.execute(
        "SELECT id, curriculum_id, name, description, order_num, parent_id FROM topics "
        "WHERE curriculum_id = ? ORDER BY order_num",
        (curriculum_id,),
    )
    topics = [dict(r) for r in await cursor.fetchall()]

    # Exercises per topic
    topic_ids = [t["id"] for t in topics]
    exercises_by_topic: dict[int, list] = {tid: [] for tid in topic_ids}
    if topic_ids:
        placeholders = ",".join("?" * len(topic_ids))
        cursor = await db.execute(
            f"SELECT id, topic_id, title, difficulty FROM exercises WHERE topic_id IN ({placeholders})",
            topic_ids,
        )
        for ex in await cursor.fetchall():
            exercises_by_topic[ex["topic_id"]].append(dict(ex))

    # Knowledge cards per topic
    knowledge_by_topic: dict[int, list] = {tid: [] for tid in topic_ids}
    if topic_ids:
        cursor = await db.execute(
            f"SELECT id, topic_id, title, tags, order_num FROM knowledge WHERE topic_id IN ({placeholders})",
            topic_ids,
        )
        for k in await cursor.fetchall():
            knowledge_by_topic[k["topic_id"]].append(dict(k))

    # Completed exercise IDs
    completed_ids: set[int] = set()
    if topic_ids:
        cursor = await db.execute(
            f"SELECT DISTINCT exercise_id FROM attempts WHERE is_correct = 1 "
            f"AND exercise_id IN (SELECT id FROM exercises WHERE topic_id IN ({placeholders}))",
            topic_ids,
        )
        completed_ids = {r["exercise_id"] for r in await cursor.fetchall()}

    def build_tree(parent_id: int | None) -> list:
        children = [t for t in topics if t["parent_id"] == parent_id]
        result = []
        for t in children:
            exs = exercises_by_topic.get(t["id"], [])
            cards = knowledge_by_topic.get(t["id"], [])
            ex_summaries = [
                {
                    "id": e["id"],
                    "title": e["title"],
                    "difficulty": e["difficulty"],
                    "is_completed": e["id"] in completed_ids,
                    "type": "exercise",
                    "order_num": 1000 + i,
                }
                for i, e in enumerate(exs)
            ]
            card_summaries = [
                {
                    "id": c["id"],
                    "title": c["title"],
                    "tags": c.get("tags", ""),
                    "type": "knowledge",
                    "order_num": c.get("order_num", 0),
                }
                for c in cards
            ]
            items = sorted(card_summaries + ex_summaries, key=lambda x: x["order_num"])
            total = len(ex_summaries)
            done = sum(1 for e in ex_summaries if e["is_completed"])
            result.append(
                {
                    **t,
                    "children": build_tree(t["id"]),
                    "exercises": ex_summaries,
                    "knowledge": card_summaries,
                    "items": items,
                    "progress": done / total if total > 0 else 0.0,
                }
            )
        return result

    return {
        "curriculum": dict(cur),
        "topics": build_tree(None),
    }


# --- Topics ---

@router.post("/topics")
async def create_topic(req: CreateTopicRequest, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        "SELECT COALESCE(MAX(order_num), -1) + 1 as next_order FROM topics WHERE curriculum_id = ? AND parent_id IS ?",
        (req.curriculum_id, req.parent_id),
    )
    row = await cursor.fetchone()
    order_num = row["next_order"]

    cursor = await db.execute(
        "INSERT INTO topics (curriculum_id, name, description, order_num, parent_id) VALUES (?, ?, ?, ?, ?)",
        (req.curriculum_id, req.name, req.description, order_num, req.parent_id),
    )
    await db.commit()
    return {"id": cursor.lastrowid, "name": req.name, "order_num": order_num}


@router.delete("/topics/{topic_id}")
async def delete_topic(topic_id: int, db: aiosqlite.Connection = Depends(get_db)):
    # Recursively collect all child topic IDs
    all_ids = [topic_id]
    queue = [topic_id]
    while queue:
        parent = queue.pop()
        cursor = await db.execute("SELECT id FROM topics WHERE parent_id = ?", (parent,))
        for row in await cursor.fetchall():
            all_ids.append(row["id"])
            queue.append(row["id"])
    placeholders = ",".join("?" * len(all_ids))
    await db.execute(f"DELETE FROM knowledge WHERE topic_id IN ({placeholders})", all_ids)
    await db.execute(f"DELETE FROM exercises WHERE topic_id IN ({placeholders})", all_ids)
    await db.execute(f"DELETE FROM topics WHERE id IN ({placeholders})", all_ids)
    await db.commit()
    return {"ok": True}


@router.put("/topics/{topic_id}")
async def update_topic(
    topic_id: int,
    req: UpdateTopicRequest,
    db: aiosqlite.Connection = Depends(get_db),
):
    updates = []
    values = []
    if req.name is not None:
        updates.append("name = ?")
        values.append(req.name)
    if req.description is not None:
        updates.append("description = ?")
        values.append(req.description)
    if req.order_num is not None:
        updates.append("order_num = ?")
        values.append(req.order_num)

    if not updates:
        raise HTTPException(400, "No fields to update")

    values.append(topic_id)
    await db.execute(
        f"UPDATE topics SET {', '.join(updates)} WHERE id = ?", values
    )
    await db.commit()
    return {"ok": True}


# --- Checkpoints ---

class CreateCheckpointRequest(BaseModel):
    name: str = ""


@router.get("/curricula/{curriculum_id}/checkpoints")
async def list_checkpoints(curriculum_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        "SELECT id, curriculum_id, name, created_at FROM checkpoints WHERE curriculum_id = ? ORDER BY id DESC",
        (curriculum_id,),
    )
    return [dict(r) for r in await cursor.fetchall()]


@router.post("/curricula/{curriculum_id}/checkpoints")
async def create_checkpoint(curriculum_id: int, req: CreateCheckpointRequest, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT * FROM topics WHERE curriculum_id = ?", (curriculum_id,))
    topics = [dict(r) for r in await cursor.fetchall()]

    topic_ids = [t["id"] for t in topics]
    exercises = []
    knowledge = []
    if topic_ids:
        ph = ",".join("?" * len(topic_ids))
        cursor = await db.execute(f"SELECT * FROM exercises WHERE topic_id IN ({ph})", topic_ids)
        exercises = [dict(r) for r in await cursor.fetchall()]
        cursor = await db.execute(f"SELECT * FROM knowledge WHERE topic_id IN ({ph})", topic_ids)
        knowledge = [dict(r) for r in await cursor.fetchall()]

    snapshot = json.dumps({"topics": topics, "exercises": exercises, "knowledge": knowledge}, ensure_ascii=False)
    name = req.name or datetime.now().strftime("%Y-%m-%d %H:%M")

    cursor = await db.execute(
        "INSERT INTO checkpoints (curriculum_id, name, snapshot) VALUES (?, ?, ?)",
        (curriculum_id, name, snapshot),
    )
    await db.commit()
    return {"id": cursor.lastrowid, "name": name}


@router.post("/checkpoints/{checkpoint_id}/restore")
async def restore_checkpoint(checkpoint_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT * FROM checkpoints WHERE id = ?", (checkpoint_id,))
    cp = await cursor.fetchone()
    if not cp:
        raise HTTPException(404, "Checkpoint not found")

    data = json.loads(cp["snapshot"])
    curriculum_id = cp["curriculum_id"]

    # Delete current data
    cursor = await db.execute("SELECT id FROM topics WHERE curriculum_id = ?", (curriculum_id,))
    old_topic_ids = [r["id"] for r in await cursor.fetchall()]
    if old_topic_ids:
        ph = ",".join("?" * len(old_topic_ids))
        await db.execute(f"DELETE FROM knowledge WHERE topic_id IN ({ph})", old_topic_ids)
        await db.execute(f"DELETE FROM exercises WHERE topic_id IN ({ph})", old_topic_ids)
    await db.execute("DELETE FROM topics WHERE curriculum_id = ?", (curriculum_id,))

    # Restore with ID mapping
    id_map: dict[int, int] = {}
    for t in sorted(data["topics"], key=lambda x: x.get("order_num", 0)):
        old_id = t["id"]
        new_parent = id_map.get(t["parent_id"]) if t.get("parent_id") else None
        cursor = await db.execute(
            "INSERT INTO topics (curriculum_id, name, description, order_num, parent_id) VALUES (?, ?, ?, ?, ?)",
            (curriculum_id, t["name"], t.get("description", ""), t.get("order_num", 0), new_parent),
        )
        id_map[old_id] = cursor.lastrowid

    for ex in data["exercises"]:
        new_topic_id = id_map.get(ex["topic_id"])
        if not new_topic_id:
            continue
        await db.execute(
            "INSERT INTO exercises (topic_id, title, description, initial_code, check_type, check_value, difficulty, created_by) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (new_topic_id, ex["title"], ex.get("description", ""), ex.get("initial_code", ""),
             ex.get("check_type", "ai_check"), ex.get("check_value", ""), ex.get("difficulty", 1), ex.get("created_by", "system")),
        )

    for k in data["knowledge"]:
        new_topic_id = id_map.get(k["topic_id"]) if k.get("topic_id") else None
        await db.execute(
            "INSERT INTO knowledge (topic_id, domain_id, title, content, tags, order_num) VALUES (?, ?, ?, ?, ?, ?)",
            (new_topic_id, k.get("domain_id"), k["title"], k.get("content", ""), k.get("tags", ""), k.get("order_num", 0)),
        )

    await db.commit()
    return {"ok": True}


@router.delete("/checkpoints/{checkpoint_id}")
async def delete_checkpoint(checkpoint_id: int, db: aiosqlite.Connection = Depends(get_db)):
    await db.execute("DELETE FROM checkpoints WHERE id = ?", (checkpoint_id,))
    await db.commit()
    return {"ok": True}
