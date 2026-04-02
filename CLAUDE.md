# Dojang

개인 맞춤 학습 플랫폼. 도메인별 Docker 컨테이너에서 실제 도구를 실행하며 학습하고, Claude Code 세션과 대화하며 커리큘럼을 유기적으로 만들어간다.

## 구조

- `src/backend/` — FastAPI 백엔드. `from src.backend.xxx import` 형태로 import
- `src/frontend/` — React + Vite. `cd src/frontend && npm run dev`
- `build/` — Docker 파일. `cd build && docker compose up -d`
- `docs/` — 상세 문서 (아래 인덱스 참조)
- `data/` — 런타임 SQLite DB + notify 파일 (gitignored)

## 실행

```bash
# 프로덕션 (한 줄)
docker compose up -d    # http://localhost:8010

# 개발 (hot-reload)
cd build && docker compose up -d && cd ..     # 도메인 컨테이너만
uv run uvicorn src.backend.main:app --port 8010 --reload
cd src/frontend && npm run dev                # http://localhost:5174
```

## 문서 인덱스

- [docs/architecture.md](docs/architecture.md) — 전체 아키텍처, 데이터 흐름, 기술 스택
- [docs/domains.md](docs/domains.md) — 도메인 구조, curriculum.json 형식, 새 도메인 추가법
- [docs/mcp-tools.md](docs/mcp-tools.md) — MCP 도구 목록과 파라미터
- [docs/development.md](docs/development.md) — 프로젝트 구조, DB 스키마, API 엔드포인트

## 규칙

- 백엔드 포트: 8010, 프론트엔드 포트: 5174
- uvicorn 실행: `uv run uvicorn src.backend.main:app`
- Python import는 항상 `from src.backend.xxx` 형태
- DB는 aiosqlite 직접 사용 (ORM 없음)
- 도메인 컨테이너 실행은 `docker-py`의 `container.exec_run()` 사용
- MCP 서버는 `python -m src.backend.mcp_server.server`로 실행 (stdio)
- 프론트엔드 상태관리는 Zustand 단일 스토어 (`stores/store.ts`)
- 다크모드: Tailwind `dark:` 클래스 + `stores/theme.ts`
- 컴포넌트에 `className` prop 받아서 외부에서 크기/위치 제어
- MCP 도구가 데이터 변경 시 `_write_notify_file()` 호출 → 프론트 폴링으로 갱신
