# Architecture

## Overview

Dojang은 **외부 AI API에 의존하지 않는다.** 모든 AI 대화는 사용자 머신에 설치된 `claude` CLI를 PTY로 spawn해서 처리한다. 백엔드는 FastAPI + SQLite, 프론트엔드는 React + Vite + sigma.js.

```
┌──────────┬─────────────────────┬─────────────────┐
│ IconNav  │  Page (Home/Sketch  │ Claude Code     │
│ (탭)     │   /Learn/Topics/    │ Terminal        │
│          │   Explore)          │ (xterm.js)      │
└──────────┴─────────────────────┴─────────────────┘
     ↕ REST/WS                       ↕ WebSocket → PTY
┌────────────────── FastAPI ────────────────────────┐
│ routers/                                          │
│   topics, clusters, curriculum, exercises,        │
│   knowledge, sketches, knowledge_graph, terminal  │
│ services/container.py    (docker-py exec)         │
│ mcp_server/server.py     (MCP stdio)              │
│ database.py              (aiosqlite, 마이그레이션) │
│ seed.py                  (build/{topic}/*.json)   │
└────────────┬────────────────────┬─────────────────┘
             ↓                    ↓
       Domain Containers     Claude Code CLI
       (CLI/Git/Docker/      (PTY 안에서 동작.
        SQL/Python)          MCP로 우리 백엔드와
                             직접 통신.)
```

## 외부 AI API 사용 안 함

Dojang은 OpenAI, Anthropic SDK 어느 것도 import하지 않는다. **모든 AI 호출은 Claude Code 세션 안에서 일어나며**, 백엔드는 그 세션과 다음 두 방식으로 통신한다:

1. **PTY 터미널** (`routers/terminal.py`) — `claude` 또는 `claude --resume <session-id>` 를 PTY로 spawn하고 WebSocket으로 입출력 중계. 사용자가 직접 대화하는 인터페이스.
2. **MCP stdio 서버** (`mcp_server/server.py`) — Claude Code 세션이 백엔드의 도구를 호출할 수 있게 해주는 통로. Claude가 도구를 호출하면 `tools.py`의 핸들러가 SQLite에 직접 INSERT/UPDATE를 실행한다.

## 핵심 데이터 흐름

### Sketch 모드 (per-sketch claude 세션)
1. 사용자가 Home에서 입력 → 새 sketch 생성 → Sketch 탭으로 이동
2. Sketch 탭이 열리면 우측 터미널이 `WS /ws/terminal?sketch_id=N` 으로 연결
3. 백엔드가 sketch의 `claude_session_id` 조회. 없으면 `claude` 새로 spawn, 있으면 `claude --resume <id>`
4. 새 세션이면 백그라운드 워커가 `~/.claude/projects/<hash>/` 디렉토리를 폴링해서 새로 생긴 .jsonl 파일의 UUID를 찾아 DB에 저장 → 다음 번 열기에서 resume 가능
5. 사용자가 터미널에서 Claude와 대화. 좌측 에디터의 마크다운 노트는 별도로 SQLite에 저장.

### Learn 모드 (글로벌 claude 세션)
1. Learn 탭의 우측 터미널은 `sketch_id` 없이 `WS /ws/terminal` 연결
2. 한 번 spawn된 claude 세션이 탭 전환에도 살아있음 (`App.tsx`의 글로벌 `<TerminalPanel>`)
3. Claude가 학습자 컨텍스트(`data/current_context.md`) 와 MCP 도구로 학습 카드를 생성/수정

### Curriculum / Knowledge 변경
1. Claude Code가 MCP 도구 호출 (`add_subject`, `create_exercise`, `save_knowledge`, `create_curriculum` 등)
2. 핸들러가 SQLite에 직접 쓰고 `_write_notify_file()`로 `data/.notify` 에 이벤트 기록
3. 프론트엔드가 `/api/notify`를 폴링해서 새 이벤트 감지 → 관련 데이터 reload

### 별자리 (Explore)
1. `GET /api/knowledge-graph` → 토픽의 default_curriculum 안의 subject + 위성(knowledge/exercise) 노드와 엣지 반환
2. 프론트에서 토픽별로 사전 정의된 별자리(Orion, Big Dipper 등) stick figure에 subject를 매핑
3. sigma.js로 노드/엣지 렌더 + canvas 오버레이로 별 glow + 깜빡임
4. 별 클릭 시 NodeSheet 표시, 토픽 드래그 시 BFS로 자석 효과

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | FastAPI, aiosqlite, docker-py, MCP SDK |
| Frontend | React 19, Vite, TypeScript, Tailwind, Zustand |
| Visualization | sigma.js, graphology, canvas 2D 오버레이 |
| Editor | Monaco Editor |
| Terminal | xterm.js + WebSocket → PTY → claude CLI |
| AI | **Claude Code CLI** (외부 API 없음) |
| Sandbox | Docker 컨테이너 (도메인별) |
| DB | SQLite (aiosqlite, 마이그레이션은 init_db에서 ALTER) |

## 주요 디렉토리

```
src/
├── backend/
│   ├── main.py               # FastAPI app + lifespan
│   ├── config.py             # Settings (db_path/host/port만)
│   ├── database.py           # SCHEMA + 마이그레이션 + 기본 cluster 보장
│   ├── seed.py               # 빈 DB일 때 build/{topic}/*.json 시드
│   ├── tools.py              # MCP 도구 레지스트리
│   ├── models.py             # Pydantic 요청/응답 모델
│   ├── mcp_server/server.py  # stdio MCP 서버 진입점
│   ├── services/container.py # 도메인 컨테이너 exec helper
│   └── routers/
│       ├── topics.py          # Topic CRUD
│       ├── clusters.py        # Topic cluster CRUD
│       ├── curriculum.py      # Curriculum CRUD
│       ├── exercises.py       # Exercise + attempt
│       ├── knowledge.py       # Knowledge cards
│       ├── sketches.py        # Sketch CRUD
│       ├── knowledge_graph.py # Explore 별자리 데이터
│       └── terminal.py        # PTY → claude CLI WebSocket
├── frontend/
│   ├── src/pages/            # Home, Sketch, Learn, Subjects, Explore
│   ├── src/components/       # IconNav, TerminalPanel, ExercisePanel 등
│   ├── src/stores/           # store(공용), sketches, theme
│   └── src/api/client.ts     # axios wrapper
└── build/
    ├── docker-compose.yml
    ├── app/Dockerfile
    └── {cli,git,docker,sql,python}/
        ├── Dockerfile
        ├── curriculum.json   # 시드: 과목 + 노트 + 실습
        └── knowledge.json    # 시드: 추가 노트
```

## 마이그레이션 패턴

`init_db()` 안에서 `ALTER TABLE ... ADD COLUMN` 들을 순서대로 try/except로 실행한다. 이미 컬럼이 있으면 예외가 나고 무시. 새 컬럼을 추가할 때는 이 리스트에 한 줄 추가만 하면 된다.

기본 cluster는 init_db 끝에서 보장된다. `is_default = 1` 행이 없으면 "기본값" 이라는 cluster를 INSERT하고, `cluster_id` 가 NULL인 모든 토픽을 거기에 할당한다.
