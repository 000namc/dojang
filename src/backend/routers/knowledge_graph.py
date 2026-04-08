"""Knowledge graph endpoint — subjects as constellation nodes, ordered chains as edges."""
from fastapi import APIRouter, Depends

import aiosqlite

from src.backend.config import Settings, get_settings
from src.backend.database import get_connection

router = APIRouter(prefix="/api", tags=["knowledge-graph"])


async def get_db(settings: Settings = Depends(get_settings)):
    db = await get_connection(settings.db_path)
    try:
        yield db
    finally:
        await db.close()


def _status(confidence: float, attempts: int) -> str:
    if attempts == 0:
        return "unknown"
    if confidence >= 0.7:
        return "mastered"
    return "learning"


@router.get("/knowledge-graph")
async def knowledge_graph(db: aiosqlite.Connection = Depends(get_db)):
    # ── subjects: 각 topic의 default_curriculum 안의 subject만 ──────────
    cursor = await db.execute(
        """
        SELECT s.id, s.name, s.curriculum_id, s.order_num,
               c.topic_id, t.name as topic_name
        FROM subjects s
        JOIN curricula c ON s.curriculum_id = c.id
        JOIN topics t ON c.topic_id = t.id
        WHERE c.id = t.default_curriculum_id
        ORDER BY t.id, s.order_num, s.id
        """
    )
    subject_rows = [dict(r) for r in await cursor.fetchall()]

    # subject 단위 attempts 통계
    cursor = await db.execute(
        """
        SELECT e.subject_id,
               COUNT(a.id)                       as attempt_count,
               COALESCE(AVG(a.is_correct), 0.0)  as confidence
        FROM exercises e
        LEFT JOIN attempts a ON a.exercise_id = e.id
        GROUP BY e.subject_id
        """
    )
    subj_stats = {r["subject_id"]: dict(r) for r in await cursor.fetchall()}

    # ── exercises (위성) ───────────────────────────────────────────────────
    cursor = await db.execute(
        """
        SELECT e.id, e.subject_id, e.title, e.difficulty,
               COUNT(a.id)                       as attempt_count,
               COALESCE(AVG(a.is_correct), 0.0)  as confidence
        FROM exercises e
        LEFT JOIN attempts a ON a.exercise_id = e.id
        GROUP BY e.id
        """
    )
    exercise_rows = [dict(r) for r in await cursor.fetchall()]

    # ── knowledge (위성) ──────────────────────────────────────────────────
    cursor = await db.execute(
        """
        SELECT id, subject_id, title
        FROM knowledge
        WHERE subject_id IS NOT NULL
        """
    )
    knowledge_rows = [dict(r) for r in await cursor.fetchall()]

    # subject 메타: topic_name 조회용
    subj_by_id = {s["id"]: s for s in subject_rows}

    nodes = []
    links = []

    # main: subjects
    for s in subject_rows:
        st = subj_stats.get(s["id"], {"attempt_count": 0, "confidence": 0.0})
        attempts = int(st["attempt_count"] or 0)
        conf = float(st["confidence"] or 0.0)
        ex_for_subj = [e for e in exercise_rows if e["subject_id"] == s["id"]]
        kn_for_subj = [k for k in knowledge_rows if k["subject_id"] == s["id"]]
        nodes.append({
            "id": f"subject-{s['id']}",
            "kind": "subject",
            "label": s["name"],
            "topic_id": s["topic_id"],
            "topic_name": s["topic_name"],
            "curriculum_id": s["curriculum_id"],
            "confidence": conf,
            "attempts": attempts,
            "exercise_count": len(ex_for_subj),
            "knowledge_count": len(kn_for_subj),
            "status": _status(conf, attempts),
        })

    # satellite: exercises
    for e in exercise_rows:
        parent = subj_by_id.get(e["subject_id"])
        if not parent:
            continue
        attempts = int(e["attempt_count"] or 0)
        conf = float(e["confidence"] or 0.0)
        nodes.append({
            "id": f"exercise-{e['id']}",
            "kind": "exercise",
            "label": e["title"],
            "topic_id": parent["topic_id"],
            "topic_name": parent["topic_name"],
            "curriculum_id": parent["curriculum_id"],
            "confidence": conf,
            "attempts": attempts,
            "difficulty": e["difficulty"],
            "status": _status(conf, attempts),
            "parent": f"subject-{e['subject_id']}",
        })
        links.append({
            "source": f"subject-{e['subject_id']}",
            "target": f"exercise-{e['id']}",
            "kind": "satellite",
        })

    # satellite: knowledge
    for k in knowledge_rows:
        parent = subj_by_id.get(k["subject_id"])
        if not parent:
            continue
        nodes.append({
            "id": f"knowledge-{k['id']}",
            "kind": "knowledge",
            "label": k["title"],
            "topic_id": parent["topic_id"],
            "topic_name": parent["topic_name"],
            "curriculum_id": parent["curriculum_id"],
            "confidence": 0.0,
            "attempts": 0,
            "status": "learning",  # knowledge는 보유하면 학습 시작 상태로 간주
            "parent": f"subject-{k['subject_id']}",
        })
        links.append({
            "source": f"subject-{k['subject_id']}",
            "target": f"knowledge-{k['id']}",
            "kind": "satellite",
        })

    # chain: subject 간 순서 (같은 curriculum 안에서)
    by_curriculum: dict[int, list[dict]] = {}
    for s in subject_rows:
        by_curriculum.setdefault(s["curriculum_id"], []).append(s)
    for items in by_curriculum.values():
        items.sort(key=lambda x: (x["order_num"], x["id"]))
        for i in range(len(items) - 1):
            links.append({
                "source": f"subject-{items[i]['id']}",
                "target": f"subject-{items[i + 1]['id']}",
                "kind": "chain",
            })

    return {"nodes": nodes, "links": links}
