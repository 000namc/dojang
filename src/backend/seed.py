import json
from pathlib import Path

import aiosqlite

from src.backend.database import get_connection

DOMAINS_DIR = Path(__file__).parent.parent.parent / "build"


async def seed_if_empty(db_path: str) -> None:
    db = await get_connection(db_path)
    try:
        cursor = await db.execute("SELECT COUNT(*) as c FROM domains")
        row = await cursor.fetchone()
        if row["c"] > 0:
            return

        # Insert domains
        domain_configs = [
            ("CLI", "리눅스 명령어 연습", "dojang-cli"),
            ("Git", "Git 버전 관리 연습", "dojang-git"),
            ("Docker", "Docker 컨테이너 연습", "dojang-docker"),
            ("SQL", "SQL 쿼리 작성 연습", "dojang-sql"),
        ]
        for name, desc, container in domain_configs:
            await db.execute(
                "INSERT INTO domains (name, description, container_name) VALUES (?, ?, ?)",
                (name, desc, container),
            )

        await db.commit()

        # Load curriculum for each domain
        for domain_dir_name, domain_name in [("cli", "CLI"), ("git", "Git"), ("docker", "Docker"), ("sql", "SQL")]:
            curriculum_path = DOMAINS_DIR / domain_dir_name / "curriculum.json"
            if not curriculum_path.exists():
                continue

            cursor = await db.execute(
                "SELECT id FROM domains WHERE name = ?", (domain_name,)
            )
            domain_row = await cursor.fetchone()
            domain_id = domain_row["id"]

            curriculum = json.loads(curriculum_path.read_text())

            for topic_data in curriculum.get("topics", []):
                await _insert_topic(db, domain_id, topic_data, parent_id=None)

            await db.commit()
    finally:
        await db.close()


async def _insert_topic(
    db: aiosqlite.Connection,
    domain_id: int,
    topic_data: dict,
    parent_id: int | None,
) -> None:
    cursor = await db.execute(
        "INSERT INTO topics (domain_id, name, description, order_num, parent_id) VALUES (?, ?, ?, ?, ?)",
        (
            domain_id,
            topic_data["name"],
            topic_data.get("description", ""),
            topic_data.get("order", 0),
            parent_id,
        ),
    )
    topic_id = cursor.lastrowid

    for ex in topic_data.get("exercises", []):
        await db.execute(
            "INSERT INTO exercises (topic_id, title, description, initial_code, check_type, check_value, difficulty) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                topic_id,
                ex["title"],
                ex.get("description", ""),
                ex.get("initial_code", ""),
                ex.get("check_type", "ai_check"),
                ex.get("check_value", ""),
                ex.get("difficulty", 1),
            ),
        )

    for child in topic_data.get("children", []):
        await _insert_topic(db, domain_id, child, parent_id=topic_id)
