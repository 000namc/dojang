import json
from pathlib import Path

import aiosqlite

from src.backend.database import get_connection

TOPICS_DIR = Path(__file__).parent.parent.parent / "build"


async def seed_if_empty(db_path: str) -> None:
    db = await get_connection(db_path)
    try:
        cursor = await db.execute("SELECT COUNT(*) as c FROM topics")
        row = await cursor.fetchone()
        if row["c"] > 0:
            return

        # Insert topics
        topic_configs = [
            ("CLI", "리눅스 명령어 연습", "dojang-cli"),
            ("Git", "Git 버전 관리 연습", "dojang-git"),
            ("Docker", "Docker 컨테이너 연습", "dojang-docker"),
            ("SQL", "SQL 쿼리 작성 연습", "dojang-sql"),
        ]
        for name, desc, container in topic_configs:
            await db.execute(
                "INSERT INTO topics (name, description, container_name) VALUES (?, ?, ?)",
                (name, desc, container),
            )

        await db.commit()

        # Load curriculum for each topic
        for topic_dir_name, topic_name in [("cli", "CLI"), ("git", "Git"), ("docker", "Docker"), ("sql", "SQL")]:
            curriculum_path = TOPICS_DIR / topic_dir_name / "curriculum.json"
            if not curriculum_path.exists():
                continue

            cursor = await db.execute(
                "SELECT id FROM topics WHERE name = ?", (topic_name,)
            )
            topic_row = await cursor.fetchone()
            topic_id = topic_row["id"]

            curriculum = json.loads(curriculum_path.read_text())

            # Create default curriculum for this topic
            cur_name = curriculum.get("name", f"{topic_name} 기초")
            cur_desc = curriculum.get("description", f"{topic_name} 기본 커리큘럼")
            cursor = await db.execute(
                "INSERT INTO curricula (topic_id, name, description, is_default) VALUES (?, ?, ?, 1)",
                (topic_id, cur_name, cur_desc),
            )
            curriculum_id = cursor.lastrowid

            # 시드 시점에 default_curriculum_id 를 직접 set — backfill_defaults 는
            # 더 이상 이 필드를 안 채우므로, 여기서 채우지 않으면 NULL 로 남아
            # Explore 에서 안 보이게 됨.
            await db.execute(
                "UPDATE topics SET default_curriculum_id = ? WHERE id = ?",
                (curriculum_id, topic_id),
            )

            for subject_data in curriculum.get("topics", []):
                await _insert_subject(db, curriculum_id, subject_data, parent_id=None, topic_id=topic_id)

            # Seed knowledge notebooks
            knowledge_path = TOPICS_DIR / topic_dir_name / "knowledge.json"
            if knowledge_path.exists():
                knowledge = json.loads(knowledge_path.read_text())
                for nb in knowledge.get("notebooks", []):
                    cursor = await db.execute(
                        "INSERT INTO notebooks (topic_id, name, description, is_default) VALUES (?, ?, ?, 1)",
                        (topic_id, nb["name"], nb.get("description", "")),
                    )
                    notebook_id = cursor.lastrowid
                    for card in nb.get("cards", []):
                        await db.execute(
                            "INSERT INTO knowledge (notebook_id, topic_id, title, content, tags) VALUES (?, ?, ?, ?, ?)",
                            (notebook_id, topic_id, card["title"], card.get("content", ""), card.get("tags", "")),
                        )

            await db.commit()
    finally:
        await db.close()


async def _insert_subject(
    db: aiosqlite.Connection,
    curriculum_id: int,
    subject_data: dict,
    parent_id: int | None,
    topic_id: int | None = None,
) -> None:
    cursor = await db.execute(
        "INSERT INTO subjects (curriculum_id, name, description, order_num, parent_id) VALUES (?, ?, ?, ?, ?)",
        (
            curriculum_id,
            subject_data["name"],
            subject_data.get("description", ""),
            subject_data.get("order", 0),
            parent_id,
        ),
    )
    subject_id = cursor.lastrowid

    # Knowledge cards embedded in the subject
    for card in subject_data.get("knowledge", []):
        await db.execute(
            "INSERT INTO knowledge (subject_id, topic_id, title, content, tags, order_num) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (
                subject_id,
                topic_id,
                card["title"],
                card.get("content", ""),
                card.get("tags", ""),
                card.get("order", 0),
            ),
        )

    for ex in subject_data.get("exercises", []):
        await db.execute(
            "INSERT INTO exercises (subject_id, title, description, initial_code, check_type, check_value, difficulty) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                subject_id,
                ex["title"],
                ex.get("description", ""),
                ex.get("initial_code", ""),
                ex.get("check_type", "ai_check"),
                ex.get("check_value", ""),
                ex.get("difficulty", 1),
            ),
        )

    for child in subject_data.get("children", []):
        await _insert_subject(db, curriculum_id, child, parent_id=subject_id, topic_id=topic_id)
