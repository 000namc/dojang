"""Chat router — 세션 기반 학습 대화 엔드포인트."""

import json

import aiosqlite
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from src.backend.config import get_settings
from src.backend.models import ChatRequest
from src.backend.services.chat_engine import build_system_prompt, stream_chat

router = APIRouter(prefix="/api", tags=["chat"])


async def _get_db():
    settings = get_settings()
    db = await aiosqlite.connect(settings.db_path)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA foreign_keys=ON")
    return db


async def _get_topic_name(db: aiosqlite.Connection, topic_id: int) -> str | None:
    row = await db.execute_fetchall("SELECT name FROM topics WHERE id = ?", (topic_id,))
    return row[0]["name"] if row else None


# ---------------------------------------------------------------------------
# Session CRUD
# ---------------------------------------------------------------------------


class CreateSessionRequest(BaseModel):
    topic_id: int


@router.post("/chat/sessions")
async def create_session(req: CreateSessionRequest):
    db = await _get_db()
    try:
        cursor = await db.execute(
            "INSERT INTO chat_sessions (topic_id, title) VALUES (?, '')",
            (req.topic_id,),
        )
        await db.commit()
        return {"id": cursor.lastrowid, "topic_id": req.topic_id, "title": "", "created_at": None}
    finally:
        await db.close()


@router.get("/chat/sessions")
async def list_sessions(topic_id: int):
    db = await _get_db()
    try:
        rows = await db.execute_fetchall(
            "SELECT id, topic_id, title, created_at FROM chat_sessions WHERE topic_id = ? ORDER BY id DESC",
            (topic_id,),
        )
        return [dict(r) for r in rows]
    finally:
        await db.close()


@router.delete("/chat/sessions/{session_id}")
async def delete_session(session_id: int):
    db = await _get_db()
    try:
        await db.execute("DELETE FROM chat_messages WHERE session_id = ?", (session_id,))
        await db.execute("DELETE FROM chat_sessions WHERE id = ?", (session_id,))
        await db.commit()
        return {"status": "deleted"}
    finally:
        await db.close()


# ---------------------------------------------------------------------------
# Chat (session-based)
# ---------------------------------------------------------------------------


@router.post("/chat")
async def chat(req: ChatRequest):
    settings = get_settings()
    db = await _get_db()

    try:
        session_id = req.session_id
        topic_id = req.topic_id

        # session_id가 없으면 topic_id로 자동 세션 생성
        if not session_id:
            if not topic_id:
                return {"error": "session_id or topic_id is required"}
            cursor = await db.execute(
                "INSERT INTO chat_sessions (topic_id, title) VALUES (?, '')",
                (topic_id,),
            )
            await db.commit()
            session_id = cursor.lastrowid
        else:
            # 세션에서 topic_id 가져오기
            session = await db.execute_fetchall(
                "SELECT topic_id FROM chat_sessions WHERE id = ?", (session_id,)
            )
            if not session:
                return {"error": f"Session {session_id} not found"}
            topic_id = session[0]["topic_id"]
        topic_name = await _get_topic_name(db, topic_id)
        if not topic_name:
            return {"error": f"Topic {topic_id} not found"}

        # Load recent history for this session
        rows = await db.execute_fetchall(
            "SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY id DESC LIMIT 50",
            (session_id,),
        )
        messages = [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]
        messages.append({"role": "user", "content": req.message})

        # Save user message
        await db.execute(
            "INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)",
            (session_id, "user", req.message),
        )

        # Auto-set session title from first message
        if not rows:
            title = req.message[:50]
            await db.execute(
                "UPDATE chat_sessions SET title = ? WHERE id = ?",
                (title, session_id),
            )

        await db.commit()

        # Build system prompt with context
        context = req.context.model_dump() if req.context else None
        system_prompt = build_system_prompt(topic_name, context)

        async def generate():
            # 첫 이벤트로 session_id 전달
            yield f"event: session\ndata: {json.dumps({'session_id': session_id})}\n\n"
            full_text = ""
            created_curriculum_ids: list[int] = []
            try:
                async for event in stream_chat(messages, system_prompt, settings):
                    yield event
                    if event.startswith("event: done"):
                        data_line = event.split("\ndata: ", 1)[1].split("\n")[0]
                        full_text = json.loads(data_line).get("full_text", "")
                    # create_curriculum 결과에서 curriculum_id 추출
                    elif event.startswith("event: tool_result"):
                        try:
                            data_line = event.split("\ndata: ", 1)[1].split("\n")[0]
                            tr = json.loads(data_line)
                            content = json.loads(tr.get("content", "{}"))
                            if content.get("status") == "created" and "topic" in content:
                                created_curriculum_ids.append(content["id"])
                        except (json.JSONDecodeError, KeyError):
                            pass
            finally:
                db2 = await _get_db()
                try:
                    if full_text:
                        await db2.execute(
                            "INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)",
                            (session_id, "assistant", full_text),
                        )
                    # 생성된 커리큘럼에 session_id 연결
                    for cur_id in created_curriculum_ids:
                        await db2.execute(
                            "UPDATE curricula SET session_id = ? WHERE id = ?",
                            (session_id, cur_id),
                        )
                    await db2.commit()
                finally:
                    await db2.close()

        return StreamingResponse(generate(), media_type="text/event-stream")
    finally:
        await db.close()


@router.get("/chat/history")
async def chat_history(session_id: int | None = None, topic_id: int | None = None):
    db = await _get_db()
    try:
        if session_id:
            rows = await db.execute_fetchall(
                "SELECT id, role, content, created_at FROM chat_messages WHERE session_id = ? ORDER BY id DESC LIMIT 50",
                (session_id,),
            )
        elif topic_id:
            # 하위 호환: topic_id의 최신 세션에서 가져오기
            latest = await db.execute_fetchall(
                "SELECT id FROM chat_sessions WHERE topic_id = ? ORDER BY id DESC LIMIT 1",
                (topic_id,),
            )
            if not latest:
                return []
            rows = await db.execute_fetchall(
                "SELECT id, role, content, created_at FROM chat_messages WHERE session_id = ? ORDER BY id DESC LIMIT 50",
                (latest[0]["id"],),
            )
        else:
            return []
        return [dict(r) for r in reversed(rows)]
    finally:
        await db.close()
