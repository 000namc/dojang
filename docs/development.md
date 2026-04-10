# Development

## 요구사항

- Docker

호스트에는 Python / Node / Claude Code CLI 를 깔지 않습니다. 모두 `dojang-app` 컨테이너 안에 들어 있고, 호스트는 docker 만 있으면 됨.

## 실행

```bash
cd build && docker compose up -d
```

- 앱: http://localhost:8010
- API docs: http://localhost:8010/docs

`src/backend/` 는 컨테이너에 bind mount + `uvicorn --reload` 라서 호스트에서 백엔드 코드를 편집하면 자동 반영됩니다. 별도 단계 없음.

프론트엔드는 두 가지 워크플로우 중 하나:

**(a) Vite dev server** — 자주 만질 때
```bash
cd src/frontend && npm install && npm run dev   # http://localhost:5173
```
`vite.config.ts` 가 `/api`, `/health`, `/ws` 를 8010 으로 프록시. 핫리로드 즉시 반영.

**(b) 로컬 빌드 + docker cp** — :8010 페이지를 그대로 쓰면서 빠르게 한 번만 반영하고 싶을 때
```bash
cd src/frontend && npm run build
docker cp dist/. dojang-app:/app/static/
```
컨테이너 안의 `/app/static` 은 이미지에서 COPY 된 것이라 bind mount 가 아니지만 `docker cp` 로 덮어쓰면 즉시 반영됨. 단 컨테이너를 재생성하면 (`compose down/up`, `--build`) 이미지의 원본 static 으로 롤백되므로 영구 반영하려면 `docker compose build app && docker compose up -d app`.

claude 자격증명은 컨테이너의 `/root/.claude` 가 호스트의 `${HOME}/.claude` 와 마운트되어 영속됩니다. macOS 는 keychain 자격증명이 마운트로 따라오지 않아서 첫 실행 시 한 번 컨테이너 안에서 로그인:
```bash
docker exec -it dojang-app claude /login
```

## 자동 생성되는 파일 두 가지

`src/backend/routers/terminal.py` 가 컨테이너 안에서 두 파일을 자동으로 만든다:

**`/app/CLAUDE.md`** — 컨테이너 안에서 도는 모든 Claude Code 세션이 시스템 프롬프트로 읽는다. `_CLAUDE_MD_CONTENT` 상수를 편집하면 새 세션부터 적용. **주의**: 기존 tmux 세션 (sketch / curriculum 둘 다) 안의 claude 는 spawn 시점에 이 파일을 한 번 읽고 자기 컨텍스트로 갖고 있으므로, 템플릿을 바꾼 뒤 효과를 보려면 **새 sketch 를 만들거나 (또는 `tmux -L dojang kill-session -t dojang-sketch-N`) tmux 세션을 죽여서 spawn 시점을 한번 더 발생시켜야** 한다.

**`/app/data/tmux.conf`** — sketch / curriculum 터미널이 tmux 로 wrap 될 때 쓰는 설정. `_TMUX_CONF` 상수에서 자동 생성. 키바인딩 전부 unbind 해서 투명 래퍼로 동작.

## 프로젝트 구조

```
dojang/
├── src/
│   ├── backend/                 # FastAPI
│   │   ├── main.py              # App entry, lifespan, SPA fallback
│   │   ├── config.py            # pydantic-settings (db_path/host/port만)
│   │   ├── database.py          # SQLite schema + 마이그레이션 + 기본 cluster
│   │   ├── models.py            # Pydantic 요청/응답
│   │   ├── seed.py              # build/{topic}/*.json → DB seeding
│   │   ├── tools.py             # MCP 도구 레지스트리
│   │   ├── routers/
│   │   │   ├── topics.py
│   │   │   ├── clusters.py
│   │   │   ├── curriculum.py
│   │   │   ├── exercises.py
│   │   │   ├── knowledge.py
│   │   │   ├── sketches.py
│   │   │   ├── knowledge_graph.py
│   │   │   └── terminal.py      # WebSocket PTY → claude CLI
│   │   ├── services/
│   │   │   └── container.py     # docker-py exec
│   │   └── mcp_server/
│   │       └── server.py        # stdio MCP 서버 진입점
│   └── frontend/                # React + Vite
│       └── src/
│           ├── pages/           # Home / Sketch / Learn / Subjects / Explore
│           ├── components/      # IconNav, TerminalPanel 등
│           ├── stores/          # store, sketches, theme
│           ├── api/client.ts
│           └── types/
├── build/                       # Docker + 도메인 시드
│   ├── docker-compose.yml
│   ├── app/Dockerfile
│   ├── cli/
│   ├── git/
│   ├── docker/
│   └── sql/
├── imgs/                        # README 스크린샷
├── docs/
├── data/                        # 런타임 (gitignored, .gitkeep만 커밋)
├── CLAUDE.md
├── README.md
└── pyproject.toml
```

## DB Schema

aiosqlite 직접 사용. 마이그레이션은 `init_db()` 안의 try/except ALTER 패턴.

```sql
clusters       (id, name, description, order_num, is_default, created_at)
topics         (id, name, description, container_name, cluster_id, default_curriculum_id)
curricula      (id, topic_id, name, description, is_default, session_id, created_at)
subjects       (id, curriculum_id, name, description, order_num, parent_id, created_at)
exercises      (id, subject_id, title, description, initial_code,
                check_type, check_value, difficulty, ui_type, created_by, created_at)
attempts       (id, exercise_id, user_code, result, is_correct, created_at)
knowledge      (id, notebook_id, topic_id, subject_id, title, content, tags,
                order_num, created_at, updated_at)
notebooks      (id, topic_id, name, description, is_default, created_at)
chat_sessions  (id, topic_id, title, created_at)
chat_messages  (id, session_id, role, content, created_at)
checkpoints    (id, curriculum_id, name, snapshot, created_at)
sketches       (id, title, content, claude_session_id, created_at, updated_at)
```

## API Endpoints

### Topics & Clusters
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/topics` | 토픽 목록 (cluster_id, default_curriculum_id 포함) |
| GET | `/api/topics/{id}` | 토픽 상세 |
| POST | `/api/topics` | 새 토픽 (자동으로 기본 cluster에 들어감) |
| PUT | `/api/topics/{id}` | 토픽 수정 (name/description/cluster_id/default_curriculum_id) |
| DELETE | `/api/topics/{id}` | 토픽 + 관련 모든 데이터 삭제 |
| GET | `/api/topics/{id}/stats` | curriculum/subject/exercise 카운트 |
| GET | `/api/clusters` | cluster 목록 (각 topic_count 포함) |
| POST | `/api/clusters` | cluster 생성 |
| PATCH | `/api/clusters/{id}` | cluster 수정 |
| DELETE | `/api/clusters/{id}` | cluster 삭제 (속한 토픽은 기본 cluster로 이동) |

### Curriculum / Subject / Exercise / Knowledge
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/topics/{id}/curricula` | 토픽의 커리큘럼 목록 |
| POST | `/api/topics/{id}/curricula` | 새 커리큘럼 |
| GET | `/api/curricula/{id}` | 커리큘럼 트리 |
| DELETE | `/api/curricula/{id}` | 커리큘럼 삭제 |
| POST | `/api/subjects` | subject 생성 |
| DELETE | `/api/subjects/{id}` | subject 삭제 |
| GET | `/api/exercises/{id}` | 연습 조회 |
| POST | `/api/exercises` | 연습 생성 |
| POST | `/api/exercises/{id}/attempt` | 답안 제출 + 채점 |
| POST | `/api/execute` | 컨테이너에서 코드 실행 |
| GET | `/api/knowledge` | 노트 목록 |
| POST | `/api/knowledge` | 노트 생성 |
| PATCH | `/api/knowledge/{id}` | 노트 수정 |
| DELETE | `/api/knowledge/{id}` | 노트 삭제 |

### Sketch
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/sketches` | sketch 목록 (preview 포함) |
| GET | `/api/sketches/{id}` | sketch 본문 |
| POST | `/api/sketches` | 새 sketch |
| PATCH | `/api/sketches/{id}` | 본문/제목/claude_session_id 수정 |
| DELETE | `/api/sketches/{id}` | 삭제 |

### Knowledge Graph (Explore)
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/knowledge-graph` | 별자리 노드/엣지 (각 토픽의 default_curriculum 안의 subject만) |

### 시스템
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/notify?since=` | 변경 폴링 |
| GET | `/api/context` | `data/current_context.md` 읽기 |
| PUT | `/api/context` | 학습 컨텍스트 업데이트 |
| GET | `/api/agents` | 사용 가능한 코딩 에이전트 (claude/opencode) 목록 |
| WS | `/ws/terminal?agent=claude&sketch_id=N` | Sketch 전용 PTY 세션 (tmux `dojang-sketch-N` 으로 wrap) |
| WS | `/ws/terminal?agent=claude&curriculum_id=N` | Learn dock 의 per-curriculum PTY 세션 (tmux `dojang-curriculum-N` 으로 wrap) |
| WS | `/ws/terminal?agent=claude` | 둘 다 없으면 tmux 없이 일반 claude 프로세스 |

## 외부 AI API 절대 import 금지

이 프로젝트는 **OpenAI / Anthropic SDK 어느 것도 사용하지 않는다.** 새 기능을 추가할 때 다음 import는 금지:

```python
from openai import ...     # ❌
from anthropic import ...  # ❌
```

대신 사용 가능한 통로:
1. **PTY 터미널** — `routers/terminal.py` 에서 `claude` CLI를 spawn해서 사용자가 직접 대화
2. **MCP 도구** — `tools.py`에 도구를 등록하면 Claude Code 세션이 호출 가능
3. **`subprocess`** — 진짜 필요하면 `claude -p "프롬프트"` one-shot 호출 (현재는 직접 사용 안 함)

## 새 도메인 추가

1. `build/{topic}/Dockerfile` 작성
2. `build/{topic}/curriculum.json` 작성 (subjects + exercises)
3. `build/{topic}/knowledge.json` (선택)
4. `build/docker-compose.yml` 에 서비스 추가
5. `src/backend/seed.py` 의 `topic_configs` 와 시드 로더 매핑에 추가
6. `cd build && docker compose build {topic}`
7. 새 부팅 시 자동 시드 (또는 기존 사용자라면 수동 추가)

자세한 형식은 [domains.md](domains.md) 참조.
