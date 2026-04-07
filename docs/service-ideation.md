# 서비스화 아이데이션 (2026-04-03)

## 목표

Google NotebookLM처럼 패키징된 앱/서비스로 만들기. 로컬 Docker 빌드 의존 탈피.

## 현재 구조의 서비스화 장벽

1. **Claude Code CLI 의존** — 로컬 설치 + 사용자 API 키 필요
2. **로컬 Docker** — 도메인별 컨테이너를 사용자 머신에서 실행
3. **SQLite** — 단일 사용자 전제

## 서비스화 방향

### A. Desktop App (Tauri/Electron)

- 현재 구조 거의 그대로 패키징
- Docker Desktop 여전히 필요 → 일반 사용자 진입장벽
- AI: API 직접 호출 에이전트 내장

### B. Web SaaS (선호)

- 프론트: Vercel/Cloudflare
- API 서버: Cloud Run / Fly.io
- 샌드박스: E2B 또는 Fly Machines (로컬 Docker 대체)
- AI: 오픈소스 에이전트 + GPT API
- DB: SQLite → Postgres/Turso

### C. Hybrid

- 실행은 로컬 Docker 또는 WebContainer (브라우저 내)
- AI는 클라우드 API

## AI 에이전트 선택

Claude Code CLI 대체를 위한 오픈소스 에이전트.

### 1순위: OpenHands SDK

- Python 네이티브 → FastAPI에 직접 import 가능
- Docker 샌드박스 내장 → 현재 도메인 컨테이너 구조와 일치
- SWE-Bench 72% (에이전트 품질 검증됨)
- MIT 라이선스
- REST/WebSocket API 제공

### 2순위: Goose (Block)

- HTTP 서버로 사이드카 운영 → FastAPI에서 HTTP 호출
- MCP 깊이 통합 → 현재 MCP 도구 구조와 궁합 좋음
- Rust 기반, Apache 2.0
- Slackbot 예제로 in-process 임베딩 증명됨

### 기타 검토

- **OpenCode (SST)**: TypeScript SDK + REST + SSE + UI 컴포넌트. Bun 의존이 걸림. ~120K stars.
- **Cline Core**: gRPC API. standalone 아직 초기.
- **Aider**: 임베딩 불가 (비공식 API, MCP 없음). 탈락.

## AI 모델 전략

GPT-4.1을 기본 엔진으로, 모델 계층화:

| 작업 유형 | 모델 | 비용 (1M tok) |
|----------|------|--------------|
| 간단한 도구 호출 (조회, 진도) | GPT-4.1 mini | In $0.40 / Out $1.60 |
| 문제 생성, 코드 판단, 지식카드 | GPT-4.1 | In $2 / Out $8 |
| 복잡한 탐구 대화 (선택적) | Claude Sonnet / GPT-4.1 | In $3 / Out $15 |

## 비용 추정

### 세션당 (30분, 30턴)

- GPT-4.1 mini: ~$0.09
- GPT-4.1: ~$0.43
- Claude Sonnet: ~$0.72

### 규모별 월 총비용

| 규모 | AI API | Sandbox | 인프라 | 합계 |
|------|--------|---------|-------|------|
| 개인 (월 20세션) | $1.8 | $1.6 | $5 | ~$8 |
| 소규모 (유저 50, 월 1K세션) | $50~100 | $5~80 | $20 | $75~200 |
| 중규모 (유저 500, 월 10K세션) | $500~1K | $200~800 | $50~100 | $750~1,900 |

## 과금 모델 참고: NotebookLM

| 티어 | 가격 | 내용 |
|------|------|------|
| Free | $0 | 노트북 100개, 소스 50개, 일일 캡 |
| Plus | $20/월 | Google One AI Premium 번들. 5배 사용량 |
| Enterprise | Workspace 포함 | 별도 비용 없음 |

Dojang에 적용 시 $20/월 구독이면:
- GPT-4.1 mini 기준 ~220세션/월 (하루 7세션) 제공 가능
- 혼합 (mini 80% + 4.1 20%) → ~120세션/월 (하루 4세션)
- 무료 티어 (일 2-3세션 제한) + $20 유료 모델이 현실적

## 로드맵 (안)

1. **AI 에이전트 내재화** — Claude Code CLI → OpenHands/Goose + GPT API. 채팅 UI로 전환.
2. **클라우드 샌드박스** — 로컬 Docker → E2B/Fly Machines. Docker Desktop 의존 제거.
3. **멀티테넌트 SaaS** — Auth, DB 마이그레이션, 과금/사용량 제한.
