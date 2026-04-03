from pydantic import BaseModel


# --- Domain ---
class Domain(BaseModel):
    id: int
    name: str
    description: str | None = None
    container_name: str


# --- Topic ---
class ExerciseSummary(BaseModel):
    id: int
    title: str
    difficulty: int
    is_completed: bool = False


class Topic(BaseModel):
    id: int
    domain_id: int
    name: str
    description: str | None = None
    order_num: int
    parent_id: int | None = None
    children: list["Topic"] = []
    exercises: list[ExerciseSummary] = []
    progress: float = 0.0


class CurriculumTree(BaseModel):
    domain: Domain
    topics: list[Topic]


# --- Exercise ---
class Exercise(BaseModel):
    id: int
    topic_id: int
    title: str
    description: str | None = None
    initial_code: str = ""
    check_type: str = "ai_check"
    check_value: str | None = None
    difficulty: int = 1
    created_by: str = "system"


class CreateExerciseRequest(BaseModel):
    topic_id: int
    title: str
    description: str = ""
    initial_code: str = ""
    check_type: str = "ai_check"
    check_value: str = ""
    difficulty: int = 1
    ui_type: str = "auto"


# --- Attempt ---
class AttemptRequest(BaseModel):
    user_code: str


class AttemptResult(BaseModel):
    id: int
    is_correct: bool
    result: str
    feedback: str | None = None


# --- Execution ---
class ExecuteRequest(BaseModel):
    domain_id: int
    code: str


class ExecuteResult(BaseModel):
    output: str
    error: str | None = None
    result_type: str  # "table" | "terminal" | "error"
    columns: list[str] | None = None
    rows: list[list[str]] | None = None


# --- Chat ---
class ChatRequest(BaseModel):
    domain_id: int
    message: str


# --- Topic CRUD ---
class CreateTopicRequest(BaseModel):
    curriculum_id: int
    name: str
    description: str = ""
    parent_id: int | None = None


class UpdateTopicRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    order_num: int | None = None
