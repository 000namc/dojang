"""Sketch CRUD — workspace pages, each with its own Claude Code session."""
from fastapi import APIRouter, Depends, HTTPException

import aiosqlite

from src.backend.config import Settings, get_settings
from src.backend.database import get_connection
from src.backend.models import CreateSketchRequest, UpdateSketchRequest

router = APIRouter(prefix="/api", tags=["sketches"])


async def get_db(settings: Settings = Depends(get_settings)):
    db = await get_connection(settings.db_path)
    try:
        yield db
    finally:
        await db.close()


@router.get("/sketches")
async def list_sketches(db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        """
        SELECT id, title, claude_session_id, created_at, updated_at,
               substr(content, 1, 200) as preview
        FROM sketches
        ORDER BY datetime(updated_at) DESC, id DESC
        """
    )
    return [dict(r) for r in await cursor.fetchall()]


@router.get("/sketches/{sketch_id}")
async def get_sketch(sketch_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        "SELECT id, title, content, claude_session_id, created_at, updated_at FROM sketches WHERE id = ?",
        (sketch_id,),
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(404, "Sketch not found")
    return dict(row)


@router.post("/sketches")
async def create_sketch(req: CreateSketchRequest, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        "INSERT INTO sketches (title, content) VALUES (?, ?)",
        (req.title, req.content),
    )
    await db.commit()
    sid = cursor.lastrowid
    cursor = await db.execute(
        "SELECT id, title, content, claude_session_id, created_at, updated_at FROM sketches WHERE id = ?",
        (sid,),
    )
    row = await cursor.fetchone()
    return dict(row)


@router.patch("/sketches/{sketch_id}")
async def update_sketch(
    sketch_id: int,
    req: UpdateSketchRequest,
    db: aiosqlite.Connection = Depends(get_db),
):
    fields = []
    values: list = []
    if req.title is not None:
        fields.append("title = ?")
        values.append(req.title)
    if req.content is not None:
        fields.append("content = ?")
        values.append(req.content)
    if req.claude_session_id is not None:
        fields.append("claude_session_id = ?")
        values.append(req.claude_session_id)
    if not fields:
        return {"ok": True}
    fields.append("updated_at = CURRENT_TIMESTAMP")
    values.append(sketch_id)
    await db.execute(f"UPDATE sketches SET {', '.join(fields)} WHERE id = ?", values)
    await db.commit()
    return {"ok": True}


@router.delete("/sketches/{sketch_id}")
async def delete_sketch(sketch_id: int, db: aiosqlite.Connection = Depends(get_db)):
    await db.execute("DELETE FROM sketches WHERE id = ?", (sketch_id,))
    await db.commit()
    return {"ok": True}
