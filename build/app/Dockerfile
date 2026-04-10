FROM node:20-alpine AS frontend

WORKDIR /build
COPY src/frontend/package.json src/frontend/package-lock.json* ./
RUN npm install
COPY src/frontend/ .
RUN npm run build


FROM python:3.13-slim

# Node.js (LTS) + Claude Code CLI + docker client + tmux + uv.
# tmux 는 sketch 터미널 세션을 WebSocket 재연결 사이에 살아있게 유지해서
# 탭을 떠났다 돌아와도 스크롤백과 진행중 출력이 보존되도록 한다 (terminal.py 참고).
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates gnupg docker.io tmux && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    npm install -g @anthropic-ai/claude-code && \
    rm -rf /var/lib/apt/lists/* && \
    pip install --no-cache-dir uv

WORKDIR /app

COPY pyproject.toml uv.lock* ./
RUN uv sync --no-dev --frozen 2>/dev/null || uv sync --no-dev

COPY src/backend/ src/backend/
COPY build/ build/
COPY --from=frontend /build/dist static/

# /root/.claude.json 을 별도 claude-config 볼륨으로 redirect — 호스트
# ~/.claude.json 과 분리해서 macOS atomic-rewrite race / installMethod mismatch
# 를 회피한다. /app/data 는 호스트 bind mount 라 학습자 DB 가 Finder/git 에서
# 직접 보이고, claude.json 만 별도로 격리해서 둘의 운명을 분리한다.
# Node fs 가 symlink 를 따라가서 write 함.
RUN mkdir -p /app/claude-config && \
    ln -sf /app/claude-config/claude.json /root/.claude.json

EXPOSE 8010
ENV PYTHONUNBUFFERED=1

CMD ["uv", "run", "uvicorn", "src.backend.main:app", "--host", "0.0.0.0", "--port", "8010"]
