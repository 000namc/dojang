import aiosqlite
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS clusters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    order_num INTEGER DEFAULT 0,
    is_default INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    container_name TEXT NOT NULL,
    cluster_id INTEGER REFERENCES clusters(id),
    default_curriculum_id INTEGER REFERENCES curricula(id)
);

CREATE TABLE IF NOT EXISTS curricula (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id INTEGER NOT NULL REFERENCES topics(id),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    is_default INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    curriculum_id INTEGER NOT NULL REFERENCES curricula(id),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    order_num INTEGER NOT NULL DEFAULT 0,
    parent_id INTEGER REFERENCES subjects(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL REFERENCES subjects(id),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    initial_code TEXT DEFAULT '',
    check_type TEXT NOT NULL DEFAULT 'ai_check',
    check_value TEXT DEFAULT '',
    difficulty INTEGER DEFAULT 1,
    ui_type TEXT NOT NULL DEFAULT 'auto',
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

CREATE TABLE IF NOT EXISTS chat_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id INTEGER NOT NULL REFERENCES topics(id),
    title TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notebooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id INTEGER REFERENCES topics(id),
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
    topic_id INTEGER REFERENCES topics(id),
    subject_id INTEGER REFERENCES subjects(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    tags TEXT DEFAULT '',
    order_num INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sketches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    claude_session_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


async def init_db(db_path: str) -> None:
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(db_path) as db:
        # Migrate old table names (order matters: topics->subjects first, then domains->topics)
        for old, new in [("topics", "subjects"), ("domains", "topics")]:
            try:
                await db.execute(f"ALTER TABLE {old} RENAME TO {new}")
            except Exception:
                pass  # Already renamed or doesn't exist

        # Migrate old column names
        for sql in [
            "ALTER TABLE curricula RENAME COLUMN domain_id TO topic_id",
            "ALTER TABLE chat_sessions RENAME COLUMN domain_id TO topic_id",
            "ALTER TABLE notebooks RENAME COLUMN domain_id TO topic_id",
            "ALTER TABLE knowledge RENAME COLUMN domain_id TO topic_id",
            "ALTER TABLE knowledge RENAME COLUMN topic_id TO subject_id",
            "ALTER TABLE exercises RENAME COLUMN topic_id TO subject_id",
        ]:
            try:
                await db.execute(sql)
            except Exception:
                pass

        await db.executescript(SCHEMA)
        # Migrate existing DBs — add columns that may not exist yet
        for col, sql in [
            ("subject_id", "ALTER TABLE knowledge ADD COLUMN subject_id INTEGER REFERENCES subjects(id)"),
            ("order_num", "ALTER TABLE knowledge ADD COLUMN order_num INTEGER NOT NULL DEFAULT 0"),
            ("ui_type", "ALTER TABLE exercises ADD COLUMN ui_type TEXT NOT NULL DEFAULT 'auto'"),
            ("session_id", "ALTER TABLE chat_messages ADD COLUMN session_id INTEGER REFERENCES chat_sessions(id)"),
            ("cur_session_id", "ALTER TABLE curricula ADD COLUMN session_id INTEGER REFERENCES chat_sessions(id)"),
            ("topic_cluster_id", "ALTER TABLE topics ADD COLUMN cluster_id INTEGER REFERENCES clusters(id)"),
            ("topic_default_curriculum_id", "ALTER TABLE topics ADD COLUMN default_curriculum_id INTEGER REFERENCES curricula(id)"),
        ]:
            try:
                await db.execute(sql)
            except Exception:
                pass

        # 기본 cluster 보장 + cluster_id가 NULL인 토픽들을 기본 cluster에 할당
        cur = await db.execute("SELECT id FROM clusters WHERE is_default = 1 LIMIT 1")
        row = await cur.fetchone()
        if row is None:
            cur = await db.execute(
                "INSERT INTO clusters (name, description, is_default) VALUES (?, ?, 1)",
                ("기본값", "분류되지 않은 토픽"),
            )
            default_cluster_id = cur.lastrowid
        else:
            default_cluster_id = row[0]

        await db.execute(
            "UPDATE topics SET cluster_id = ? WHERE cluster_id IS NULL",
            (default_cluster_id,),
        )

        # 각 topic의 default_curriculum_id가 NULL이면 첫 번째 curriculum으로 자동 설정
        await db.execute(
            """
            UPDATE topics
            SET default_curriculum_id = (
                SELECT MIN(id) FROM curricula WHERE curricula.topic_id = topics.id
            )
            WHERE default_curriculum_id IS NULL
            """
        )

        await db.commit()


async def get_connection(db_path: str) -> aiosqlite.Connection:
    db = await aiosqlite.connect(db_path)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    return db
