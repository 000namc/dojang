import json

from fastapi import APIRouter, Depends, HTTPException

import aiosqlite

from src.backend.config import Settings, get_settings
from src.backend.database import get_connection
from src.backend.models import CreateExerciseRequest, AttemptRequest, ExecuteRequest
from src.backend.services.container import ContainerService

router = APIRouter(prefix="/api", tags=["exercises"])

_container: ContainerService | None = None


def get_container() -> ContainerService:
    global _container
    if _container is None:
        _container = ContainerService()
    return _container


async def get_db(settings: Settings = Depends(get_settings)):
    db = await get_connection(settings.db_path)
    try:
        yield db
    finally:
        await db.close()


@router.get("/exercises/{exercise_id}")
async def get_exercise(exercise_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        "SELECT e.id, e.topic_id, e.title, e.description, e.initial_code, e.check_type, e.check_value, e.difficulty, e.ui_type, e.created_by, "
        "d.name as domain_name "
        "FROM exercises e JOIN topics t ON e.topic_id = t.id "
        "JOIN curricula c ON t.curriculum_id = c.id "
        "JOIN domains d ON c.domain_id = d.id WHERE e.id = ?",
        (exercise_id,),
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(404, "Exercise not found")
    return dict(row)


@router.post("/exercises")
async def create_exercise(
    req: CreateExerciseRequest, db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute(
        "INSERT INTO exercises (topic_id, title, description, initial_code, check_type, check_value, difficulty, ui_type, created_by) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ai')",
        (req.topic_id, req.title, req.description, req.initial_code, req.check_type, req.check_value, req.difficulty, req.ui_type),
    )
    await db.commit()
    return {"id": cursor.lastrowid, "title": req.title}


@router.post("/exercises/{exercise_id}/attempt")
async def submit_attempt(
    exercise_id: int,
    req: AttemptRequest,
    db: aiosqlite.Connection = Depends(get_db),
    container: ContainerService = Depends(get_container),
):
    # Load exercise + domain
    cursor = await db.execute(
        "SELECT e.*, d.name as domain_name, d.container_name "
        "FROM exercises e JOIN topics t ON e.topic_id = t.id "
        "JOIN curricula c ON t.curriculum_id = c.id "
        "JOIN domains d ON c.domain_id = d.id WHERE e.id = ?",
        (exercise_id,),
    )
    exercise = await cursor.fetchone()
    if not exercise:
        raise HTTPException(404, "Exercise not found")

    exercise = dict(exercise)

    # Execute user code
    result = _execute_in_domain(container, exercise["domain_name"], exercise["container_name"], req.user_code)

    # Check correctness
    is_correct = False
    if exercise["check_type"] == "query_match" and exercise["check_value"]:
        expected = container.execute_sql(exercise["container_name"], exercise["check_value"])
        is_correct = result.get("rows") == expected.get("rows")
    elif exercise["check_type"] == "output_match" and exercise["check_value"]:
        is_correct = result.get("output", "").strip() == exercise["check_value"].strip()
    elif exercise["check_type"] == "script_check" and exercise["check_value"]:
        check_result = _execute_in_domain(container, exercise["domain_name"], exercise["container_name"], exercise["check_value"])
        is_correct = check_result.get("error") is None
    # ai_check: will be handled by Claude in chat

    cursor = await db.execute(
        "INSERT INTO attempts (exercise_id, user_code, result, is_correct) VALUES (?, ?, ?, ?)",
        (exercise_id, req.user_code, json.dumps(result), int(is_correct)),
    )
    await db.commit()

    return {
        "id": cursor.lastrowid,
        "is_correct": is_correct,
        "result": json.dumps(result),
        "feedback": None,
    }


@router.post("/execute")
async def execute_code(
    req: ExecuteRequest,
    db: aiosqlite.Connection = Depends(get_db),
    container: ContainerService = Depends(get_container),
):
    cursor = await db.execute(
        "SELECT name, container_name FROM domains WHERE id = ?", (req.domain_id,)
    )
    domain = await cursor.fetchone()
    if not domain:
        raise HTTPException(404, "Domain not found")

    domain = dict(domain)
    return _execute_in_domain(container, domain["name"], domain["container_name"], req.code)


def _execute_in_domain(container: ContainerService, domain_name: str, container_name: str, code: str) -> dict:
    if domain_name == "SQL":
        return container.execute_sql(container_name, code)
    elif domain_name == "Git":
        return container.execute_git(container_name, code)
    else:
        return container.execute_shell(container_name, code)
