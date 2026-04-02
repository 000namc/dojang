# dojang

Practice anything in real sandboxed environments, guided by Claude Code.

```
┌──────────┬───────────────────┬──────────────┐
│ 실습/탐구 │  에디터 + 결과     │ Claude Code  │
│ 사이드바  │  지식카드 뷰/편집  │ Terminal     │
└──────────┴───────────────────┴──────────────┘
```

## What is this?

**dojang**(도장, training hall)은 개인 맞춤 학습 플랫폼입니다.

- **진짜 환경에서 연습** — 각 도메인(SQL, Git, CLI, Docker)마다 Docker 컨테이너가 있고, 거기서 실제 명령을 실행합니다
- **Claude Code가 튜터** — 앱 안에 Claude Code 세션이 내장되어 있어, 대화하면서 커리큘럼을 수정하고, 문제를 만들고, 피드백을 받습니다
- **두 가지 모드** — *실습*은 문제를 풀고, *탐구*는 대화하며 지식을 정리합니다
- **나만의 속도로** — 커리큘럼은 고정이 아닙니다. Claude와 대화하며 유기적으로 만들어갑니다
- **확장 가능** — 원하는 도메인을 직접 추가하고, 본인에게 필요한 커리큘럼을 완성해 나가세요

## Quick Start

```bash
# 1. Clone
git clone <repo-url> dojang && cd dojang

# 2. Domain containers
cd build && docker compose up -d && cd ..

# 3. Backend
uv sync
uv run uvicorn src.backend.main:app --port 8010 --reload

# 4. Frontend (another terminal)
cd src/frontend && npm install && npm run dev
```

Open **http://localhost:5174**

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
- Save knowledge cards from conversations
- Modify the curriculum structure

All without separate API billing — it uses your existing Claude Code subscription.

## Modes

### Practice
Pick an exercise → write code in Monaco editor → run/submit → get instant feedback from real execution.

### Explore
Chat with Claude Code → discover concepts → save as knowledge cards → build your personal knowledge base.

## Tech Stack

FastAPI · React · TypeScript · Tailwind · Monaco Editor · xterm.js · Zustand · SQLite · Docker · MCP

## Docs

- [Architecture](docs/architecture.md)
- [Domains & Adding your own](docs/domains.md)
- [MCP Tools](docs/mcp-tools.md)
- [Development](docs/development.md)
