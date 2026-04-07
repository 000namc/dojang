import json

from fastapi import APIRouter, Depends, HTTPException

import aiosqlite

from src.backend.config import Settings, get_settings
from src.backend.database import get_connection
from src.backend.models import ShareCurriculumRequest, ForkCurriculumRequest, UpvoteRequest

router = APIRouter(prefix="/api", tags=["community"])


async def get_db(settings: Settings = Depends(get_settings)):
    db = await get_connection(settings.db_path)
    try:
        yield db
    finally:
        await db.close()


@router.post("/community/share")
async def share_curriculum(req: ShareCurriculumRequest, db: aiosqlite.Connection = Depends(get_db)):
    # Verify curriculum exists
    cursor = await db.execute("SELECT id FROM curricula WHERE id = ?", (req.curriculum_id,))
    if not await cursor.fetchone():
        raise HTTPException(404, "Curriculum not found")

    # Build snapshot: subjects, exercises, knowledge
    cursor = await db.execute(
        "SELECT id, curriculum_id, name, description, order_num, parent_id FROM subjects WHERE curriculum_id = ? ORDER BY order_num",
        (req.curriculum_id,),
    )
    subjects = [dict(r) for r in await cursor.fetchall()]

    subject_ids = [s["id"] for s in subjects]
    exercises = []
    knowledge = []
    if subject_ids:
        ph = ",".join("?" * len(subject_ids))
        cursor = await db.execute(
            f"SELECT id, subject_id, title, description, initial_code, check_type, check_value, difficulty, ui_type, created_by "
            f"FROM exercises WHERE subject_id IN ({ph})",
            subject_ids,
        )
        exercises = [dict(r) for r in await cursor.fetchall()]
        cursor = await db.execute(
            f"SELECT id, subject_id, topic_id, title, content, tags, order_num "
            f"FROM knowledge WHERE subject_id IN ({ph})",
            subject_ids,
        )
        knowledge = [dict(r) for r in await cursor.fetchall()]

    snapshot = json.dumps({"subjects": subjects, "exercises": exercises, "knowledge": knowledge}, ensure_ascii=False)

    cursor = await db.execute(
        "INSERT INTO shared_curricula (curriculum_id, title, description, subject, tags, snapshot) VALUES (?, ?, ?, ?, ?, ?)",
        (req.curriculum_id, req.title, req.description, req.subject, req.tags, snapshot),
    )
    await db.commit()
    return {"id": cursor.lastrowid}


@router.get("/community")
async def list_shared(
    sort: str = "recent",
    q: str | None = None,
    page: int = 1,
    per_page: int = 20,
    db: aiosqlite.Connection = Depends(get_db),
):
    order_map = {
        "popular": "upvotes DESC",
        "recent": "shared_at DESC",
        "downloads": "downloads DESC",
    }
    order_clause = order_map.get(sort, "shared_at DESC")

    where_parts = []
    params: list = []
    if q:
        where_parts.append("(title LIKE ? OR description LIKE ? OR tags LIKE ? OR subject LIKE ?)")
        like = f"%{q}%"
        params.extend([like, like, like, like])

    where_sql = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""

    # Total count
    cursor = await db.execute(f"SELECT COUNT(*) as cnt FROM shared_curricula {where_sql}", params)
    total = (await cursor.fetchone())["cnt"]

    # Paginated items
    offset = (page - 1) * per_page
    cursor = await db.execute(
        f"SELECT id, user_id, curriculum_id, title, description, subject, tags, upvotes, downloads, shared_at "
        f"FROM shared_curricula {where_sql} ORDER BY {order_clause} LIMIT ? OFFSET ?",
        params + [per_page, offset],
    )
    items = [dict(r) for r in await cursor.fetchall()]

    return {"items": items, "total": total, "page": page}


@router.get("/community/{item_id}")
async def get_shared(item_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        "SELECT id, user_id, curriculum_id, title, description, subject, tags, snapshot, upvotes, downloads, shared_at "
        "FROM shared_curricula WHERE id = ?",
        (item_id,),
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(404, "Shared curriculum not found")
    return dict(row)


@router.post("/community/{item_id}/upvote")
async def toggle_upvote(item_id: int, req: UpvoteRequest, db: aiosqlite.Connection = Depends(get_db)):
    # Verify shared curriculum exists
    cursor = await db.execute("SELECT id, upvotes FROM shared_curricula WHERE id = ?", (item_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(404, "Shared curriculum not found")

    # Check if vote already exists
    cursor = await db.execute(
        "SELECT id FROM community_votes WHERE shared_curriculum_id = ? AND voter_id = ?",
        (item_id, req.voter_id),
    )
    existing = await cursor.fetchone()

    if existing:
        # Remove vote
        await db.execute("DELETE FROM community_votes WHERE id = ?", (existing["id"],))
        await db.execute("UPDATE shared_curricula SET upvotes = upvotes - 1 WHERE id = ?", (item_id,))
        await db.commit()
        cursor = await db.execute("SELECT upvotes FROM shared_curricula WHERE id = ?", (item_id,))
        new_count = (await cursor.fetchone())["upvotes"]
        return {"upvoted": False, "upvotes": new_count}
    else:
        # Add vote
        await db.execute(
            "INSERT INTO community_votes (shared_curriculum_id, voter_id) VALUES (?, ?)",
            (item_id, req.voter_id),
        )
        await db.execute("UPDATE shared_curricula SET upvotes = upvotes + 1 WHERE id = ?", (item_id,))
        await db.commit()
        cursor = await db.execute("SELECT upvotes FROM shared_curricula WHERE id = ?", (item_id,))
        new_count = (await cursor.fetchone())["upvotes"]
        return {"upvoted": True, "upvotes": new_count}


@router.post("/community/{item_id}/fork")
async def fork_curriculum(item_id: int, req: ForkCurriculumRequest, db: aiosqlite.Connection = Depends(get_db)):
    # Load shared curriculum
    cursor = await db.execute("SELECT id, title, snapshot FROM shared_curricula WHERE id = ?", (item_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(404, "Shared curriculum not found")

    # Verify target topic exists
    cursor = await db.execute("SELECT id FROM topics WHERE id = ?", (req.topic_id,))
    if not await cursor.fetchone():
        raise HTTPException(404, "Topic not found")

    data = json.loads(row["snapshot"])

    # Create new curriculum in target topic
    cursor = await db.execute(
        "INSERT INTO curricula (topic_id, name, description) VALUES (?, ?, ?)",
        (req.topic_id, f"[Fork] {row['title']}", ""),
    )
    curriculum_id = cursor.lastrowid

    # Rebuild subjects with ID mapping
    # Support both old "topics" key and new "subjects" key
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

    # Rebuild exercises
    for ex in data.get("exercises", []):
        new_subject_id = id_map.get(ex.get("subject_id") or ex.get("topic_id"))
        if not new_subject_id:
            continue
        await db.execute(
            "INSERT INTO exercises (subject_id, title, description, initial_code, check_type, check_value, difficulty, ui_type, created_by) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                new_subject_id, ex["title"], ex.get("description", ""), ex.get("initial_code", ""),
                ex.get("check_type", "ai_check"), ex.get("check_value", ""), ex.get("difficulty", 1),
                ex.get("ui_type", "auto"), ex.get("created_by", "system"),
            ),
        )

    # Rebuild knowledge
    for k in data.get("knowledge", []):
        new_subject_id = id_map.get(k.get("subject_id") or k.get("topic_id")) if (k.get("subject_id") or k.get("topic_id")) else None
        await db.execute(
            "INSERT INTO knowledge (subject_id, topic_id, title, content, tags, order_num) VALUES (?, ?, ?, ?, ?, ?)",
            (new_subject_id, req.topic_id, k["title"], k.get("content", ""), k.get("tags", ""), k.get("order_num", 0)),
        )

    # Increment downloads
    await db.execute("UPDATE shared_curricula SET downloads = downloads + 1 WHERE id = ?", (item_id,))
    await db.commit()

    return {"curriculum_id": curriculum_id}
