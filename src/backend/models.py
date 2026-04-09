from pydantic import BaseModel


# --- Topic (was Domain) ---
class Topic(BaseModel):
    id: int
    name: str
    description: str | None = None
    container_name: str


# --- Subject (was Topic) ---
class ExerciseSummary(BaseModel):
    id: int
    title: str
    difficulty: int
    is_completed: bool = False


class Subject(BaseModel):
    id: int
    topic_id: int
    name: str
    description: str | None = None
    order_num: int
    parent_id: int | None = None
    children: list["Subject"] = []
    exercises: list[ExerciseSummary] = []
    progress: float = 0.0


class CurriculumTree(BaseModel):
    topic: Topic
    subjects: list[Subject]


# --- Exercise ---
class Exercise(BaseModel):
    id: int
    subject_id: int
    title: str
    description: str | None = None
    initial_code: str = ""
    check_type: str = "ai_check"
    check_value: str | None = None
    difficulty: int = 1
    created_by: str = "system"


class CreateExerciseRequest(BaseModel):
    subject_id: int
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
    topic_id: int
    code: str


class ExecuteResult(BaseModel):
    output: str
    error: str | None = None
    result_type: str  # "table" | "terminal" | "error"
    columns: list[str] | None = None
    rows: list[list[str]] | None = None


# --- Chat ---
class ChatContext(BaseModel):
    type: str  # "exercise" | "knowledge"
    exercise_id: int | None = None
    exercise_title: str | None = None
    exercise_description: str | None = None
    card_id: int | None = None
    card_title: str | None = None
    card_content: str | None = None


class ChatRequest(BaseModel):
    session_id: int | None = None
    topic_id: int | None = None  # 하위 호환
    message: str
    context: ChatContext | None = None


# --- Subject CRUD (was Topic CRUD) ---
class CreateSubjectRequest(BaseModel):
    curriculum_id: int
    name: str
    description: str = ""
    parent_id: int | None = None


class UpdateSubjectRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    order_num: int | None = None


# --- Topic CRUD (was Domain CRUD) ---
class CreateTopicRequest(BaseModel):
    name: str
    description: str = ""
    container_name: str = "dojang-generic"
    cluster_id: int | None = None


class UpdateTopicRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    cluster_id: int | None = None
    default_curriculum_id: int | None = None


# --- Cluster ---
class CreateClusterRequest(BaseModel):
    name: str
    description: str = ""


class UpdateClusterRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    order_num: int | None = None


# --- Sketch ---
class CreateSketchRequest(BaseModel):
    title: str = ""
    content: str = ""


class UpdateSketchRequest(BaseModel):
    title: str | None = None
    content: str | None = None
    claude_session_id: str | None = None


