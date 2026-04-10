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
       (CLI/Git/Docker/SQL)  (PTY 안에서 동작.
                             MCP로 우리 백엔드와
                             직접 통신.)
```

## 외부 AI API 사용 안 함

Dojang은 OpenAI, Anthropic SDK 어느 것도 import하지 않는다. **모든 AI 호출은 Claude Code 세션 안에서 일어나며**, 백엔드는 그 세션과 다음 두 방식으로 통신한다:

1. **PTY 터미널** (`routers/terminal.py`) — `claude` 또는 `claude --resume <session-id>` 를 PTY로 spawn하고 WebSocket으로 입출력 중계. 사용자가 직접 대화하는 인터페이스.
2. **MCP stdio 서버** (`mcp_server/server.py`) — Claude Code 세션이 백엔드의 도구를 호출할 수 있게 해주는 통로. Claude가 도구를 호출하면 `tools.py`의 핸들러가 SQLite에 직접 INSERT/UPDATE를 실행한다.

## 핵심 데이터 흐름

### 터미널 세션 — PTY + tmux wrapping

모든 claude 세션은 `<TerminalPanel>` → `/ws/terminal` WebSocket → 백엔드의 PTY 로 이어진다. 그런데 **탭 전환이나 WS 재연결 사이에 세션이 살아남게 하려면** 백엔드·프론트엔드 양쪽에 지속성 메커니즘이 필요하다.

**(1) 백엔드 — tmux 래핑** (`routers/terminal.py`)

WS 쿼리 파라미터에 따라 다르게 spawn:

| 상황 | 쿼리 | tmux 세션 이름 |
|------|------|----------------|
| Sketch 탭의 per-sketch 터미널 | `?sketch_id=N` | `dojang-sketch-N` |
| Learn/Subjects/Explore 탭의 글로벌 dock | `?curriculum_id=N` | `dojang-curriculum-N` |
| 그 외 (sketch 도 curriculum 도 없는 경우) | — | tmux 없이 일반 claude 프로세스 |

첫 연결은 `tmux new-session` 으로 claude 를 감싸 띄우고, 같은 id 로 다시 연결되면 `tmux attach-session -d` 로 기존 세션에 붙는다. WS 가 끊기면 `tmux detach-client` 만 호출 — claude 프로세스는 tmux 서버 안에서 계속 돈다. 격리 소켓 `-L dojang` 을 써서 호스트 tmux 와 섞이지 않음. tmux 설정은 terminal.py 가 `data/tmux.conf` 에 자동 생성.

이게 의미하는 것:
- Sketch #2 에서 Claude 와 대화 → Sketch #1 로 이동 → Sketch #2 로 복귀 → **Sketch #2 의 tmux 세션에 재접속해서 이전 대화가 그대로**
- Learn 탭에서 FastAPI 커리큘럼으로 대화 → CLI 로 전환 → FastAPI 로 복귀 → FastAPI 용 tmux 세션에 재접속 → 이전 대화 그대로

`sketch_id` 가 우선되고 curriculum 은 보조 — Sketch 탭은 curriculum 무관.

**(2) 프론트엔드 — Always-mount 패턴** (`App.tsx`)

백엔드 tmux 가 세션을 살려둬도 프론트엔드 `<Sketch>` 나 글로벌 `<TerminalPanel>` 이 언마운트되면 xterm.js + WebSocket 이 dispose 돼서 사용자 눈에는 "세션이 꺼진" 것처럼 보인다. 그래서 두 컴포넌트는 **항상 DOM 에 마운트된 상태로 유지**하고 `display: none` 으로만 숨긴다 (`App.tsx` 의 `cn(..., currentView !== "sketch" && "hidden")` 패턴). 나머지 탭 (Home, Learn, Subjects, Explore, Guide) 는 조건부 렌더링 유지.

Sketch 는 언마운트 안 되므로 탭 재진입 시 `useEffect` 가 다시 안 돈다 → `isActive` prop (App 이 내려주는 `currentView === "sketch"`) 을 deps 에 넣어 재활성화 시 context 를 다시 쓰게 한다.

**(3) 스코프 전환 confirmation**

같은 탭 안에서 스코프 (`sketchId` / `curriculumId`) 가 바뀌면 `TerminalPanel` 의 effect 가 재실행돼서 현재 xterm + WS 가 dispose 된다 (이전 tmux 세션은 백엔드에 그대로 살아있지만, 프론트는 새 스코프로 재연결). 사용자 입장에서는 "현재 대화를 떠나는" 것이므로 확인이 필요하다:

- Sketch 탭: `TerminalPanel` 이 `onActiveChange(active)` 콜백으로 "claude WS 가 열려있다" 는 신호를 내보내고, Sketch 가 이걸 `terminalActive` state 로 받아서 다른 sketch 클릭/생성 시 `window.confirm`.
- Learn 탭: 사이드바의 topic/curriculum 변경은 store 의 `selectTopic` / `selectCurriculum` 을 거치는데, 이 액션들이 `globalDockActive` 를 체크하고 confirm. 초기 자동 선택이나 `createCurriculum` 직후 자동 이동처럼 confirm 이 불필요한 내부 호출은 `{ skipConfirm: true }` 옵션으로 bypass.

**(4) Sketch 의 `--resume` 추적**

`sketches.claude_session_id` 컬럼에 각 sketch 가 마지막으로 사용한 Claude Code 세션 uuid 를 저장해서 `claude --resume <uuid>` 로 복구한다. WS 연결 직후 백그라운드 워커 (`_detect_new_session`) 가 `~/.claude/projects/<encoded-cwd>/` 디렉토리를 폴링해서 새 `.jsonl` 파일을 잡아 DB 에 저장 — tmux 서버가 죽는 상황 (컨테이너 재시작) 의 안전망이다. Curriculum 스코프는 현재 resume 추적이 없어서 컨테이너가 살아있는 동안만 tmux 로 지속된다 (향후 개선 여지).

### Learner context — `data/current_context.md`

프론트엔드가 사용자의 현재 상태를 이 파일에 쓰면 Claude Code 세션이 `/app/CLAUDE.md` (자동 생성, 세션 시작 시 주입) 의 지시에 따라 읽어서 맥락을 파악한다. 포맷:

```
@curriculum:<이름> #<id> (topic: <토픽명>)
@sketch:<제목> #<id>
@exercise:<제목> #<id>
@knowledge:<제목> #<id>

> 드래그 선택한 인용 텍스트
```

여러 줄이 같이 있을 수 있다 — 예: `@curriculum:FastAPI 기초` 와 `@exercise:Depends 드릴 #105` 가 함께 있으면 "이 커리큘럼 안의 이 문제를 보고 있음". **Learn 탭에서 topic/curriculum 만 선택해도 `@curriculum:` ambient 라인이 항상 포함**되어 구체적인 exercise 를 클릭하지 않아도 Claude 가 "지금 어떤 커리큘럼 안에 있는지" 를 안다.

쓰는 지점은 store 의 `_syncContextFile`. `selectTopic` / `selectCurriculum` / `selectExercise` / `selectCard` + Sketch 탭의 current sketch 변경 시 호출. 탭 전환 시 `resetContext` 는 구체적 ref 만 비우고 ambient 커리큘럼은 살려서 재계산한다.

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
    └── {cli,git,docker,sql}/
        ├── Dockerfile
        ├── curriculum.json   # 시드: 과목 + 노트 + 실습
        └── knowledge.json    # 시드: 추가 노트
```

## 마이그레이션 패턴

`init_db()` 안에서 `ALTER TABLE ... ADD COLUMN` 들을 순서대로 try/except로 실행한다. 이미 컬럼이 있으면 예외가 나고 무시. 새 컬럼을 추가할 때는 이 리스트에 한 줄 추가만 하면 된다.

기본 cluster는 init_db 끝에서 보장된다. `is_default = 1` 행이 없으면 "기본값" 이라는 cluster를 INSERT하고, `cluster_id` 가 NULL인 모든 토픽을 거기에 할당한다.
