"""WebSocket endpoint that spawns a Claude Code CLI session with MCP tools."""

import asyncio
import json
import os
import pty
import select
import signal
import struct
import subprocess
import fcntl
import termios
from pathlib import Path

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["terminal"])

PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
MCP_CONFIG_PATH = PROJECT_ROOT / "data" / "mcp_config.json"


def ensure_mcp_config() -> Path:
    """Generate MCP config pointing to this project's venv and cwd."""
    project_root = PROJECT_ROOT.resolve()

    # Find python: prefer .venv, fall back to uv run
    venv_python = project_root / ".venv" / "bin" / "python"
    if venv_python.exists():
        command = str(venv_python)
    else:
        command = "uv"

    if command.endswith("uv"):
        args = ["run", "python", "-m", "src.backend.mcp_server.server"]
    else:
        args = ["-m", "src.backend.mcp_server.server"]

    config = {
        "mcpServers": {
            "dojang": {
                "command": command,
                "args": args,
                "cwd": str(project_root),
            }
        }
    }
    MCP_CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    MCP_CONFIG_PATH.write_text(json.dumps(config, indent=2))
    return MCP_CONFIG_PATH


@router.websocket("/ws/terminal")
async def terminal_websocket(ws: WebSocket):
    await ws.accept()

    mcp_config = ensure_mcp_config()

    # Create PTY pair
    master_fd, slave_fd = pty.openpty()

    # Set initial window size
    winsize = struct.pack("HHHH", 30, 120, 0, 0)
    fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)

    # Spawn claude via subprocess (not os.fork — safe in async context)
    env = os.environ.copy()
    env["TERM"] = "xterm-256color"

    proc = subprocess.Popen(
        ["claude", "--mcp-config", str(mcp_config)],
        stdin=slave_fd,
        stdout=slave_fd,
        stderr=slave_fd,
        env=env,
        close_fds=True,
        start_new_session=True,
    )
    os.close(slave_fd)

    loop = asyncio.get_event_loop()
    running = True

    async def read_pty():
        """Read from PTY master using select() and forward to WebSocket."""
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
        try:
            proc.terminate()
            proc.wait(timeout=3)
        except Exception:
            proc.kill()
        try:
            os.close(master_fd)
        except OSError:
            pass
