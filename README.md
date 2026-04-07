# dojang

AI 튜터와 대화하며 배우는 개인 맞춤 학습 플랫폼.

```
┌────────┬─────────────────────────────────────┐
│ Home   │  무엇을 배워볼까요?                   │
│ Learn  │  [        입력창        ]             │
│ Topics │  🧭 학습  📦 Topics  🔍 탐색  ✨ 생성  │
│ Explore│                                      │
└────────┴─────────────────────────────────────┘
```

## What is this?

**dojang**(도장, training hall)은 AI 기반 개인 맞춤 학습 플랫폼입니다.

- **대화로 커리큘럼 생성** — "선형회귀 배우고 싶어"라고 말하면 AI가 커리큘럼을 설계하고, 노트와 실습을 자동 생성합니다
- **진짜 환경에서 연습** — 각 주제(CLI, Git, Docker, SQL)마다 Docker 컨테이너에서 실제 명령을 실행합니다
- **2단계 AI 아키텍처** — Claude Haiku가 커리큘럼을 설계하고, GPT-4.1 mini가 내용을 채웁니다
- **커뮤니티** — 만든 커리큘럼을 공유하고, 다른 사람의 커리큘럼을 fork/import할 수 있습니다
- **나만의 속도로** — 커리큘럼은 고정이 아닙니다. 대화하며 유기적으로 수정합니다

## Quick Start

```bash
git clone https://github.com/000namc/dojang.git && cd dojang
cp .env.example .env  # API 키 설정
cd build && docker compose --profile prod up -d
```

Open **http://localhost:8010**

### Development (hot-reload)

```bash
cd build && docker compose up -d && cd ..     # domain containers only
uv sync && uv run uvicorn src.backend.main:app --port 8010 --reload
cd src/frontend && npm install && npm run dev  # http://localhost:5174
```

### Environment Variables

```bash
OPENAI_API_KEY=sk-...        # GPT-4.1 mini (일반 대화)
ANTHROPIC_API_KEY=sk-ant-... # Claude Haiku 4.5 (커리큘럼 설계)
```

## Features

### 🏠 Home — 채팅 중심 홈 화면
대화로 시작합니다. 커리큘럼 생성, 학습 추천, 개념 탐색 모두 채팅으로.

### 🎓 Learn — 학습 뷰
커리큘럼 트리에서 노트(📖)와 실습(✏️)을 선택하고 학습합니다. 하단 AI 튜터에게 질문하면 실시간 커리큘럼 수정도 가능합니다.

### 📦 Topics — 주제 관리
학습 주제를 카드로 보고, 생성/편집/삭제합니다.

### 🔍 Explore — 커뮤니티
다른 사람의 커리큘럼을 탐색하고 upvote, fork할 수 있습니다.

## Curriculum Creation Flow

```
유저: "CLI 초보자 커리큘럼 만들어줘"
  ↓
GPT-4.1 mini: 확인 질문 (주제, 이름)
  ↓
Claude Haiku: 구조 설계 (토픽 + 노트/실습 목록)
  ↓
유저: 피드백 → mini가 수정 / 확인
  ↓
GPT-4.1 mini: 토픽 뼈대 생성
  ↓
Claude Haiku: 상세 가이드 생성
  ↓
GPT-4.1 mini: 토픽별 노트 + 실습 채우기
```

## Built-in Domains

| Domain | What you practice |
|--------|-------------------|
| **CLI** | bash, grep, sed, awk, find, jq |
| **Git** | branch, merge, rebase, conflict resolution |
| **Docker** | images, containers, Dockerfile, compose |
| **SQL** | SELECT, JOIN, GROUP BY, subqueries (MySQL) |

## Tech Stack

FastAPI · React 19 · TypeScript · Tailwind CSS · Monaco Editor · xterm.js · Zustand · SQLite · Docker · OpenAI API · Anthropic API

## Architecture

```
src/
├── backend/
│   ├── main.py              # FastAPI app
│   ├── tools.py             # Unified tool registry (MCP + OpenAI)
│   ├── services/
│   │   └── chat_engine.py   # GPT + Haiku streaming chat
│   └── routers/
│       ├── chat.py           # Session-based chat
│       ├── community.py      # Explore/marketplace
│       ├── curriculum.py     # Curriculum CRUD
│       └── ...
├── frontend/
│   ├── src/pages/
│   │   ├── Home.tsx          # Chat-first home
│   │   ├── Learn.tsx         # Curriculum + content
│   │   ├── Subjects.tsx      # Topic management
│   │   └── Community.tsx     # Explore/marketplace
│   └── src/components/
│       ├── IconNav.tsx       # Left navigation
│       ├── ChatDrawer.tsx    # Floating chat with tips
│       └── ...
└── build/
    ├── docker-compose.yml    # Full stack
    └── app/Dockerfile        # App image
```

## Docs

- [Architecture](docs/architecture.md)
- [Domains & Adding your own](docs/domains.md)
- [MCP Tools](docs/mcp-tools.md)
- [Development](docs/development.md)
