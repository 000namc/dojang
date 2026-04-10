"""도구 레지스트리 — Claude Code 세션이 MCP를 통해 호출하는 도구들."""

import json
import sqlite3
import time
from collections.abc import Callable
from pathlib import Path

import docker
from mcp.types import Tool

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

DB_PATH = Path(__file__).parent.parent.parent / "data" / "dojang.db"
NOTIFY_FILE = Path(__file__).parent.parent.parent / "data" / ".notify"


def get_db() -> sqlite3.Connection:
    db = sqlite3.connect(str(DB_PATH))
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    return db


def get_docker() -> docker.DockerClient:
    return docker.from_env()


def _write_notify_file(event: str) -> None:
    NOTIFY_FILE.parent.mkdir(parents=True, exist_ok=True)
    NOTIFY_FILE.write_text(json.dumps({"event": event, "ts": time.time()}))


# ---------------------------------------------------------------------------
# Tool implementations
# ---------------------------------------------------------------------------


def _get_curriculum(args: dict) -> dict:
    topic_name = args["topic"]
    db = get_db()
    try:
        topic = db.execute("SELECT * FROM topics WHERE name = ?", (topic_name,)).fetchone()
        if not topic:
            return {"error": f"Topic '{topic_name}' not found"}

        cur = db.execute(
            "SELECT id FROM curricula WHERE topic_id = ? AND is_default = 1", (topic["id"],)
        ).fetchone()
        if not cur:
            cur = db.execute(
                "SELECT id FROM curricula WHERE topic_id = ? ORDER BY id LIMIT 1", (topic["id"],)
            ).fetchone()
        if not cur:
            return {"topic": topic_name, "subjects": []}

        subjects = db.execute(
            "SELECT * FROM subjects WHERE curriculum_id = ? ORDER BY order_num",
            (cur["id"],),
        ).fetchall()

        result_subjects = []
        for s in subjects:
            exercises = db.execute(
                "SELECT id, title, difficulty FROM exercises WHERE subject_id = ?",
                (s["id"],),
            ).fetchall()

            knowledge = db.execute(
                "SELECT id, title, tags FROM knowledge WHERE subject_id = ?",
                (s["id"],),
            ).fetchall()

            completed = db.execute(
                "SELECT DISTINCT exercise_id FROM attempts WHERE is_correct = 1 AND exercise_id IN "
                "(SELECT id FROM exercises WHERE subject_id = ?)",
                (s["id"],),
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

            result_subjects.append({
                "id": s["id"],
                "name": s["name"],
                "description": s["description"],
                "parent_id": s["parent_id"],
                "exercises": ex_list,
                "knowledge": kn_list,
                "progress": f"{done}/{total}" if total > 0 else "no exercises",
            })

        return {"topic": topic_name, "subjects": result_subjects}
    finally:
        db.close()


def _create_exercise(args: dict) -> dict:
    db = get_db()
    try:
        cursor = db.execute(
            "INSERT INTO exercises (subject_id, title, description, initial_code, check_type, check_value, difficulty, ui_type, created_by) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ai')",
            (
                args["subject_id"],
                args["title"],
                args.get("description", ""),
                args.get("initial_code", ""),
                args["check_type"],
                args.get("check_value", ""),
                args.get("difficulty", 1),
                args.get("ui_type", "auto"),
            ),
        )
        db.commit()
        _write_notify_file("curriculum_updated")
        return {"id": cursor.lastrowid, "title": args["title"], "status": "created"}
    finally:
        db.close()


def _add_subject(args: dict) -> dict:
    db = get_db()
    try:
        curriculum_id = args.get("curriculum_id")

        if curriculum_id:
            # curriculum_id가 직접 지정된 경우
            cur = db.execute("SELECT id FROM curricula WHERE id = ?", (curriculum_id,)).fetchone()
            if not cur:
                return {"error": f"Curriculum id {curriculum_id} not found"}
        else:
            # topic 이름으로 기본 커리큘럼 찾기
            topic = db.execute("SELECT id FROM topics WHERE name = ?", (args["topic"],)).fetchone()
            if not topic:
                return {"error": f"Topic '{args['topic']}' not found"}

            cur = db.execute(
                "SELECT id FROM curricula WHERE topic_id = ? AND is_default = 1", (topic["id"],)
            ).fetchone()
            if not cur:
                cur = db.execute(
                    "SELECT id FROM curricula WHERE topic_id = ? ORDER BY id LIMIT 1", (topic["id"],)
                ).fetchone()
            if not cur:
                return {"error": f"No curriculum found for topic '{args['topic']}'"}

        parent_id = args.get("parent_id")
        row = db.execute(
            "SELECT COALESCE(MAX(order_num), -1) + 1 as next_order FROM subjects WHERE curriculum_id = ? AND parent_id IS ?",
            (cur["id"], parent_id),
        ).fetchone()

        cursor = db.execute(
            "INSERT INTO subjects (curriculum_id, name, description, order_num, parent_id) VALUES (?, ?, ?, ?, ?)",
            (cur["id"], args["name"], args.get("description", ""), row["next_order"], parent_id),
        )
        db.commit()
        _write_notify_file("curriculum_updated")
        return {"id": cursor.lastrowid, "name": args["name"], "curriculum_id": cur["id"], "status": "created"}
    finally:
        db.close()


def _update_subject(args: dict) -> dict:
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

        values.append(args["subject_id"])
        db.execute(f"UPDATE subjects SET {', '.join(updates)} WHERE id = ?", values)
        db.commit()
        _write_notify_file("curriculum_updated")
        return {"status": "updated"}
    finally:
        db.close()


def _get_progress(args: dict) -> dict:
    topic_name = args["topic"]
    db = get_db()
    try:
        topic = db.execute("SELECT id FROM topics WHERE name = ?", (topic_name,)).fetchone()
        if not topic:
            return {"error": f"Topic '{topic_name}' not found"}

        total_exercises = db.execute(
            "SELECT COUNT(*) as c FROM exercises WHERE subject_id IN (SELECT id FROM subjects WHERE curriculum_id IN (SELECT id FROM curricula WHERE topic_id = ?))",
            (topic["id"],),
        ).fetchone()["c"]

        completed = db.execute(
            "SELECT COUNT(DISTINCT exercise_id) as c FROM attempts WHERE is_correct = 1 AND exercise_id IN "
            "(SELECT id FROM exercises WHERE subject_id IN (SELECT id FROM subjects WHERE curriculum_id IN (SELECT id FROM curricula WHERE topic_id = ?)))",
            (topic["id"],),
        ).fetchone()["c"]

        total_attempts = db.execute(
            "SELECT COUNT(*) as c FROM attempts WHERE exercise_id IN "
            "(SELECT id FROM exercises WHERE subject_id IN (SELECT id FROM subjects WHERE curriculum_id IN (SELECT id FROM curricula WHERE topic_id = ?)))",
            (topic["id"],),
        ).fetchone()["c"]

        return {
            "topic": topic_name,
            "total_exercises": total_exercises,
            "completed_exercises": completed,
            "total_attempts": total_attempts,
            "completion_rate": f"{completed}/{total_exercises}" if total_exercises > 0 else "0/0",
        }
    finally:
        db.close()


def _execute_code(args: dict) -> dict:
    topic_name = args["topic"]
    code = args["code"]

    db = get_db()
    try:
        topic = db.execute("SELECT * FROM topics WHERE name = ?", (topic_name,)).fetchone()
        if not topic:
            return {"error": f"Topic '{topic_name}' not found"}
        container_name = topic["container_name"]
    finally:
        db.close()

    client = get_docker()
    container = client.containers.get(container_name)

    if topic_name == "SQL":
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

        columns = lines[0].split("\t")
        rows = [line.split("\t") for line in lines[1:]]
        header = " | ".join(columns)
        separator = "-+-".join("-" * len(c) for c in columns)
        formatted_rows = [" | ".join(r) for r in rows]
        table = f"{header}\n{separator}\n" + "\n".join(formatted_rows)
        return {"output": table, "row_count": len(rows)}

    elif topic_name == "Git":
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


def _save_knowledge(args: dict) -> dict:
    db = get_db()
    try:
        topic_id = None
        topic_name = args.get("topic")
        if topic_name:
            row = db.execute("SELECT id FROM topics WHERE name = ?", (topic_name,)).fetchone()
            if row:
                topic_id = row["id"]

        subject_id = args.get("subject_id")
        cursor = db.execute(
            "INSERT INTO knowledge (topic_id, subject_id, title, content, tags) VALUES (?, ?, ?, ?, ?)",
            (topic_id, subject_id, args["title"], args.get("content", ""), args.get("tags", "")),
        )
        db.commit()
        _write_notify_file("knowledge_updated")
        return {"id": cursor.lastrowid, "title": args["title"], "status": "saved"}
    finally:
        db.close()


def _list_knowledge(args: dict) -> dict:
    db = get_db()
    try:
        query = "SELECT k.id, k.title, k.tags, k.updated_at, t.name as topic FROM knowledge k LEFT JOIN topics t ON k.topic_id = t.id"
        params: list = []
        conditions = []

        topic_name = args.get("topic")
        if topic_name:
            conditions.append("t.name = ?")
            params.append(topic_name)

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


def _create_curriculum(args: dict) -> dict:
    db = get_db()
    try:
        topic = db.execute("SELECT id FROM topics WHERE name = ?", (args["topic"],)).fetchone()
        if not topic:
            return {"error": f"Topic '{args['topic']}' not found"}

        name = args["name"]
        description = args.get("description", "")

        cursor = db.execute(
            "INSERT INTO curricula (topic_id, name, description, is_default) VALUES (?, ?, ?, 0)",
            (topic["id"], name, description),
        )
        db.commit()
        _write_notify_file("curriculum_updated")
        return {"id": cursor.lastrowid, "name": name, "topic": args["topic"], "status": "created"}
    finally:
        db.close()


def _create_topic(args: dict) -> dict:
    db = get_db()
    try:
        name = args["name"]
        description = args.get("description", "")
        container_name = args.get("container_name", f"dojang-{name.lower()}")

        existing = db.execute("SELECT id FROM topics WHERE name = ?", (name,)).fetchone()
        if existing:
            return {"error": f"Topic '{name}' already exists", "id": existing["id"]}

        cursor = db.execute(
            "INSERT INTO topics (name, description, container_name) VALUES (?, ?, ?)",
            (name, description, container_name),
        )
        db.commit()

        db.execute(
            "INSERT INTO curricula (topic_id, name, description, is_default) VALUES (?, ?, ?, 1)",
            (cursor.lastrowid, f"{name} 기초", f"{name} 기본 커리큘럼"),
        )
        db.execute(
            "INSERT INTO notebooks (topic_id, name, description, is_default) VALUES (?, ?, ?, 1)",
            (cursor.lastrowid, f"{name} 노트", f"{name} 기본 노트북"),
        )
        db.commit()
        _write_notify_file("curriculum_updated")
        return {"id": cursor.lastrowid, "name": name, "container_name": container_name, "status": "created"}
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Tool registry — single source of truth
# ---------------------------------------------------------------------------

TOOL_REGISTRY: list[dict] = [
    {
        "name": "get_curriculum",
        "description": "현재 주제(토픽)의 커리큘럼 트리를 가져옵니다. 과목(서브젝트)별 연습문제와 진행률이 포함됩니다.",
        "schema": {
            "type": "object",
            "properties": {
                "topic": {"type": "string", "description": "주제(토픽) 이름 (CLI, Git, Docker, SQL 등)"},
            },
            "required": ["topic"],
        },
        "handler": _get_curriculum,
    },
    {
        "name": "add_subject",
        "description": "커리큘럼에 새로운 과목(서브젝트)을 추가합니다. curriculum_id를 지정하면 해당 커리큘럼에, 생략하면 주제(토픽)의 기본 커리큘럼에 추가됩니다.",
        "schema": {
            "type": "object",
            "properties": {
                "topic": {"type": "string", "description": "주제(토픽) 이름 (curriculum_id 미지정 시 필수)"},
                "curriculum_id": {"type": "integer", "description": "커리큘럼 ID (create_curriculum 결과에서 받은 id)"},
                "name": {"type": "string", "description": "과목(서브젝트) 이름"},
                "description": {"type": "string", "description": "과목(서브젝트) 설명", "default": ""},
                "parent_id": {"type": "integer", "description": "상위 과목(서브젝트) ID (하위로 만들 때)"},
            },
            "required": ["name"],
        },
        "handler": _add_subject,
    },
    {
        "name": "update_subject",
        "description": "기존 과목(서브젝트)의 정보를 수정합니다.",
        "schema": {
            "type": "object",
            "properties": {
                "subject_id": {"type": "integer"},
                "name": {"type": "string"},
                "description": {"type": "string"},
            },
            "required": ["subject_id"],
        },
        "handler": _update_subject,
    },
    {
        "name": "create_exercise",
        "description": "새로운 연습 문제를 생성합니다. 학습자 수준에 맞춰 만들어주세요.",
        "schema": {
            "type": "object",
            "properties": {
                "subject_id": {"type": "integer", "description": "과목(서브젝트) ID"},
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
                "ui_type": {
                    "type": "string",
                    "enum": ["auto", "terminal", "code", "text"],
                    "description": "UI 타입: auto(주제에 따라 자동), terminal(CLI), code(코드 에디터), text(텍스트). 기본값 auto.",
                    "default": "auto",
                },
            },
            "required": ["subject_id", "title", "description", "check_type"],
        },
        "handler": _create_exercise,
    },
    {
        "name": "execute_code",
        "description": "주제(토픽) 컨테이너에서 코드를 실행합니다. SQL이면 쿼리를, CLI/Git/Docker면 bash 명령어를 실행합니다.",
        "schema": {
            "type": "object",
            "properties": {
                "topic": {"type": "string", "description": "주제(토픽) 이름 (CLI, Git, Docker, SQL 등)"},
                "code": {"type": "string", "description": "실행할 SQL 쿼리 또는 bash 명령어"},
                "repo": {"type": "string", "description": "Git 시나리오 이름 (basic, branching 등)", "default": "basic"},
            },
            "required": ["topic", "code"],
        },
        "handler": _execute_code,
    },
    {
        "name": "get_progress",
        "description": "학습자의 주제(토픽)별 진행 현황을 가져옵니다.",
        "schema": {
            "type": "object",
            "properties": {
                "topic": {"type": "string", "description": "주제(토픽) 이름"},
            },
            "required": ["topic"],
        },
        "handler": _get_progress,
    },
    {
        "name": "list_knowledge",
        "description": "저장된 지식 카드 목록을 조회합니다.",
        "schema": {
            "type": "object",
            "properties": {
                "topic": {"type": "string", "description": "주제(토픽)으로 필터 (선택)"},
                "query": {"type": "string", "description": "검색어 (선택)"},
            },
        },
        "handler": _list_knowledge,
    },
    {
        "name": "save_knowledge",
        "description": "학습 중 중요한 개념이나 지식을 저장합니다.",
        "schema": {
            "type": "object",
            "properties": {
                "topic": {"type": "string", "description": "관련 주제(토픽) 이름"},
                "subject_id": {"type": "integer", "description": "과목(서브젝트) ID"},
                "title": {"type": "string", "description": "지식 카드 제목"},
                "content": {"type": "string", "description": "핵심 내용 (마크다운)"},
                "tags": {"type": "string", "description": "태그들 (쉼표 구분)"},
            },
            "required": ["title", "content"],
        },
        "handler": _save_knowledge,
    },
    {
        "name": "create_curriculum",
        "description": "주제(토픽) 안에 새로운 커리큘럼을 만듭니다. 커리큘럼은 과목(서브젝트)들을 담는 폴더입니다.",
        "schema": {
            "type": "object",
            "properties": {
                "topic": {"type": "string", "description": "주제(토픽) 이름 (CLI, Git 등)"},
                "name": {"type": "string", "description": "커리큘럼 이름 (예: 'CLI 완전 초보자 코스')"},
                "description": {"type": "string", "description": "커리큘럼 설명", "default": ""},
            },
            "required": ["topic", "name"],
        },
        "handler": _create_curriculum,
    },
    {
        "name": "create_topic",
        "description": "새로운 학습 주제(토픽)를 생성합니다. 기본 커리큘럼과 노트북이 자동 생성됩니다.",
        "schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "주제(토픽) 이름"},
                "description": {"type": "string", "description": "주제(토픽) 설명", "default": ""},
                "container_name": {"type": "string", "description": "Docker 컨테이너 이름 (생략 시 자동 생성)", "default": ""},
            },
            "required": ["name"],
        },
        "handler": _create_topic,
    },
]


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------

TOOL_HANDLERS: dict[str, Callable[[dict], dict]] = {
    t["name"]: t["handler"] for t in TOOL_REGISTRY
}


def handle_tool(name: str, args: dict) -> dict:
    handler = TOOL_HANDLERS.get(name)
    if handler is None:
        return {"error": f"Unknown tool: {name}"}
    return handler(args)


# ---------------------------------------------------------------------------
# Format converters
# ---------------------------------------------------------------------------

def to_mcp_tools() -> list[Tool]:
    return [
        Tool(name=t["name"], description=t["description"], inputSchema=t["schema"])
        for t in TOOL_REGISTRY
    ]


