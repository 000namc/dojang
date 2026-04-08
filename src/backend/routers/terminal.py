"""WebSocket endpoint that spawns a coding agent CLI session (Claude Code or OpenCode) with MCP tools."""

import asyncio
import json
import os
import pty
import select
import shutil
import struct
import subprocess
import fcntl
import termios
from pathlib import Path

import aiosqlite
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from src.backend.config import get_settings
from src.backend.database import get_connection

router = APIRouter(tags=["terminal"])

PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
DATA_DIR = PROJECT_ROOT / "data"


def _claude_sessions_dir() -> Path:
    """Where Claude Code stores per-project session .jsonl files."""
    encoded = str(PROJECT_ROOT.resolve()).replace("/", "-")
    return Path.home() / ".claude" / "projects" / encoded


def _list_session_uuids() -> set[str]:
    d = _claude_sessions_dir()
    if not d.exists():
        return set()
    return {p.stem for p in d.glob("*.jsonl")}


async def _detect_new_session(
    pre: set[str],
    sketch_id: int,
    deadline_seconds: float = 8.0,
):
    """Poll the Claude sessions dir for a new .jsonl file and save its uuid to the sketch."""
    settings = get_settings()
    elapsed = 0.0
    while elapsed < deadline_seconds:
        await asyncio.sleep(0.5)
        elapsed += 0.5
        current = _list_session_uuids()
        new_ids = current - pre
        if new_ids:
            session_id = sorted(new_ids)[0]  # 보통 1개
            db = await get_connection(settings.db_path)
            try:
                await db.execute(
                    "UPDATE sketches SET claude_session_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND claude_session_id IS NULL",
                    (session_id, sketch_id),
                )
                await db.commit()
            finally:
                await db.close()
            return


async def _get_sketch_session(sketch_id: int) -> str | None:
    settings = get_settings()
    db = await get_connection(settings.db_path)
    try:
        cursor = await db.execute(
            "SELECT claude_session_id FROM sketches WHERE id = ?", (sketch_id,)
        )
        row = await cursor.fetchone()
        return row["claude_session_id"] if row else None
    finally:
        await db.close()


def _find_python() -> tuple[str, list[str]]:
    """Return (command, base_args) for running our MCP server."""
    venv_python = PROJECT_ROOT.resolve() / ".venv" / "bin" / "python"
    if venv_python.exists():
        return str(venv_python), ["-m", "src.backend.mcp_server.server"]
    return "uv", ["run", "python", "-m", "src.backend.mcp_server.server"]


def _ensure_claude_mcp_config() -> Path:
    """Generate Claude Code MCP config (mcpServers format)."""
    command, args = _find_python()
    config = {
        "mcpServers": {
            "dojang": {
                "command": command,
                "args": args,
                "cwd": str(PROJECT_ROOT.resolve()),
            }
        }
    }
    path = DATA_DIR / "mcp_config.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(config, indent=2))
    return path


def _ensure_opencode_config() -> Path:
    """Generate opencode.json in project root (mcp format for OpenCode)."""
    command, args = _find_python()
    config = {
        "mcp": {
            "dojang": {
                "type": "local",
                "command": [command, *args],
                "enabled": True,
            }
        }
    }
    path = PROJECT_ROOT / "opencode.json"
    path.write_text(json.dumps(config, indent=2))
    return path


def _build_spawn_command(agent: str, resume_session: str | None = None) -> list[str]:
    """Return the CLI command to spawn for the given agent type."""
    if agent == "opencode":
        _ensure_opencode_config()
        return ["opencode"]
    else:
        mcp_config = _ensure_claude_mcp_config()
        cmd = ["claude", "--mcp-config", str(mcp_config)]
        if resume_session:
            cmd += ["--resume", resume_session]
        return cmd


@router.get("/api/agents")
async def list_agents():
    """Return available agents and their install status."""
    agents = []
    for name, cmd in [("claude", "claude"), ("opencode", "opencode")]:
        agents.append({
            "id": name,
            "label": "Claude Code" if name == "claude" else "OpenCode",
            "installed": shutil.which(cmd) is not None,
        })
    return agents


@router.websocket("/ws/terminal")
async def terminal_websocket(
    ws: WebSocket,
    agent: str = Query(default="claude"),
    sketch_id: int | None = Query(default=None),
):
    await ws.accept()

    if agent not in ("claude", "opencode"):
        await ws.close(code=4000, reason=f"Unknown agent: {agent}")
        return

    # Per-sketch session tracking (claude only)
    resume_session: str | None = None
    pre_sessions: set[str] = set()
    detect_task: asyncio.Task | None = None
    if agent == "claude" and sketch_id is not None:
        resume_session = await _get_sketch_session(sketch_id)
        if resume_session is None:
            pre_sessions = _list_session_uuids()  # 새 세션이면 spawn 후 diff로 잡음

    cmd = _build_spawn_command(agent, resume_session=resume_session)
    binary = shutil.which(cmd[0])
    if not binary:
        await ws.send_bytes(f"\x1b[31m{agent} is not installed.\x1b[0m\r\n".encode())
        await ws.close(code=4001, reason=f"{agent} not found")
        return

    # Create PTY pair
    master_fd, slave_fd = pty.openpty()
    winsize = struct.pack("HHHH", 30, 120, 0, 0)
    fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)

    env = os.environ.copy()
    env["TERM"] = "xterm-256color"

    proc = subprocess.Popen(
        cmd,
        stdin=slave_fd,
        stdout=slave_fd,
        stderr=slave_fd,
        cwd=str(PROJECT_ROOT.resolve()),
        env=env,
        close_fds=True,
        start_new_session=True,
    )
    os.close(slave_fd)

    # 새 sketch 세션이면 백그라운드로 새 .jsonl 파일 감지해서 DB 업데이트
    if agent == "claude" and sketch_id is not None and resume_session is None:
        detect_task = asyncio.create_task(_detect_new_session(pre_sessions, sketch_id))

    loop = asyncio.get_event_loop()
    running = True

    async def read_pty():
        while running:
            try:
                readable = await loop.run_in_executor(
                    None, lambda: select.select([master_fd], [], [], 0.05)[0]
                )
                if readable:
                    data = os.read(master_fd, 16384)
                    if not data:
                        break
                    await ws.send_bytes(data)
            except (OSError, WebSocketDisconnect):
                break

    read_task = asyncio.create_task(read_pty())

    try:
        while True:
            msg = await ws.receive()

            if msg.get("type") == "websocket.disconnect":
                break

            if "text" in msg:
                data = json.loads(msg["text"])
                if data.get("type") == "resize":
                    cols = data.get("cols", 120)
                    rows = data.get("rows", 30)
                    winsize = struct.pack("HHHH", rows, cols, 0, 0)
                    fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)
                elif data.get("type") == "input":
                    os.write(master_fd, data["data"].encode())
            elif "bytes" in msg:
                os.write(master_fd, msg["bytes"])

    except WebSocketDisconnect:
        pass
    finally:
        running = False
        read_task.cancel()
        if detect_task and not detect_task.done():
            detect_task.cancel()
        try:
            proc.terminate()
            proc.wait(timeout=3)
        except Exception:
            proc.kill()
        try:
            os.close(master_fd)
        except OSError:
            pass
