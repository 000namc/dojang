"""도구 레지스트리 — Claude Code 세션이 MCP를 통해 호출하는 도구들."""

import json
import re
import sqlite3
import time
from collections.abc import Callable
from datetime import datetime
from pathlib import Path

import docker
from mcp.types import Tool

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

DB_PATH = Path(__file__).parent.parent.parent / "data" / "dojang.db"
NOTIFY_FILE = Path(__file__).parent.parent.parent / "data" / ".notify"
CONTEXT_FILE = Path(__file__).parent.parent.parent / "data" / "current_context.md"


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
        knowledge_id = args.get("id")

        topic_id = None
        topic_name = args.get("topic")
        if topic_name:
            row = db.execute("SELECT id FROM topics WHERE name = ?", (topic_name,)).fetchone()
            if row:
                topic_id = row["id"]

        subject_id = args.get("subject_id")

        if knowledge_id:
            # 기존 카드 업데이트
            existing = db.execute("SELECT id FROM knowledge WHERE id = ?", (knowledge_id,)).fetchone()
            if not existing:
                return {"error": f"Knowledge card #{knowledge_id} not found"}
            sets = []
            params: list = []
            if "title" in args:
                sets.append("title = ?")
                params.append(args["title"])
            if "content" in args:
                sets.append("content = ?")
                params.append(args["content"])
            if "tags" in args:
                sets.append("tags = ?")
                params.append(args["tags"])
            if topic_id is not None:
                sets.append("topic_id = ?")
                params.append(topic_id)
            if subject_id is not None:
                sets.append("subject_id = ?")
                params.append(subject_id)
            if not sets:
                return {"id": knowledge_id, "status": "no changes"}
            sets.append("updated_at = CURRENT_TIMESTAMP")
            params.append(knowledge_id)
            db.execute(f"UPDATE knowledge SET {', '.join(sets)} WHERE id = ?", params)
            db.commit()
            _write_notify_file("knowledge_updated")
            return {"id": knowledge_id, "title": args.get("title", ""), "status": "updated"}
        else:
            # 새 카드 생성
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


def _review_curriculum(args: dict) -> dict:
    """커리큘럼의 구조 품질을 분석해 warnings 리스트와 통계를 반환한다.

    Claude 가 커리큘럼을 만든 직후 자기 점검용으로 호출하는 도구. flat 구조,
    노트/실습 밀도 부족, 난이도/check_type 편향, 빈 subject 등을 감지한다.
    """
    curriculum_id = args["curriculum_id"]
    db = get_db()
    try:
        cur = db.execute(
            "SELECT id, name FROM curricula WHERE id = ?", (curriculum_id,)
        ).fetchone()
        if not cur:
            return {"error": f"Curriculum id {curriculum_id} not found"}

        subjects = db.execute(
            "SELECT id, name, parent_id FROM subjects WHERE curriculum_id = ? ORDER BY parent_id, order_num",
            (curriculum_id,),
        ).fetchall()

        if not subjects:
            return {
                "curriculum_id": curriculum_id,
                "name": cur["name"],
                "stats": {"total_subjects": 0},
                "warnings": ["Curriculum is empty — no subjects yet."],
            }

        subject_ids = [s["id"] for s in subjects]
        has_children: set[int] = set()
        for s in subjects:
            if s["parent_id"] is not None:
                has_children.add(s["parent_id"])

        top_level = [s for s in subjects if s["parent_id"] is None]
        sub_level = [s for s in subjects if s["parent_id"] is not None]
        parts = [s for s in top_level if s["id"] in has_children]
        leaves = [s for s in subjects if s["id"] not in has_children]

        placeholders = ",".join("?" * len(subject_ids))
        knowledge_counts: dict[int, int] = {
            row["subject_id"]: row["c"]
            for row in db.execute(
                f"SELECT subject_id, COUNT(*) as c FROM knowledge "
                f"WHERE subject_id IN ({placeholders}) GROUP BY subject_id",
                subject_ids,
            ).fetchall()
        }
        exercise_rows = db.execute(
            f"SELECT subject_id, difficulty, check_type FROM exercises "
            f"WHERE subject_id IN ({placeholders})",
            subject_ids,
        ).fetchall()

        exercise_counts: dict[int, int] = {}
        difficulty_spread: dict[str, int] = {}
        check_type_spread: dict[str, int] = {}
        for row in exercise_rows:
            sid = row["subject_id"]
            exercise_counts[sid] = exercise_counts.get(sid, 0) + 1
            diff_key = str(row["difficulty"])
            difficulty_spread[diff_key] = difficulty_spread.get(diff_key, 0) + 1
            ct = row["check_type"]
            check_type_spread[ct] = check_type_spread.get(ct, 0) + 1

        leaf_knowledge = [knowledge_counts.get(s["id"], 0) for s in leaves]
        leaf_exercises = [exercise_counts.get(s["id"], 0) for s in leaves]
        avg_knowledge = sum(leaf_knowledge) / len(leaves) if leaves else 0.0
        avg_exercises = sum(leaf_exercises) / len(leaves) if leaves else 0.0

        empty_knowledge = [
            {"id": s["id"], "name": s["name"]}
            for s in leaves
            if knowledge_counts.get(s["id"], 0) == 0
        ]
        empty_exercises = [
            {"id": s["id"], "name": s["name"]}
            for s in leaves
            if exercise_counts.get(s["id"], 0) == 0
        ]

        warnings: list[str] = []

        if len(parts) == 0 and len(top_level) > 5:
            warnings.append(
                f"Flat structure: {len(top_level)} top-level subjects, 0 Parts. "
                "Group into 2-4 Parts — create top-level parent subjects first "
                "(add_subject with parent_id=None) and move learning subjects "
                "under them via add_subject(parent_id=<part_id>)."
            )
        elif len(parts) > 0 and len(sub_level) < len(top_level):
            warnings.append(
                f"Partial hierarchy: only {len(sub_level)} subjects have a parent "
                f"out of {len(subjects)} total. Aim for most learning subjects to "
                "live under a Part."
            )

        if avg_knowledge < 1.5 and leaves:
            warnings.append(
                f"Knowledge density low (avg {avg_knowledge:.1f} notes per leaf subject). "
                "Aim for 2-4 knowledge cards per subject covering different angles "
                "(concept / rationale / mechanism / pitfalls)."
            )

        if avg_exercises < 1.5 and leaves:
            warnings.append(
                f"Exercise density low (avg {avg_exercises:.1f} exercises per leaf subject). "
                "Aim for 2-3 exercises per subject as a ladder (drill -> apply -> extend)."
            )

        if check_type_spread and len(check_type_spread) == 1:
            only_type = next(iter(check_type_spread))
            warnings.append(
                f"All exercises use check_type='{only_type}'. Mix auto-gradable "
                "drills (output_match / query_match / script_check) with ai_check "
                "to create a learning ladder."
            )

        if difficulty_spread and len(difficulty_spread) == 1:
            only_diff = next(iter(difficulty_spread))
            warnings.append(
                f"All exercises at difficulty {only_diff}. Spread across 1 (drill), "
                "2 (apply), and 3 (extend) so learners have warm-ups and challenges."
            )

        if empty_knowledge:
            sample = ", ".join(f"#{s['id']} {s['name']}" for s in empty_knowledge[:5])
            extra = f" (+{len(empty_knowledge) - 5} more)" if len(empty_knowledge) > 5 else ""
            warnings.append(f"Leaf subjects without knowledge cards: {sample}{extra}")

        if empty_exercises:
            sample = ", ".join(f"#{s['id']} {s['name']}" for s in empty_exercises[:5])
            extra = f" (+{len(empty_exercises) - 5} more)" if len(empty_exercises) > 5 else ""
            warnings.append(f"Leaf subjects without exercises: {sample}{extra}")

        if not warnings:
            warnings.append("Looks good. No structural issues detected.")

        return {
            "curriculum_id": curriculum_id,
            "name": cur["name"],
            "stats": {
                "parts": len(parts),
                "top_level_subjects": len(top_level),
                "sub_level_subjects": len(sub_level),
                "total_subjects": len(subjects),
                "leaf_subjects": len(leaves),
                "avg_knowledge_per_leaf": round(avg_knowledge, 2),
                "avg_exercises_per_leaf": round(avg_exercises, 2),
                "difficulty_spread": difficulty_spread,
                "check_type_spread": check_type_spread,
            },
            "warnings": warnings,
        }
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


_SKETCH_CONTEXT_RE = re.compile(r"@sketch:[^\n]*?#(\d+)")


def _infer_active_sketch_id() -> int | None:
    """data/current_context.md 의 `@sketch:... #<id>` 줄에서 현재 열린 sketch id 추출."""
    if not CONTEXT_FILE.exists():
        return None
    m = _SKETCH_CONTEXT_RE.search(CONTEXT_FILE.read_text())
    return int(m.group(1)) if m else None


def _update_sketch(args: dict) -> dict:
    sketch_id = args.get("sketch_id")
    if sketch_id is None:
        sketch_id = _infer_active_sketch_id()
    if sketch_id is None:
        return {"error": "sketch_id not provided and no @sketch entry in current_context.md"}

    content = args.get("content", "")
    mode = args.get("mode", "append")
    heading = args.get("heading")

    db = get_db()
    try:
        row = db.execute(
            "SELECT id, content FROM sketches WHERE id = ?", (sketch_id,)
        ).fetchone()
        if not row:
            return {"error": f"Sketch #{sketch_id} not found"}

        if mode == "replace":
            new_content = content
        else:
            existing = row["content"] or ""
            ts = datetime.now().strftime("%Y-%m-%d %H:%M")
            header = heading or f"## 정리 {ts}"
            sep = "" if not existing else ("\n" if existing.endswith("\n\n") else ("\n" if existing.endswith("\n") else "\n\n"))
            new_content = f"{existing}{sep}{header}\n\n{content.rstrip()}\n"

        db.execute(
            "UPDATE sketches SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (new_content, sketch_id),
        )
        db.commit()
        _write_notify_file("sketch_updated")
        return {"id": sketch_id, "mode": mode, "length": len(new_content), "status": "updated"}
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
        "description": (
            "커리큘럼에 과목(서브젝트)을 추가합니다.\n\n"
            "좋은 커리큘럼은 2단계 계층입니다 — 먼저 parent_id=None 으로 "
            "Part 성격의 상위 subject 를 3~4개 만든 뒤 (예: 'Part I. 요청/응답의 경계'), "
            "그 아래에 parent_id=<part 의 id> 로 실제 학습 주제를 겁니다. "
            "flat 구조 (parent_id 없는 subject 만 나열) 는 피하세요.\n\n"
            "curriculum_id 를 지정하면 해당 커리큘럼에, 생략하면 주제(토픽)의 기본 "
            "커리큘럼에 추가됩니다."
        ),
        "schema": {
            "type": "object",
            "properties": {
                "topic": {"type": "string", "description": "주제(토픽) 이름 (curriculum_id 미지정 시 필수)"},
                "curriculum_id": {"type": "integer", "description": "커리큘럼 ID (create_curriculum 결과에서 받은 id)"},
                "name": {"type": "string", "description": "과목(서브젝트) 이름. 상위(Part)면 'Part I. 기초' 같은 형태, 하위면 구체 주제명."},
                "description": {"type": "string", "description": "과목(서브젝트) 설명", "default": ""},
                "parent_id": {
                    "type": "integer",
                    "description": (
                        "상위 subject ID. 계층 구조의 핵심 파라미터. "
                        "Part 성격의 상위 subject 는 None (미지정), "
                        "실제 학습 주제는 해당 Part 의 id 를 넣으세요. "
                        "10개 이상의 subject 를 모두 parent_id=None 으로 만들면 flat 구조가 되어 품질이 떨어집니다."
                    ),
                },
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
        "description": (
            "과목(서브젝트)에 연습 문제를 생성합니다.\n\n"
            "한 subject 당 1개만 만들면 학습 리듬이 단조로워집니다. "
            "**2~3개를 ladder 로** 배치하세요:\n"
            "- drill (check_type='output_match' 또는 'query_match', difficulty=1): "
            "개념을 곧바로 확인하는 짧은 드릴. 자동 채점 가능한 형태.\n"
            "- apply (check_type='ai_check', difficulty=2): 실제 상황을 시뮬레이션하는 "
            "실습. drill 보다 호흡이 길다.\n"
            "- extend (check_type='ai_check', difficulty=3, 선택): 응용/변형. "
            "꼭 필요한 subject 에만.\n\n"
            "같은 subject 안 exercise 들의 check_type 과 difficulty 를 다양화하는 것이 "
            "한 subject 에 여러 개를 넣는 것만큼이나 중요합니다."
        ),
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
                    "description": (
                        "정답 확인 방식. drill 단계면 output_match/query_match/script_check "
                        "중 하나 (자동 채점), apply/extend 단계면 ai_check (LLM 평가). "
                        "한 subject 안에서 ai_check 만 쓰지 말고 섞으세요."
                    ),
                },
                "check_value": {"type": "string", "description": "정답 확인용 쿼리/스크립트/예상출력", "default": ""},
                "difficulty": {
                    "type": "integer",
                    "description": "난이도 1-5. 1=drill, 2=apply, 3=extend. 한 subject 내에서 섞어쓰기.",
                    "default": 1,
                },
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
        "description": (
            "과목(서브젝트)에 지식 카드(노트)를 저장합니다.\n\n"
            "한 subject 에는 **2~4개** 카드를 서로 다른 각도로 작성하세요. 추천 각도:\n"
            "- 개념 정의 — 이게 뭐고 왜 필요한가\n"
            "- 설계 의도 — 왜 이 방식으로 만들어졌나 (원칙, 트레이드오프)\n"
            "- 내부 메커니즘 — 실제로 어떻게 동작하나\n"
            "- 흔한 함정 — 놓치기 쉬운 포인트, 오해\n"
            "- 비교 — 비슷한 개념들과의 차이\n\n"
            "카드 하나에 모든 각도를 욱여넣으려 하지 말고 각도별로 분리하세요. "
            "각 카드는 한 주제에 대한 한 관점의 에세이로 작성하는 것이 학습에 유리합니다. "
            "저장 시 반드시 `subject_id` 를 지정해서 해당 subject 에 연결하세요."
        ),
        "schema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "integer",
                    "description": "기존 카드를 수정할 때 카드 ID를 전달하세요. 생략하면 새 카드를 생성합니다.",
                },
                "topic": {"type": "string", "description": "관련 주제(토픽) 이름"},
                "subject_id": {
                    "type": "integer",
                    "description": "과목(서브젝트) ID. 커리큘럼 생성 시에는 거의 항상 지정해야 합니다.",
                },
                "title": {
                    "type": "string",
                    "description": "지식 카드 제목. 어떤 각도의 카드인지 드러나게 쓰세요 (예: '왜 Depends 는 데코레이터가 아닌가' — 설계 의도).",
                },
                "content": {"type": "string", "description": "핵심 내용 (마크다운). 한 관점에 집중."},
                "tags": {"type": "string", "description": "태그들 (쉼표 구분)"},
            },
            "required": ["title", "content"],
        },
        "handler": _save_knowledge,
    },
    {
        "name": "create_curriculum",
        "description": (
            "주제(토픽) 안에 새로운 커리큘럼을 만듭니다. 커리큘럼은 과목(서브젝트)들을 "
            "담는 최상위 컨테이너입니다.\n\n"
            "**중요**: 사용자가 '커리큘럼 만들어줘' 라고 했을 때 곧바로 이 도구를 부르지 "
            "마세요. 먼저 목차 구조 (Part × Subject 트리) 를 **텍스트로 제안하고 승인을 "
            "받은 뒤** 실행하세요. 자세한 절차는 CLAUDE.md 의 '커리큘럼을 새로 만들 때' "
            "섹션을 따르세요. 이 도구를 부른 직후에는 add_subject 로 계층을 만들고, "
            "모든 생성이 끝나면 `review_curriculum` 으로 구조 품질을 검증하세요."
        ),
        "schema": {
            "type": "object",
            "properties": {
                "topic": {"type": "string", "description": "주제(토픽) 이름 (CLI, Git 등)"},
                "name": {"type": "string", "description": "커리큘럼 이름 (예: 'FastAPI 기초')"},
                "description": {"type": "string", "description": "커리큘럼 설명", "default": ""},
            },
            "required": ["topic", "name"],
        },
        "handler": _create_curriculum,
    },
    {
        "name": "review_curriculum",
        "description": (
            "커리큘럼의 구조 품질을 분석해 리포트를 반환합니다.\n\n"
            "**커리큘럼을 새로 만들거나 크게 수정한 직후 반드시 호출하세요.** "
            "이 도구는 다음을 감지합니다:\n"
            "- flat 구조 (parent_id 를 안 썼는지)\n"
            "- 노트/실습 밀도 부족 (leaf subject 당 평균 2개 미만)\n"
            "- 난이도/check_type 편향 (전부 ai_check, 전부 difficulty=2 등)\n"
            "- 노트나 실습이 비어있는 subject\n\n"
            "반환값의 `warnings` 배열이 비어있지 않거나 'Looks good' 하나만 있는 게 "
            "아니면 지적된 부분을 보강한 뒤 다시 호출해서 재검토하세요. 'Looks good' "
            "이 나올 때까지 반복."
        ),
        "schema": {
            "type": "object",
            "properties": {
                "curriculum_id": {"type": "integer", "description": "검토할 커리큘럼 ID"},
            },
            "required": ["curriculum_id"],
        },
        "handler": _review_curriculum,
    },
    {
        "name": "update_sketch",
        "description": (
            "현재 열린 sketch (또는 지정한 sketch) 에 마크다운을 저장합니다.\n\n"
            "Sketch 탭에서 학습자와 길게 대화하며 개념을 탐구한 뒤, 그 대화 내용을 "
            "정리해서 sketchpad 에 남길 때 사용하세요. 기본 동작은 **append** 로, "
            "기존 노트 뒤에 `## 정리 YYYY-MM-DD HH:MM` 헤더를 달고 덧붙입니다. "
            "사용자가 쓰던 노트를 덮어쓰지 않으므로 안전하게 호출할 수 있어요.\n\n"
            "정리할 때 지침:\n"
            "- 주제별로 묶어서 섹션화 (`### 소주제`) — 질문 시간순이 아니라 개념 단위\n"
            "- **합의된 결론** 과 **열린 질문 / 더 파볼 거리** 를 분리\n"
            "- 중요한 코드 스니펫 / 명령어 / 용어는 그대로 유지 (재구성하지 말 것)\n"
            "- 학습자가 '아하' 한 순간의 비유나 언어를 살려두면 나중에 다시 떠올리기 쉬움\n\n"
            "`sketch_id` 를 생략하면 `data/current_context.md` 의 `@sketch:... #id` "
            "에서 자동 추론합니다. `mode='replace'` 는 기존 내용을 통째로 교체하므로 "
            "사용자가 명시적으로 요청했을 때만 쓰세요."
        ),
        "schema": {
            "type": "object",
            "properties": {
                "sketch_id": {
                    "type": "integer",
                    "description": "Sketch ID. 생략하면 current_context.md 에서 자동 추론.",
                },
                "content": {
                    "type": "string",
                    "description": "저장할 마크다운 본문.",
                },
                "mode": {
                    "type": "string",
                    "enum": ["append", "replace"],
                    "description": "append(기본): 헤더와 함께 뒤에 덧붙임. replace: 기존 내용 통째 교체.",
                    "default": "append",
                },
                "heading": {
                    "type": "string",
                    "description": "append 모드에서 쓸 커스텀 헤더 (기본값은 '## 정리 YYYY-MM-DD HH:MM').",
                },
            },
            "required": ["content"],
        },
        "handler": _update_sketch,
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


