FROM python:3.13-slim

# Node.js (LTS) + Claude Code CLI + docker client + tmux + uv + gh.
# tmux 는 sketch 터미널 세션을 WebSocket 재연결 사이에 살아있게 유지해서
# 탭을 떠났다 돌아와도 스크롤백과 진행중 출력이 보존되도록 한다 (terminal.py 참고).
# gh 는 "코드 해부 / 학습 플랜" 매직프롬프트가 사용자 GitHub repo 를 clone 하기
# 위해 필요. 토큰은 사용자가 첫 실행 후 `docker exec -it dojang-app gh auth login`
# 한 번 돌려서 받아두고, /root/.config/gh 가 named volume 으로 영속화된다
# (docker-compose.yml 의 dojang-gh-config 참고). claude /login 패턴과 동일.
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates gnupg docker.io tmux git && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    npm install -g @anthropic-ai/claude-code && \
    install -dm 0755 /etc/apt/keyrings && \
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
        | tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null && \
    chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        > /etc/apt/sources.list.d/github-cli.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends gh && \
    rm -rf /var/lib/apt/lists/* && \
    pip install --no-cache-dir uv

WORKDIR /app

COPY pyproject.toml uv.lock* ./
RUN uv sync --no-dev --frozen 2>/dev/null || uv sync --no-dev

COPY src/backend/ src/backend/
COPY build/ build/
# 프론트엔드 `dist/` 는 이미지에 굽지 않는다 — docker-compose.yml 에서
# ../src/frontend/dist 를 /app/static 으로 bind-mount 해 호스트 빌드 결과가
# 바로 반영되게 함. 호스트에서 `npm run build` 한 번 돌려서 dist/ 를
# 만들어두는 게 첫 실행 전 필수 조건.

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
