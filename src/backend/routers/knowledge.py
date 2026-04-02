from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import aiosqlite

from src.backend.config import Settings, get_settings
from src.backend.database import get_connection

router = APIRouter(prefix="/api", tags=["knowledge"])


async def get_db(settings: Settings = Depends(get_settings)):
    db = await get_connection(settings.db_path)
    try:
        yield db
    finally:
        await db.close()


class CreateKnowledgeRequest(BaseModel):
    domain_id: int | None = None
    title: str
    content: str = ""
    tags: str = ""


class UpdateKnowledgeRequest(BaseModel):
    title: str | None = None
    content: str | None = None
    tags: str | None = None
    domain_id: int | None = None


@router.get("/knowledge")
async def list_knowledge(
    domain_id: int | None = None,
    q: str | None = None,
    db: aiosqlite.Connection = Depends(get_db),
):
    query = "SELECT k.*, d.name as domain_name FROM knowledge k LEFT JOIN domains d ON k.domain_id = d.id"
    params: list = []
    conditions = []

    if domain_id:
        conditions.append("k.domain_id = ?")
        params.append(domain_id)
    if q:
        conditions.append("(k.title LIKE ? OR k.content LIKE ? OR k.tags LIKE ?)")
        params.extend([f"%{q}%", f"%{q}%", f"%{q}%"])

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY k.updated_at DESC"

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


@router.get("/knowledge/{knowledge_id}")
async def get_knowledge(knowledge_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        "SELECT k.*, d.name as domain_name FROM knowledge k LEFT JOIN domains d ON k.domain_id = d.id WHERE k.id = ?",
        (knowledge_id,),
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(404, "Knowledge not found")
    return dict(row)


@router.post("/knowledge")
async def create_knowledge(req: CreateKnowledgeRequest, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        "INSERT INTO knowledge (domain_id, title, content, tags) VALUES (?, ?, ?, ?)",
        (req.domain_id, req.title, req.content, req.tags),
    )
    await db.commit()
    return {"id": cursor.lastrowid, "title": req.title}


@router.put("/knowledge/{knowledge_id}")
async def update_knowledge(
    knowledge_id: int,
    req: UpdateKnowledgeRequest,
    db: aiosqlite.Connection = Depends(get_db),
):
    updates = []
    values = []
    for field in ("title", "content", "tags", "domain_id"):
        val = getattr(req, field, None)
        if val is not None:
            updates.append(f"{field} = ?")
            values.append(val)

    if not updates:
        raise HTTPException(400, "No fields to update")

    updates.append("updated_at = CURRENT_TIMESTAMP")
    values.append(knowledge_id)
    await db.execute(
        f"UPDATE knowledge SET {', '.join(updates)} WHERE id = ?", values
    )
    await db.commit()
    return {"ok": True}


@router.delete("/knowledge/{knowledge_id}")
async def delete_knowledge(knowledge_id: int, db: aiosqlite.Connection = Depends(get_db)):
    await db.execute("DELETE FROM knowledge WHERE id = ?", (knowledge_id,))
    await db.commit()
    return {"ok": True}
