import aiosqlite
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    container_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS curricula (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain_id INTEGER NOT NULL REFERENCES domains(id),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    is_default INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    curriculum_id INTEGER NOT NULL REFERENCES curricula(id),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    order_num INTEGER NOT NULL DEFAULT 0,
    parent_id INTEGER REFERENCES topics(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id INTEGER NOT NULL REFERENCES topics(id),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    initial_code TEXT DEFAULT '',
    check_type TEXT NOT NULL DEFAULT 'ai_check',
    check_value TEXT DEFAULT '',
    difficulty INTEGER DEFAULT 1,
    created_by TEXT DEFAULT 'system',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    user_code TEXT NOT NULL,
    result TEXT,
    is_correct INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain_id INTEGER NOT NULL REFERENCES domains(id),
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notebooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain_id INTEGER REFERENCES domains(id),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    is_default INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS checkpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    curriculum_id INTEGER NOT NULL REFERENCES curricula(id),
    name TEXT NOT NULL,
    snapshot TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS knowledge (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    notebook_id INTEGER REFERENCES notebooks(id),
    domain_id INTEGER REFERENCES domains(id),
    topic_id INTEGER REFERENCES topics(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    tags TEXT DEFAULT '',
    order_num INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


async def init_db(db_path: str) -> None:
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(db_path) as db:
        await db.executescript(SCHEMA)
        # Migrate existing DBs
        for col, sql in [
            ("topic_id", "ALTER TABLE knowledge ADD COLUMN topic_id INTEGER REFERENCES topics(id)"),
            ("order_num", "ALTER TABLE knowledge ADD COLUMN order_num INTEGER NOT NULL DEFAULT 0"),
        ]:
            try:
                await db.execute(sql)
            except Exception:
                pass
        await db.commit()


async def get_connection(db_path: str) -> aiosqlite.Connection:
    db = await aiosqlite.connect(db_path)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    return db
