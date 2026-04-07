import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import aiosqlite

from src.backend.config import Settings, get_settings
from src.backend.database import get_connection
from src.backend.models import CreateSubjectRequest, UpdateSubjectRequest

router = APIRouter(prefix="/api", tags=["curriculum"])


async def get_db(settings: Settings = Depends(get_settings)):
    db = await get_connection(settings.db_path)
    try:
        yield db
    finally:
        await db.close()


# --- Curricula CRUD ---

@router.get("/topics/{topic_id}/curricula")
async def list_curricula(topic_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        "SELECT id, topic_id, name, description, is_default, session_id FROM curricula WHERE topic_id = ? ORDER BY is_default DESC, id",
        (topic_id,),
    )
    return [dict(r) for r in await cursor.fetchall()]


class CreateCurriculumRequest(BaseModel):
    name: str
    description: str = ""


@router.post("/topics/{topic_id}/curricula")
async def create_curriculum(
    topic_id: int, req: CreateCurriculumRequest, db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute(
        "INSERT INTO curricula (topic_id, name, description) VALUES (?, ?, ?)",
        (topic_id, req.name, req.description),
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
    # Delete exercises → knowledge → checkpoints → subjects → curriculum
    await db.execute(
        "DELETE FROM exercises WHERE subject_id IN (SELECT id FROM subjects WHERE curriculum_id = ?)",
        (curriculum_id,),
    )
    await db.execute(
        "DELETE FROM knowledge WHERE subject_id IN (SELECT id FROM subjects WHERE curriculum_id = ?)",
        (curriculum_id,),
    )
    await db.execute("DELETE FROM checkpoints WHERE curriculum_id = ?", (curriculum_id,))
    await db.execute("DELETE FROM subjects WHERE curriculum_id = ?", (curriculum_id,))
    await db.execute("DELETE FROM curricula WHERE id = ?", (curriculum_id,))
    await db.commit()
    return {"ok": True}


# --- Curriculum Tree ---

@router.get("/curricula/{curriculum_id}/tree")
async def get_curriculum_tree(curriculum_id: int, db: aiosqlite.Connection = Depends(get_db)):
    # Curriculum + topic
    cursor = await db.execute(
        "SELECT c.*, t.name as topic_name, t.container_name "
        "FROM curricula c JOIN topics t ON c.topic_id = t.id WHERE c.id = ?",
        (curriculum_id,),
    )
    cur = await cursor.fetchone()
    if not cur:
        raise HTTPException(404, "Curriculum not found")

    # Subjects
    cursor = await db.execute(
        "SELECT id, curriculum_id, name, description, order_num, parent_id FROM subjects "
        "WHERE curriculum_id = ? ORDER BY order_num",
        (curriculum_id,),
    )
    subjects = [dict(r) for r in await cursor.fetchall()]

    # Exercises per subject
    subject_ids = [s["id"] for s in subjects]
    exercises_by_subject: dict[int, list] = {sid: [] for sid in subject_ids}
    if subject_ids:
        placeholders = ",".join("?" * len(subject_ids))
        cursor = await db.execute(
            f"SELECT id, subject_id, title, difficulty FROM exercises WHERE subject_id IN ({placeholders})",
            subject_ids,
        )
        for ex in await cursor.fetchall():
            exercises_by_subject[ex["subject_id"]].append(dict(ex))

    # Knowledge cards per subject
    knowledge_by_subject: dict[int, list] = {sid: [] for sid in subject_ids}
    if subject_ids:
        cursor = await db.execute(
            f"SELECT id, subject_id, title, tags, order_num FROM knowledge WHERE subject_id IN ({placeholders})",
            subject_ids,
        )
        for k in await cursor.fetchall():
            knowledge_by_subject[k["subject_id"]].append(dict(k))

    # Completed exercise IDs
    completed_ids: set[int] = set()
    if subject_ids:
        cursor = await db.execute(
            f"SELECT DISTINCT exercise_id FROM attempts WHERE is_correct = 1 "
            f"AND exercise_id IN (SELECT id FROM exercises WHERE subject_id IN ({placeholders}))",
            subject_ids,
        )
        completed_ids = {r["exercise_id"] for r in await cursor.fetchall()}

    def build_tree(parent_id: int | None) -> list:
        children = [s for s in subjects if s["parent_id"] == parent_id]
        result = []
        for s in children:
            exs = exercises_by_subject.get(s["id"], [])
            cards = knowledge_by_subject.get(s["id"], [])
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
                    **s,
                    "children": build_tree(s["id"]),
                    "exercises": ex_summaries,
                    "knowledge": card_summaries,
                    "items": items,
                    "progress": done / total if total > 0 else 0.0,
                }
            )
        return result

    return {
        "curriculum": dict(cur),
        "subjects": build_tree(None),
    }


# --- Subjects ---

@router.post("/subjects")
async def create_subject(req: CreateSubjectRequest, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        "SELECT COALESCE(MAX(order_num), -1) + 1 as next_order FROM subjects WHERE curriculum_id = ? AND parent_id IS ?",
        (req.curriculum_id, req.parent_id),
    )
    row = await cursor.fetchone()
    order_num = row["next_order"]

    cursor = await db.execute(
        "INSERT INTO subjects (curriculum_id, name, description, order_num, parent_id) VALUES (?, ?, ?, ?, ?)",
        (req.curriculum_id, req.name, req.description, order_num, req.parent_id),
    )
    await db.commit()
    return {"id": cursor.lastrowid, "name": req.name, "order_num": order_num}


@router.delete("/subjects/{subject_id}")
async def delete_subject(subject_id: int, db: aiosqlite.Connection = Depends(get_db)):
    # Recursively collect all child subject IDs
    all_ids = [subject_id]
    queue = [subject_id]
    while queue:
        parent = queue.pop()
        cursor = await db.execute("SELECT id FROM subjects WHERE parent_id = ?", (parent,))
        for row in await cursor.fetchall():
            all_ids.append(row["id"])
            queue.append(row["id"])
    placeholders = ",".join("?" * len(all_ids))
    await db.execute(f"DELETE FROM knowledge WHERE subject_id IN ({placeholders})", all_ids)
    await db.execute(f"DELETE FROM exercises WHERE subject_id IN ({placeholders})", all_ids)
    await db.execute(f"DELETE FROM subjects WHERE id IN ({placeholders})", all_ids)
    await db.commit()
    return {"ok": True}


@router.put("/subjects/{subject_id}")
async def update_subject(
    subject_id: int,
    req: UpdateSubjectRequest,
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

    values.append(subject_id)
    await db.execute(
        f"UPDATE subjects SET {', '.join(updates)} WHERE id = ?", values
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
    cursor = await db.execute("SELECT * FROM subjects WHERE curriculum_id = ?", (curriculum_id,))
    subjects = [dict(r) for r in await cursor.fetchall()]

    subject_ids = [s["id"] for s in subjects]
    exercises = []
    knowledge = []
    if subject_ids:
        ph = ",".join("?" * len(subject_ids))
        cursor = await db.execute(f"SELECT * FROM exercises WHERE subject_id IN ({ph})", subject_ids)
        exercises = [dict(r) for r in await cursor.fetchall()]
        cursor = await db.execute(f"SELECT * FROM knowledge WHERE subject_id IN ({ph})", subject_ids)
        knowledge = [dict(r) for r in await cursor.fetchall()]

    snapshot = json.dumps({"subjects": subjects, "exercises": exercises, "knowledge": knowledge}, ensure_ascii=False)
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
    cursor = await db.execute("SELECT id FROM subjects WHERE curriculum_id = ?", (curriculum_id,))
    old_subject_ids = [r["id"] for r in await cursor.fetchall()]
    if old_subject_ids:
        ph = ",".join("?" * len(old_subject_ids))
        await db.execute(f"DELETE FROM knowledge WHERE subject_id IN ({ph})", old_subject_ids)
        await db.execute(f"DELETE FROM exercises WHERE subject_id IN ({ph})", old_subject_ids)
    await db.execute("DELETE FROM subjects WHERE curriculum_id = ?", (curriculum_id,))

    # Restore with ID mapping
    # Support both old "topics" key and new "subjects" key for backwards compatibility
    subjects_data = data.get("subjects") or data.get("topics", [])
    id_map: dict[int, int] = {}
    for s in sorted(subjects_data, key=lambda x: x.get("order_num", 0)):
        old_id = s["id"]
        new_parent = id_map.get(s["parent_id"]) if s.get("parent_id") else None
        cursor = await db.execute(
            "INSERT INTO subjects (curriculum_id, name, description, order_num, parent_id) VALUES (?, ?, ?, ?, ?)",
            (curriculum_id, s["name"], s.get("description", ""), s.get("order_num", 0), new_parent),
        )
        id_map[old_id] = cursor.lastrowid

    for ex in data["exercises"]:
        new_subject_id = id_map.get(ex.get("subject_id") or ex.get("topic_id"))
        if not new_subject_id:
            continue
        await db.execute(
            "INSERT INTO exercises (subject_id, title, description, initial_code, check_type, check_value, difficulty, created_by) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (new_subject_id, ex["title"], ex.get("description", ""), ex.get("initial_code", ""),
             ex.get("check_type", "ai_check"), ex.get("check_value", ""), ex.get("difficulty", 1), ex.get("created_by", "system")),
        )

    for k in data["knowledge"]:
        new_subject_id = id_map.get(k.get("subject_id") or k.get("topic_id")) if (k.get("subject_id") or k.get("topic_id")) else None
        await db.execute(
            "INSERT INTO knowledge (subject_id, topic_id, title, content, tags, order_num) VALUES (?, ?, ?, ?, ?, ?)",
            (new_subject_id, k.get("topic_id") or k.get("domain_id"), k["title"], k.get("content", ""), k.get("tags", ""), k.get("order_num", 0)),
        )

    await db.commit()
    return {"ok": True}


@router.delete("/checkpoints/{checkpoint_id}")
async def delete_checkpoint(checkpoint_id: int, db: aiosqlite.Connection = Depends(get_db)):
    await db.execute("DELETE FROM checkpoints WHERE id = ?", (checkpoint_id,))
    await db.commit()
    return {"ok": True}
