"""Cluster CRUD — 토픽을 묶는 그룹."""
from fastapi import APIRouter, Depends, HTTPException

import aiosqlite

from src.backend.config import Settings, get_settings
from src.backend.database import get_connection
from src.backend.models import CreateClusterRequest, UpdateClusterRequest

router = APIRouter(prefix="/api", tags=["clusters"])


async def get_db(settings: Settings = Depends(get_settings)):
    db = await get_connection(settings.db_path)
    try:
        yield db
    finally:
        await db.close()


@router.get("/clusters")
async def list_clusters(db: aiosqlite.Connection = Depends(get_db)):
    # 사용자가 reorder 할 수 있어야 하므로 is_default 가 아닌 order_num 우선 정렬
    cursor = await db.execute(
        "SELECT id, name, description, order_num, is_default, created_at FROM clusters ORDER BY order_num, id"
    )
    rows = [dict(r) for r in await cursor.fetchall()]
    # 각 cluster에 속한 topic 개수
    for r in rows:
        cur = await db.execute(
            "SELECT COUNT(*) as cnt FROM topics WHERE cluster_id = ?", (r["id"],)
        )
        r["topic_count"] = (await cur.fetchone())["cnt"]
    return rows


@router.post("/clusters")
async def create_cluster(req: CreateClusterRequest, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        "INSERT INTO clusters (name, description) VALUES (?, ?)",
        (req.name, req.description or ""),
    )
    await db.commit()
    return {"id": cursor.lastrowid, "name": req.name}


@router.patch("/clusters/{cluster_id}")
async def update_cluster(
    cluster_id: int,
    req: UpdateClusterRequest,
    db: aiosqlite.Connection = Depends(get_db),
):
    fields = []
    values: list = []
    if req.name is not None:
        fields.append("name = ?")
        values.append(req.name)
    if req.description is not None:
        fields.append("description = ?")
        values.append(req.description)
    if req.order_num is not None:
        fields.append("order_num = ?")
        values.append(req.order_num)
    if not fields:
        return {"ok": True}
    values.append(cluster_id)
    await db.execute(f"UPDATE clusters SET {', '.join(fields)} WHERE id = ?", values)
    await db.commit()
    return {"ok": True}


@router.post("/clusters/reorder")
async def reorder_clusters(
    body: dict,
    db: aiosqlite.Connection = Depends(get_db),
):
    """전체 cluster 순서를 한 번에 적용. body = {"ids": [3, 1, 2, ...]}.
    list 의 인덱스가 새 order_num 이 된다. 기본 cluster 도 위치 이동 가능하지만
    is_default DESC 정렬이 list_clusters 에 남아 있어 항상 위에 표시된다."""
    ids: list[int] = body.get("ids", [])
    for idx, cid in enumerate(ids):
        await db.execute(
            "UPDATE clusters SET order_num = ? WHERE id = ?", (idx, cid)
        )
    await db.commit()
    return {"ok": True}


@router.delete("/clusters/{cluster_id}")
async def delete_cluster(cluster_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cur = await db.execute(
        "SELECT is_default FROM clusters WHERE id = ?", (cluster_id,)
    )
    row = await cur.fetchone()
    if row is None:
        raise HTTPException(404, "Cluster not found")
    if row["is_default"]:
        raise HTTPException(400, "기본 cluster는 삭제할 수 없습니다")

    # 이 cluster에 속한 토픽들을 기본 cluster로 이동
    cur = await db.execute("SELECT id FROM clusters WHERE is_default = 1 LIMIT 1")
    default_row = await cur.fetchone()
    if default_row:
        await db.execute(
            "UPDATE topics SET cluster_id = ? WHERE cluster_id = ?",
            (default_row["id"], cluster_id),
        )

    await db.execute("DELETE FROM clusters WHERE id = ?", (cluster_id,))
    await db.commit()
    return {"ok": True}
