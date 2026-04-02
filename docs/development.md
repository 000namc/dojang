# Development

## 요구사항

- Python 3.13+, uv
- Node.js 20+
- Docker
- Claude Code CLI (`claude`)

## 실행

```bash
# 1. 도메인 컨테이너
cd build && docker compose up -d && cd ..

# 2. 백엔드
uv sync
uv run uvicorn src.backend.main:app --port 8010 --reload

# 3. 프론트엔드 (다른 터미널)
cd src/frontend && npm install && npm run dev
```

- 앱: http://localhost:5174
- API docs: http://localhost:8010/docs

## 프로젝트 구조

```
dojang/
├── src/
│   ├── backend/                # FastAPI
│   │   ├── main.py             # App entry, lifespan, SPA fallback
│   │   ├── config.py           # pydantic-settings
│   │   ├── database.py         # SQLite schema + connection
│   │   ├── models.py           # Pydantic request/response
│   │   ├── seed.py             # curriculum.json → DB seeding
│   │   ├── routers/
│   │   │   ├── domains.py
│   │   │   ├── curriculum.py
│   │   │   ├── exercises.py
│   │   │   ├── knowledge.py
│   │   │   └── terminal.py     # WebSocket PTY → claude CLI
│   │   ├── services/
│   │   │   └── container.py    # Docker exec
│   │   └── mcp_server/
│   │       └── server.py       # MCP 도구 (Claude Code용)
│   └── frontend/               # React + Vite
│       └── src/
│           ├── pages/
│           ├── components/
│           ├── stores/
│           ├── api/
│           └── types/
├── build/                      # Docker
│   ├── docker-compose.yml
│   ├── cli/
│   ├── git/
│   ├── docker/
│   └── sql/
├── docs/
├── data/                       # 런타임 (gitignored)
├── CLAUDE.md
└── pyproject.toml
```

## DB Schema

```sql
domains     (id, name, description, container_name)
topics      (id, domain_id, name, description, order_num, parent_id)
exercises   (id, topic_id, title, description, initial_code, check_type, check_value, difficulty, created_by)
attempts    (id, exercise_id, user_code, result, is_correct, created_at)
knowledge   (id, domain_id, title, content, tags, created_at, updated_at)
chat_messages (id, domain_id, role, content, created_at)
```

## API Endpoints

| Method | Path | 설명 |
|--------|------|------|
| GET | /api/domains | 도메인 목록 |
| GET | /api/domains/:id/curriculum | 커리큘럼 트리 |
| POST | /api/topics | 토픽 생성 |
| PUT | /api/topics/:id | 토픽 수정 |
| GET | /api/exercises/:id | 연습문제 조회 |
| POST | /api/exercises | 연습문제 생성 |
| POST | /api/exercises/:id/attempt | 답안 제출 |
| POST | /api/execute | 코드 실행 |
| GET | /api/knowledge | 지식카드 목록 |
| POST | /api/knowledge | 지식카드 생성 |
| PUT | /api/knowledge/:id | 지식카드 수정 |
| DELETE | /api/knowledge/:id | 지식카드 삭제 |
| GET | /api/notify?since= | 변경 폴링 |
| WS | /ws/terminal | Claude Code PTY |
