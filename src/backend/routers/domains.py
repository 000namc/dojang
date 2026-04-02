from fastapi import APIRouter, Depends

import aiosqlite

from src.backend.config import Settings, get_settings
from src.backend.database import get_connection

router = APIRouter(prefix="/api", tags=["domains"])


async def get_db(settings: Settings = Depends(get_settings)):
    db = await get_connection(settings.db_path)
    try:
        yield db
    finally:
        await db.close()


@router.get("/domains")
async def list_domains(db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT id, name, description, container_name FROM domains ORDER BY id")
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


@router.get("/domains/{domain_id}")
async def get_domain(domain_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        "SELECT id, name, description, container_name FROM domains WHERE id = ?",
        (domain_id,),
    )
    row = await cursor.fetchone()
    if not row:
        from fastapi import HTTPException
        raise HTTPException(404, "Domain not found")
    return dict(row)
