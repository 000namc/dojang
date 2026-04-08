# Deployment

Dojang은 기본적으로 **자기 머신에서 직접 돌리는 개인 학습 도구**다. 외부 AI API 의존이 없어서 누구의 서버에도 데이터를 보내지 않는다. 따라서 별도의 배포가 없어도 `docker compose up -d` 한 줄로 끝난다. 이 문서는 굳이 원격 서버나 도메인에 띄우고 싶을 때를 위한 가이드다.

## 가장 간단한 셋업 (로컬, 추천)

```bash
git clone https://github.com/000namc/dojang.git && cd dojang
cp .env.example .env
cd build && docker compose --profile prod up -d
```

→ http://localhost:8010 . 끝.

## 원격 서버에 띄우고 싶다면

```
[로컬 브라우저] → https://dojang.example.com
                     ↓ (Cloudflare Tunnel)
              [Oracle Cloud ARM VM 등]
                     ├── dojang-app (FastAPI + React)
                     ├── dojang-cli / git / docker / sql / python (도메인 컨테이너)
                     └── cloudflared
```

비용은 사실상 도메인 비용 정도. **OpenAI/Anthropic API 비용이 0원** 이라는 게 핵심.

| 항목 | 비용 |
|------|------|
| Oracle Cloud (ARM 4코어/24GB) | $0 (영구 무료 등급) |
| Cloudflare Tunnel + HTTPS | $0 |
| 도메인 (.com) | ~$1/월 |
| **Claude Code 사용료** | 사용자 본인의 Claude 구독 (Pro/Max) — 머신에 설치된 CLI가 알아서 처리 |
| **합계** | **~$1/월** |

## 서버 셋업

### Oracle Cloud (예시)

1. [Oracle Cloud](https://cloud.oracle.com) → Compute → Create Instance
   - Shape: **VM.Standard.A1.Flex** (ARM)
   - OCPU: 4, Memory: 24GB, Boot 100GB
   - OS: Ubuntu 22.04
2. SSH 접속

```bash
# Docker 설치
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

# Claude Code 설치 (서버에서 사용할 거면)
# → Claude 공식 가이드 참고

# 프로젝트
git clone https://github.com/000namc/dojang.git && cd dojang
cp .env.example .env
cd build && docker compose --profile prod up -d
```

> 주의: Claude Code 세션이 서버에서 동작하려면 서버 머신 안에 `claude` CLI 가 설치되어 있어야 한다. 인증도 서버 안에서 한 번 해주어야 함 (`claude` 실행 후 안내에 따라).

### Cloudflare Tunnel로 도메인 노출

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

cloudflared tunnel login
cloudflared tunnel create dojang
cloudflared tunnel route dns dojang dojang.your-domain.com
```

```yaml
# ~/.cloudflared/config.yml
tunnel: <tunnel-id>
credentials-file: /root/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: dojang.your-domain.com
    service: http://localhost:8010
  - service: http_status:404
```

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

## 운영

### 업데이트

```bash
cd ~/dojang && git pull
cd build && docker compose --profile prod build app && docker compose --profile prod up -d app
```

### 데이터 백업

`data/dojang.db` 만 백업하면 학습 이력 / sketch / 시도가 모두 보존된다.

```bash
# 일일 cron 예시
docker cp dojang-app:/app/data/dojang.db ~/backups/dojang-$(date +%Y%m%d).db
```

### 모니터링

```bash
docker compose ps
docker compose logs --tail 50 app
df -h
docker stats --no-stream
```

## 외부 공개로 갈 경우 — 체크리스트

순수 개인 도구로 쓰는 경우라면 모두 무시해도 된다. 여러 사용자에게 공개하려면 다음이 추가로 필요하다.

- **인증** — Google/Kakao OAuth (현재 dojang은 single-user 가정)
- **유저별 데이터 격리** — 모든 테이블에 `user_id` 추가, sketch/학습 이력 분리
- **샌드박스 보안** — 도메인 컨테이너 자원 제한, 위험 명령 차단, 주기적 reset
- **레이트 리밋** — 컨테이너 실행 / Claude 호출 횟수 제한
- **DB 전환** — SQLite → PostgreSQL (동시 유저 늘어날 경우)
- **에러 추적** — Sentry 등

이 부분은 dojang의 본래 설계 범위(개인 도구) 밖이라 PR로 기여를 받는 게 더 자연스럽다.
