import json
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from src.backend.config import get_settings
from src.backend.database import init_db
from src.backend.seed import seed_if_empty
from src.backend.routers import topics, curriculum, exercises, terminal, knowledge, knowledge_graph, sketches, clusters


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    await init_db(settings.db_path)
    await seed_if_empty(settings.db_path)
    yield


app = FastAPI(title="Dojang", lifespan=lifespan)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(topics.router)
app.include_router(curriculum.router)
app.include_router(exercises.router)
app.include_router(terminal.router)
app.include_router(knowledge.router)
app.include_router(knowledge_graph.router)
app.include_router(sketches.router)
app.include_router(clusters.router)


@app.get("/health")
async def health():
    return {"status": "ok"}


NOTIFY_FILE = Path(__file__).parent.parent.parent / "data" / ".notify"
CONTEXT_FILE = Path(__file__).parent.parent.parent / "data" / "current_context.md"


@app.get("/api/notify")
async def get_notify(since: float = 0):
    """Poll endpoint — frontend checks if MCP server wrote a notification."""
    if NOTIFY_FILE.exists():
        try:
            data = json.loads(NOTIFY_FILE.read_text())
            if data.get("ts", 0) > since:
                return data
        except (json.JSONDecodeError, KeyError):
            pass
    return {"event": None, "ts": time.time()}


@app.get("/api/context")
async def get_context():
    if CONTEXT_FILE.exists():
        return {"content": CONTEXT_FILE.read_text()}
    return {"content": ""}


@app.put("/api/context")
async def put_context(body: dict):
    CONTEXT_FILE.parent.mkdir(parents=True, exist_ok=True)
    CONTEXT_FILE.write_text(body.get("content", ""))
    return {"status": "ok"}


# SPA fallback
static_dir = Path(__file__).parent.parent.parent / "static"
if static_dir.exists():
    app.mount("/assets", StaticFiles(directory=static_dir / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        file_path = static_dir / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(static_dir / "index.html")
