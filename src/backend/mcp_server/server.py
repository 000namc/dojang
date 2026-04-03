"""MCP Server for Dojang — Claude Code가 이 도구들을 사용해서 학습 시스템과 상호작용합니다."""

import json
import sqlite3
from pathlib import Path

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

import docker

DB_PATH = Path(__file__).parent.parent.parent.parent / "data" / "dojang.db"

server = Server("dojang")


def get_db() -> sqlite3.Connection:
    db = sqlite3.connect(str(DB_PATH))
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    return db


def get_docker() -> docker.DockerClient:
    return docker.from_env()


# --- Tool definitions ---

@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="get_curriculum",
            description="현재 도메인의 커리큘럼 트리를 가져옵니다. 토픽별 연습문제와 진행률이 포함됩니다.",
            inputSchema={
                "type": "object",
                "properties": {
                    "domain": {"type": "string", "description": "도메인 이름 (SQL 또는 Git)"},
                },
                "required": ["domain"],
            },
        ),
        Tool(
            name="create_exercise",
            description="새로운 연습 문제를 생성합니다. 학습자 수준에 맞춰 만들어주세요.",
            inputSchema={
                "type": "object",
                "properties": {
                    "topic_id": {"type": "integer", "description": "토픽 ID"},
                    "title": {"type": "string", "description": "문제 제목"},
                    "description": {"type": "string", "description": "문제 설명 (마크다운)"},
                    "initial_code": {"type": "string", "description": "에디터에 미리 채워질 코드", "default": ""},
                    "check_type": {
                        "type": "string",
                        "enum": ["output_match", "query_match", "script_check", "ai_check"],
                        "description": "정답 확인 방식: query_match(SQL결과비교), output_match(출력비교), script_check(스크립트검증), ai_check(AI평가)",
                    },
                    "check_value": {"type": "string", "description": "정답 확인용 쿼리/스크립트/예상출력", "default": ""},
                    "difficulty": {"type": "integer", "description": "난이도 1-5", "default": 1},
                },
                "required": ["topic_id", "title", "description", "check_type"],
            },
        ),
        Tool(
            name="add_topic",
            description="커리큘럼에 새로운 토픽을 추가합니다.",
            inputSchema={
                "type": "object",
                "properties": {
                    "domain": {"type": "string", "description": "도메인 이름 (SQL 또는 Git)"},
                    "name": {"type": "string", "description": "토픽 이름"},
                    "description": {"type": "string", "description": "토픽 설명", "default": ""},
                    "parent_id": {"type": "integer", "description": "상위 토픽 ID (하위 토픽으로 만들 때)"},
                },
                "required": ["domain", "name"],
            },
        ),
        Tool(
            name="update_topic",
            description="기존 토픽의 정보를 수정합니다.",
            inputSchema={
                "type": "object",
                "properties": {
                    "topic_id": {"type": "integer"},
                    "name": {"type": "string"},
                    "description": {"type": "string"},
                },
                "required": ["topic_id"],
            },
        ),
        Tool(
            name="get_progress",
            description="학습자의 도메인별 진행 현황을 가져옵니다. 토픽별 완료율, 총 시도 횟수 등.",
            inputSchema={
                "type": "object",
                "properties": {
                    "domain": {"type": "string", "description": "도메인 이름 (SQL 또는 Git)"},
                },
                "required": ["domain"],
            },
        ),
        Tool(
            name="execute_code",
            description="도메인 컨테이너에서 코드를 실행합니다. SQL이면 쿼리를, Git이면 bash 명령어를 실행합니다.",
            inputSchema={
                "type": "object",
                "properties": {
                    "domain": {"type": "string", "description": "도메인 이름 (SQL 또는 Git)"},
                    "code": {"type": "string", "description": "실행할 SQL 쿼리 또는 Git/bash 명령어"},
                    "repo": {"type": "string", "description": "Git 시나리오 이름 (basic, branching, conflict, rebase, history)", "default": "basic"},
                },
                "required": ["domain", "code"],
            },
        ),
        Tool(
            name="notify_ui",
            description="웹 UI에 변경 알림을 보냅니다. 커리큘럼이나 연습문제를 변경한 후 호출하세요.",
            inputSchema={
                "type": "object",
                "properties": {
                    "event": {"type": "string", "enum": ["curriculum_updated", "exercise_created", "knowledge_updated"], "description": "이벤트 타입"},
                },
                "required": ["event"],
            },
        ),
        Tool(
            name="save_knowledge",
            description="학습 중 발견한 중요한 개념이나 지식을 지식 카드로 저장합니다. 학습자가 '이거 저장해줘', '기억해둬' 등을 말하면 사용하세요.",
            inputSchema={
                "type": "object",
                "properties": {
                    "domain": {"type": "string", "description": "관련 도메인 이름 (CLI, Git, Docker, SQL 등). 범용 지식이면 생략."},
                    "topic_id": {"type": "integer", "description": "토픽 ID (커리큘럼 토픽에 연결할 때)"},
                    "title": {"type": "string", "description": "지식 카드 제목"},
                    "content": {"type": "string", "description": "핵심 내용 (마크다운)"},
                    "tags": {"type": "string", "description": "태그들 (쉼표 구분). 예: 'JOIN,SQL,기초'"},
                },
                "required": ["title", "content"],
            },
        ),
        Tool(
            name="list_knowledge",
            description="저장된 지식 카드 목록을 조회합니다.",
            inputSchema={
                "type": "object",
                "properties": {
                    "domain": {"type": "string", "description": "도메인으로 필터 (선택)"},
                    "query": {"type": "string", "description": "검색어 (선택)"},
                },
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    try:
        result = _handle_tool(name, arguments)
        return [TextContent(type="text", text=json.dumps(result, ensure_ascii=False, indent=2))]
    except Exception as e:
        return [TextContent(type="text", text=json.dumps({"error": str(e)}, ensure_ascii=False))]


def _handle_tool(name: str, args: dict) -> dict:
    if name == "get_curriculum":
        return _get_curriculum(args["domain"])
    elif name == "create_exercise":
        return _create_exercise(args)
    elif name == "add_topic":
        return _add_topic(args)
    elif name == "update_topic":
        return _update_topic(args)
    elif name == "get_progress":
        return _get_progress(args["domain"])
    elif name == "execute_code":
        return _execute_code(args)
    elif name == "notify_ui":
        return _notify_ui(args["event"])
    elif name == "save_knowledge":
        return _save_knowledge(args)
    elif name == "list_knowledge":
        return _list_knowledge(args)
    else:
        return {"error": f"Unknown tool: {name}"}


def _get_curriculum(domain_name: str) -> dict:
    db = get_db()
    try:
        domain = db.execute("SELECT * FROM domains WHERE name = ?", (domain_name,)).fetchone()
        if not domain:
            return {"error": f"Domain '{domain_name}' not found"}

        # Get default curriculum
        cur = db.execute(
            "SELECT id FROM curricula WHERE domain_id = ? AND is_default = 1", (domain["id"],)
        ).fetchone()
        if not cur:
            cur = db.execute(
                "SELECT id FROM curricula WHERE domain_id = ? ORDER BY id LIMIT 1", (domain["id"],)
            ).fetchone()
        if not cur:
            return {"domain": domain_name, "topics": []}

        topics = db.execute(
            "SELECT * FROM topics WHERE curriculum_id = ? ORDER BY order_num",
            (cur["id"],),
        ).fetchall()

        result_topics = []
        for t in topics:
            exercises = db.execute(
                "SELECT id, title, difficulty FROM exercises WHERE topic_id = ?",
                (t["id"],),
            ).fetchall()

            knowledge = db.execute(
                "SELECT id, title, tags FROM knowledge WHERE topic_id = ?",
                (t["id"],),
            ).fetchall()

            completed = db.execute(
                "SELECT DISTINCT exercise_id FROM attempts WHERE is_correct = 1 AND exercise_id IN "
                "(SELECT id FROM exercises WHERE topic_id = ?)",
                (t["id"],),
            ).fetchall()
            completed_ids = {r["exercise_id"] for r in completed}

            ex_list = [
                {"id": e["id"], "title": e["title"], "difficulty": e["difficulty"], "completed": e["id"] in completed_ids}
                for e in exercises
            ]
            kn_list = [
                {"id": k["id"], "title": k["title"], "tags": k["tags"]}
                for k in knowledge
            ]
            total = len(ex_list)
            done = sum(1 for e in ex_list if e["completed"])

            result_topics.append({
                "id": t["id"],
                "name": t["name"],
                "description": t["description"],
                "parent_id": t["parent_id"],
                "exercises": ex_list,
                "knowledge": kn_list,
                "progress": f"{done}/{total}" if total > 0 else "no exercises",
            })

        return {"domain": domain_name, "topics": result_topics}
    finally:
        db.close()


def _create_exercise(args: dict) -> dict:
    db = get_db()
    try:
        cursor = db.execute(
            "INSERT INTO exercises (topic_id, title, description, initial_code, check_type, check_value, difficulty, created_by) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, 'ai')",
            (
                args["topic_id"],
                args["title"],
                args.get("description", ""),
                args.get("initial_code", ""),
                args["check_type"],
                args.get("check_value", ""),
                args.get("difficulty", 1),
            ),
        )
        db.commit()
        _write_notify_file("curriculum_updated")
        return {"id": cursor.lastrowid, "title": args["title"], "status": "created"}
    finally:
        db.close()


def _add_topic(args: dict) -> dict:
    db = get_db()
    try:
        domain = db.execute("SELECT id FROM domains WHERE name = ?", (args["domain"],)).fetchone()
        if not domain:
            return {"error": f"Domain '{args['domain']}' not found"}

        # Find default curriculum for this domain
        cur = db.execute(
            "SELECT id FROM curricula WHERE domain_id = ? AND is_default = 1", (domain["id"],)
        ).fetchone()
        if not cur:
            cur = db.execute(
                "SELECT id FROM curricula WHERE domain_id = ? ORDER BY id LIMIT 1", (domain["id"],)
            ).fetchone()
        if not cur:
            return {"error": f"No curriculum found for domain '{args['domain']}'"}

        parent_id = args.get("parent_id")
        row = db.execute(
            "SELECT COALESCE(MAX(order_num), -1) + 1 as next_order FROM topics WHERE curriculum_id = ? AND parent_id IS ?",
            (cur["id"], parent_id),
        ).fetchone()

        cursor = db.execute(
            "INSERT INTO topics (curriculum_id, name, description, order_num, parent_id) VALUES (?, ?, ?, ?, ?)",
            (cur["id"], args["name"], args.get("description", ""), row["next_order"], parent_id),
        )
        db.commit()
        _write_notify_file("curriculum_updated")
        return {"id": cursor.lastrowid, "name": args["name"], "status": "created"}
    finally:
        db.close()


def _update_topic(args: dict) -> dict:
    db = get_db()
    try:
        updates = []
        values = []
        if "name" in args and args["name"]:
            updates.append("name = ?")
            values.append(args["name"])
        if "description" in args:
            updates.append("description = ?")
            values.append(args["description"])

        if not updates:
            return {"error": "No fields to update"}

        values.append(args["topic_id"])
        db.execute(f"UPDATE topics SET {', '.join(updates)} WHERE id = ?", values)
        db.commit()
        _write_notify_file("curriculum_updated")
        return {"status": "updated"}
    finally:
        db.close()


def _get_progress(domain_name: str) -> dict:
    db = get_db()
    try:
        domain = db.execute("SELECT id FROM domains WHERE name = ?", (domain_name,)).fetchone()
        if not domain:
            return {"error": f"Domain '{domain_name}' not found"}

        total_exercises = db.execute(
            "SELECT COUNT(*) as c FROM exercises WHERE topic_id IN (SELECT id FROM topics WHERE domain_id = ?)",
            (domain["id"],),
        ).fetchone()["c"]

        completed = db.execute(
            "SELECT COUNT(DISTINCT exercise_id) as c FROM attempts WHERE is_correct = 1 AND exercise_id IN "
            "(SELECT id FROM exercises WHERE topic_id IN (SELECT id FROM topics WHERE domain_id = ?))",
            (domain["id"],),
        ).fetchone()["c"]

        total_attempts = db.execute(
            "SELECT COUNT(*) as c FROM attempts WHERE exercise_id IN "
            "(SELECT id FROM exercises WHERE topic_id IN (SELECT id FROM topics WHERE domain_id = ?))",
            (domain["id"],),
        ).fetchone()["c"]

        return {
            "domain": domain_name,
            "total_exercises": total_exercises,
            "completed_exercises": completed,
            "total_attempts": total_attempts,
            "completion_rate": f"{completed}/{total_exercises}" if total_exercises > 0 else "0/0",
        }
    finally:
        db.close()


def _execute_code(args: dict) -> dict:
    domain_name = args["domain"]
    code = args["code"]

    db = get_db()
    try:
        domain = db.execute("SELECT * FROM domains WHERE name = ?", (domain_name,)).fetchone()
        if not domain:
            return {"error": f"Domain '{domain_name}' not found"}
        container_name = domain["container_name"]
    finally:
        db.close()

    client = get_docker()
    container = client.containers.get(container_name)

    if domain_name == "SQL":
        escaped = code.replace("\\", "\\\\").replace('"', '\\"').replace("$", "\\$")
        cmd = f'mysql -u root -pdojang practice -e "{escaped}" --batch --raw'
        exit_code, output = container.exec_run(cmd, demux=True)
        stdout = (output[0] or b"").decode() if isinstance(output, tuple) else (output or b"").decode()
        stderr = (output[1] or b"").decode() if isinstance(output, tuple) else ""

        if exit_code != 0:
            return {"error": stderr or stdout}

        lines = stdout.strip().split("\n") if stdout.strip() else []
        if not lines:
            return {"output": "Query OK (no results)"}

        # Format as readable table
        columns = lines[0].split("\t")
        rows = [line.split("\t") for line in lines[1:]]
        header = " | ".join(columns)
        separator = "-+-".join("-" * len(c) for c in columns)
        formatted_rows = [" | ".join(r) for r in rows]
        table = f"{header}\n{separator}\n" + "\n".join(formatted_rows)
        return {"output": table, "row_count": len(rows)}

    elif domain_name == "Git":
        repo = args.get("repo", "basic")
        cmd = ["bash", "-c", f"cd /repos/{repo} && {code}"]
        exit_code, output = container.exec_run(cmd, demux=True)
        stdout = (output[0] or b"").decode() if isinstance(output, tuple) else (output or b"").decode()
        stderr = (output[1] or b"").decode() if isinstance(output, tuple) else ""

        if exit_code != 0:
            return {"output": stdout, "error": stderr or stdout}
        return {"output": stdout}

    else:  # CLI, Docker
        cmd = ["bash", "-c", f"cd /workspace && {code}"]
        exit_code, output = container.exec_run(cmd, demux=True)
        stdout = (output[0] or b"").decode() if isinstance(output, tuple) else (output or b"").decode()
        stderr = (output[1] or b"").decode() if isinstance(output, tuple) else ""

        if exit_code != 0:
            return {"output": stdout, "error": stderr or stdout}
        return {"output": stdout}


NOTIFY_FILE = Path(__file__).parent.parent.parent.parent / "data" / ".notify"


def _write_notify_file(event: str) -> None:
    """Write a notification file that the web app polls for changes."""
    NOTIFY_FILE.parent.mkdir(parents=True, exist_ok=True)
    import time
    NOTIFY_FILE.write_text(json.dumps({"event": event, "ts": time.time()}))


def _notify_ui(event: str) -> dict:
    _write_notify_file(event)
    return {"status": "notified", "event": event}


def _save_knowledge(args: dict) -> dict:
    db = get_db()
    try:
        domain_id = None
        domain_name = args.get("domain")
        if domain_name:
            row = db.execute("SELECT id FROM domains WHERE name = ?", (domain_name,)).fetchone()
            if row:
                domain_id = row["id"]

        topic_id = args.get("topic_id")
        cursor = db.execute(
            "INSERT INTO knowledge (domain_id, topic_id, title, content, tags) VALUES (?, ?, ?, ?, ?)",
            (domain_id, topic_id, args["title"], args.get("content", ""), args.get("tags", "")),
        )
        db.commit()
        _write_notify_file("knowledge_updated")
        return {"id": cursor.lastrowid, "title": args["title"], "status": "saved"}
    finally:
        db.close()


def _list_knowledge(args: dict) -> dict:
    db = get_db()
    try:
        query = "SELECT k.id, k.title, k.tags, k.updated_at, d.name as domain FROM knowledge k LEFT JOIN domains d ON k.domain_id = d.id"
        params: list = []
        conditions = []

        domain_name = args.get("domain")
        if domain_name:
            conditions.append("d.name = ?")
            params.append(domain_name)

        search = args.get("query")
        if search:
            conditions.append("(k.title LIKE ? OR k.content LIKE ? OR k.tags LIKE ?)")
            params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])

        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += " ORDER BY k.updated_at DESC LIMIT 50"

        rows = db.execute(query, params).fetchall()
        return {"cards": [dict(r) for r in rows], "total": len(rows)}
    finally:
        db.close()


async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
