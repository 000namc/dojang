"""Coding agent — Claude Code CLI에 프로젝트 맥락을 주입하여 인프라 작업을 수행합니다."""

import asyncio
import json
import sqlite3
import tempfile
from collections.abc import AsyncGenerator
from pathlib import Path


PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
MCP_CONFIG_PATH = PROJECT_ROOT / "data" / "mcp_config.json"
DB_PATH = PROJECT_ROOT / "data" / "dojang.db"
CLAUDE_MD_PATH = PROJECT_ROOT / "CLAUDE.md"


def _ensure_mcp_config() -> Path:
    project_root = PROJECT_ROOT.resolve()
    venv_python = project_root / ".venv" / "bin" / "python"
    if venv_python.exists():
        command = str(venv_python)
        args = ["-m", "src.backend.mcp_server.server"]
    else:
        command = "uv"
        args = ["run", "python", "-m", "src.backend.mcp_server.server"]

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


def _get_current_topics() -> str:
    try:
        db = sqlite3.connect(str(DB_PATH))
        db.row_factory = sqlite3.Row
        rows = db.execute("SELECT name, description, container_name FROM topics").fetchall()
        db.close()
        return "\n".join(f"- {r['name']} ({r['container_name']}): {r['description']}" for r in rows)
    except Exception:
        return "(DB 조회 실패)"


def _build_system_context() -> str:
    project_root = PROJECT_ROOT.resolve()
    claude_md = CLAUDE_MD_PATH.read_text() if CLAUDE_MD_PATH.exists() else ""
    topics = _get_current_topics()

    return f"""# Dojang 프로젝트 맥락

## 프로젝트 루트
{project_root}

## CLAUDE.md
{claude_md}

## 현재 등록된 주제(토픽)
{topics}

## DB
- 경로: {DB_PATH}
- SQLite. 주제 테이블:
  CREATE TABLE topics (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, description TEXT, container_name TEXT NOT NULL)

## Docker 구조
- build/ 디렉토리에 주제별 폴더 (cli/, git/, docker/, sql/)
- 각 폴더에 Dockerfile
- build/docker-compose.yml에 모든 서비스 정의

## 새 주제 추가 절차
1. DB에 주제 추가: sqlite3 {DB_PATH} "INSERT INTO topics (name, description, container_name) VALUES ('이름', '설명', 'dojang-이름');"
2. 이미 있는 컨테이너를 재활용할 수 있으면 재활용 (예: Python → dojang-cli에 python3 이미 있음)
3. 필요하면 build/이름/Dockerfile 생성 + docker-compose.yml에 서비스 추가

## 중요
- 작업 후 반드시 결과를 설명해줘
- 간결하게 핵심만 수행해
"""


async def stream_coding_agent(task: str, context: str = "") -> AsyncGenerator[dict, None]:
    """Claude Code CLI를 stream-json --verbose 모드로 실행. 중간 로그 실시간 전달.

    Yields:
        {"type": "log", "message": "..."} — 중간 진행 상황
        {"type": "result", "content": "..."} — 최종 결과
        {"type": "error", "message": "..."} — 에러
    """
    mcp_config = _ensure_mcp_config()
    system_context = _build_system_context()

    prompt = task
    if context:
        prompt = f"{context}\n\n작업: {task}"

    with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
        f.write(system_context)
        context_file = f.name

    cmd = [
        "claude",
        "-p", prompt,
        "--mcp-config", str(mcp_config),
        "--append-system-prompt-file", context_file,
        "--dangerously-skip-permissions",
        "--model", "claude-sonnet-4-20250514",
        "--output-format", "stream-json",
        "--verbose",
    ]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(PROJECT_ROOT.resolve()),
        )

        while True:
            line = await proc.stdout.readline()
            if not line:
                break

            text = line.decode().strip()
            if not text:
                continue

            try:
                event = json.loads(text)
            except json.JSONDecodeError:
                continue

            msg_type = event.get("type", "")

            if msg_type == "assistant":
                # Parse content blocks
                content = event.get("message", {}).get("content", [])
                if isinstance(content, list):
                    for block in content:
                        block_type = block.get("type", "")
                        if block_type == "text":
                            txt = block.get("text", "")
                            if txt:
                                yield {"type": "log", "message": txt[:300]}
                        elif block_type == "tool_use":
                            name = block.get("name", "")
                            yield {"type": "log", "message": f"🔧 {name}"}

            elif msg_type == "user":
                # Tool result
                tool_result = event.get("tool_use_result", {})
                stdout = tool_result.get("stdout", "")
                if stdout:
                    yield {"type": "log", "message": f"→ {stdout[:200]}"}

            elif msg_type == "result":
                result_text = event.get("result", "")
                cost = event.get("total_cost_usd", 0)
                yield {"type": "log", "message": f"완료 (${cost:.4f})"}
                yield {"type": "result", "content": result_text}
                return

        await proc.wait()
        yield {"type": "result", "content": "작업이 완료되었습니다."}

    except FileNotFoundError:
        yield {"type": "error", "message": "claude CLI를 찾을 수 없습니다."}
    finally:
        Path(context_file).unlink(missing_ok=True)
