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
            ex_summaries = [
                {
                    "id": e["id"],
                    "title": e["title"],
                    "difficulty": e["difficulty"],
                    "is_completed": e["id"] in completed_ids,
                }
                for e in exs
            ]
            total = len(ex_summaries)
            done = sum(1 for e in ex_summaries if e["is_completed"])
            result.append(
                {
                    **t,
                    "children": build_tree(t["id"]),
                    "exercises": ex_summaries,
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
