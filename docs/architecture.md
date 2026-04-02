# Architecture

## Overview

```
┌──────────┬───────────────────┬──────────────┐
│ Sidebar  │  Center Panel     │ Claude Code  │
│          │                   │ Terminal     │
│ 실습 탭  │  에디터 + 결과     │ (xterm.js)  │
│ 탐구 탭  │  지식카드 뷰/편집  │              │
└──────────┴───────────────────┴──────────────┘
     ↕ REST API                    ↕ WebSocket (PTY)
┌─────────────── FastAPI ──────────────────────┐
│ routers: domains, curriculum, exercises,      │
│          knowledge, terminal                  │
│ services: container (docker exec)             │
│ mcp_server: Claude Code 도구 (stdio)          │
│ database: SQLite (aiosqlite)                  │
└──────────┬──────────────────┬────────────────┘
           ↓                  ↓
    Domain Containers    Claude Code CLI
    (SQL, Git, CLI,      (MCP로 앱 연동)
     Docker)
```

## Data Flow

### 실습 모드
1. 사이드바에서 연습문제 선택
2. Monaco 에디터에서 코드 작성
3. `POST /api/execute` → 도메인 컨테이너에서 실행 → 결과 반환
4. `POST /api/exercises/{id}/attempt` → 정답 검증 → 진도 업데이트

### 탐구 모드
1. Claude Code 터미널에서 대화
2. Claude가 MCP `save_knowledge` 도구로 지식카드 생성
3. `knowledge_updated` notify → 프론트 자동 갱신
4. 지식카드 뷰/편집 패널에서 확인/수정

### Claude Code 연동
- 앱이 MCP 서버를 내장 (`src/mcp_server/server.py`)
- 터미널 WebSocket이 `claude` CLI를 PTY로 spawn
- Claude Code가 MCP 도구로 커리큘럼/문제/지식카드를 직접 조작
- 변경 시 파일 기반 notify → 프론트 폴링으로 즉시 반영

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | FastAPI, aiosqlite, docker-py |
| Frontend | React 19, Vite, TypeScript, Tailwind, Zustand |
| Editor | Monaco Editor |
| Terminal | xterm.js + WebSocket PTY |
| AI | Claude Code CLI + MCP |
| Sandbox | Docker containers per domain |
| DB | SQLite |
