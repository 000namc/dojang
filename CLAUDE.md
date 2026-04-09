# Dojang

개인 학습 플랫폼. 학습자가 토픽별 Docker 컨테이너에서 실제 도구를 다루며 학습하고, **로컬에 설치된 Claude Code 세션**과 직접 대화하면서 자기만의 커리큘럼을 키워간다. 외부 AI API(OpenAI / Anthropic SDK)를 사용하지 않으며, 모든 AI 대화는 사용자 머신의 `claude` CLI를 통해 이루어진다.

## 구조

- `src/backend/` — FastAPI 백엔드. `from src.backend.xxx import` 형태로 import
- `src/frontend/` — React 19 + Vite + sigma.js
- `build/` — Docker 파일 + 도메인별 시드 데이터 (`{topic}/curriculum.json`, `knowledge.json`). 커밋 대상
- `docs/` — 상세 문서
- `data/` — 런타임 SQLite DB / sketch / 학습 이력. **개인 데이터, gitignored**
- `imgs/` — README용 스크린샷

## 데이터 정책

- **샘플 데이터**: `build/{cli,git,docker,sql}/curriculum.json` + `knowledge.json`. 레포에 커밋. 첫 부팅 시 `seed_if_empty()`가 빈 DB 감지 → 자동 시드.
- **개인 데이터**: `data/dojang.db`. **gitignored**. Docker는 named volume `dojang-data`로 영속화.
- **Claude Code 세션**: `~/.claude/projects/<encoded-cwd>/<uuid>.jsonl` — 사용자 home 디렉토리에 영속.
- **API 키**: Dojang은 외부 AI API를 호출하지 않으므로 키가 필요 없음. `claude` CLI 가 자체 인증 처리.

## 실행

```bash
cd build && docker compose up -d    # http://localhost:8010
```

`src/backend/` 가 컨테이너에 bind mount + `uvicorn --reload` 라 호스트에서 코드 바꾸면 자동 반영. `${HOME}/.claude` 도 컨테이너에 마운트되어 호스트 자격증명 / 세션 jsonl 이 그대로 공유됨 (macOS 는 keychain 이라서 첫 실행 시 `docker exec -it dojang-app claude /login` 한 번 필요).

프론트엔드를 자주 만지면 별도로 vite dev server:
```bash
cd src/frontend && npm run dev      # http://localhost:5173
```

## 탭별 역할

- **Home** — 짧은 인사 + 입력창. 입력 후 → 새 sketch 생성 + Sketch 탭으로 이동
- **Sketch** — 좌: sketch 목록 / 중: 마크다운 에디터 / 우: 이 sketch 전용 Claude Code 터미널 (per-sketch session, `claude --resume` 으로 재개)
- **Learn** — 커리큘럼 트리에서 노트/실습 선택 + 우측 글로벌 Claude Code 도크
- **Topics (Subjects.tsx)** — 좌: cluster 사이드바 / 우: 토픽 그리드. 새 토픽은 기본 cluster로 자동
- **Explore** — 별자리 시각화. sigma.js 위에 직접 그린 별 + 우주 배경. 4개 토픽이 cluster로 흩어짐. 단축키 1/2 라벨, 0 셔플, V/H 모드

## 학습 맥락

`data/current_context.md` 파일에 학습자가 현재 보고 있는 항목이 자동으로 기록된다. 작업을 시작하기 전에 이 파일을 읽으면 학습자의 현재 상황을 파악할 수 있다.

형식 예시:
```
@exercise:SELECT로 데이터 조회하기 #5

> users 테이블에서 나이가 30 이상인 행을 조회하세요
```
- `@exercise:제목 #id` / `@knowledge:제목 #id` — 학습자가 선택한 항목
- `> 인용문` — 학습자가 드래그해서 추가한 텍스트 (관심 포인트)
- MCP 도구 `get_exercise`, `get_knowledge`로 상세 내용을 가져올 수 있다

## 규칙

- 백엔드 포트: 8010, 프론트엔드 포트: 5173
- 백엔드는 항상 컨테이너 안에서 실행 (`docker compose up -d`). 호스트에 `uv sync` 같은 파이썬 의존성 설치 금지
- 도메인 컨테이너 (`dojang-cli` 등) 는 같은 compose 로 사이드카처럼 같이 뜸
- Python import는 항상 `from src.backend.xxx` 형태
- DB는 aiosqlite 직접 사용 (ORM 없음)
- 도메인 컨테이너 실행은 `docker-py`의 `container.exec_run()` 사용
- MCP 서버는 `python -m src.backend.mcp_server.server`로 실행 (stdio)
- 프론트엔드 상태관리는 Zustand (`stores/store.ts`, `stores/sketches.ts`, `stores/theme.ts`)
- 다크모드: Tailwind `dark:` 클래스 + `stores/theme.ts`
- 컴포넌트에 `className` prop 받아서 외부에서 크기/위치 제어
- MCP 도구가 데이터 변경 시 `_write_notify_file()` 호출 → 프론트 폴링으로 갱신
- **외부 AI SDK 절대 import 금지** — `from openai import ...`, `from anthropic import ...` 모두 금지. AI 대화는 `claude` CLI subprocess 또는 PTY 터미널 세션을 통해서만.

## 문서 인덱스

- [docs/architecture.md](docs/architecture.md) — 전체 아키텍처
- [docs/domains.md](docs/domains.md) — 도메인 구조, curriculum.json 형식
- [docs/mcp-tools.md](docs/mcp-tools.md) — MCP 도구 목록
- [docs/development.md](docs/development.md) — DB 스키마, API 엔드포인트
- [docs/deployment.md](docs/deployment.md) — 운영 가이드 (업데이트 / 백업 / 모니터링)
