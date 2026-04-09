FROM node:20-alpine AS frontend

WORKDIR /build
COPY src/frontend/package.json src/frontend/package-lock.json* ./
RUN npm install
COPY src/frontend/ .
RUN npm run build


FROM python:3.13-slim

# Node.js (LTS) + Claude Code CLI + docker client + uv
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates gnupg docker.io && \
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

EXPOSE 8010
ENV PYTHONUNBUFFERED=1

CMD ["uv", "run", "uvicorn", "src.backend.main:app", "--host", "0.0.0.0", "--port", "8010"]
