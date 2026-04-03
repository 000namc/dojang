# dojang

Practice anything in real sandboxed environments, guided by Claude Code.

```
┌──────────┬───────────────────┬──────────────┐
│ 커리큘럼  │  개념 / 실습       │ Claude Code  │
│ 사이드바  │  지식카드·에디터    │ Terminal     │
└──────────┴───────────────────┴──────────────┘
```

## What is this?

**dojang**(도장, training hall)은 개인 맞춤 학습 플랫폼입니다.

- **진짜 환경에서 연습** — 각 도메인(SQL, Git, CLI, Docker)마다 Docker 컨테이너가 있고, 거기서 실제 명령을 실행합니다
- **Claude Code가 튜터** — 앱 안에 Claude Code 세션이 내장되어 있어, 대화하면서 커리큘럼을 수정하고, 문제를 만들고, 피드백을 받습니다
- **개념과 실습이 하나의 흐름** — 토픽 안에 지식카드(📖)와 연습문제(✏️)가 함께 배치되어, 개념을 읽고 바로 실습합니다
- **체크포인트** — 커리큘럼 상태를 저장하고 언제든 이전 버전으로 돌아갈 수 있습니다
- **나만의 속도로** — 커리큘럼은 고정이 아닙니다. Claude와 대화하며 유기적으로 만들어갑니다
- **확장 가능** — 원하는 도메인을 직접 추가하고, 본인에게 필요한 커리큘럼을 완성해 나가세요

## Quick Start

```bash
git clone https://github.com/000namc/dojang.git && cd dojang
cd build && docker compose --profile prod up -d
```

Open **http://localhost:8010**

### Development (hot-reload)

```bash
cd build && docker compose up -d && cd ..     # domain containers only
uv sync && uv run uvicorn src.backend.main:app --port 8010 --reload
cd src/frontend && npm install && npm run dev  # http://localhost:5174
```

## Built-in Domains

| Domain | What you practice |
|--------|-------------------|
| **CLI** | bash, grep, sed, awk, find, jq |
| **Git** | branch, merge, rebase, conflict resolution |
| **Docker** | images, containers, Dockerfile, compose |
| **SQL** | SELECT, JOIN, GROUP BY, subqueries (MySQL) |

## How Claude Code works here

The right panel is a live Claude Code session connected via MCP. Claude can:

- Read your curriculum and progress
- Create new exercises on the fly
- Execute code in your sandbox containers
- Save knowledge cards into curriculum topics
- Modify the curriculum structure

All without separate API billing — it uses your existing Claude Code subscription.

## Unified Learning Flow

Each topic contains both **concepts** and **exercises** in a single view:

```
▼ 첫 걸음: 여기가 어디지?
  📖 터미널이란?
  📖 파일 시스템 구조
  ✏️ 현재 위치 확인          Lv.1
  ✏️ 파일 목록 보기          Lv.1
```

- Click a concept (📖) → read the knowledge card
- Click an exercise (✏️) → practice in the editor/terminal
- Save checkpoints → restore anytime

## Tech Stack

FastAPI · React · TypeScript · Tailwind · Monaco Editor · xterm.js · Zustand · SQLite · Docker · MCP

## Docs

- [Architecture](docs/architecture.md)
- [Domains & Adding your own](docs/domains.md)
- [MCP Tools](docs/mcp-tools.md)
- [Development](docs/development.md)
