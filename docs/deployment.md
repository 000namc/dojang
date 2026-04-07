# 서비스 배포 가이드

## 인프라 구성

```
[사용자] → https://dojang.your-domain.com
              ↓ (Cloudflare Tunnel)
        [Oracle Cloud ARM VM]
              ├── dojang-app (FastAPI + React)
              ├── dojang-cli (sandbox)
              ├── dojang-git (sandbox)
              ├── dojang-docker (sandbox)
              ├── dojang-sql (MySQL sandbox)
              └── cloudflared (tunnel daemon)
```

## 월 비용 추정

| 항목 | 비용 |
|------|------|
| Oracle Cloud (ARM 4코어/24GB) | $0 (영구 무료) |
| Cloudflare Tunnel + HTTPS | $0 |
| 도메인 (.com) | ~$1/월 |
| OpenAI API (GPT-4.1 mini) | ~$5~20 (사용량 비례) |
| Anthropic API (Haiku 4.5) | ~$5~10 (사용량 비례) |
| **합계** | **~$11~31/월** |

## 1단계: Oracle Cloud 셋업

### VM 생성

1. [Oracle Cloud](https://cloud.oracle.com) 가입 (신용카드 필요, 과금 없음)
2. Compute → Create Instance
   - Shape: **VM.Standard.A1.Flex** (ARM)
   - OCPU: 4, Memory: 24GB
   - OS: Ubuntu 22.04 (ARM)
   - Boot volume: 100GB
3. Security List에서 인바운드 규칙은 건들지 않음 (cloudflared가 아웃바운드로 연결)

### 서버 초기 설정

```bash
# SSH 접속
ssh -i <key> ubuntu@<public-ip>

# Docker 설치
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Docker Compose 설치
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 프로젝트 클론
git clone https://github.com/000namc/dojang.git
cd dojang
```

## 2단계: Cloudflare Tunnel 설정

### 도메인 준비

1. 도메인 구매 (Cloudflare Registrar 또는 외부)
2. Cloudflare에 도메인 추가, 네임서버 변경

### Tunnel 생성

```bash
# cloudflared 설치 (ARM)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# 로그인 (브라우저에서 인증)
cloudflared tunnel login

# 터널 생성
cloudflared tunnel create dojang

# DNS 레코드 연결
cloudflared tunnel route dns dojang dojang.your-domain.com
```

### Tunnel 설정 파일

```yaml
# ~/.cloudflared/config.yml
tunnel: <tunnel-id>
credentials-file: /root/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: dojang.your-domain.com
    service: http://localhost:8010
  - service: http_status:404
```

### systemd 서비스 등록

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

## 3단계: 앱 배포

### 환경 변수

```bash
# .env 파일 생성
cat > .env << 'EOF'
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
EOF
```

### Docker Compose로 실행

```bash
cd build
docker compose --profile prod up -d
```

### 확인

```bash
# 컨테이너 상태
docker compose ps

# 앱 로그
docker compose logs -f app

# 터널 상태
sudo systemctl status cloudflared

# 접속 테스트
curl https://dojang.your-domain.com/health
```

## 4단계: 운영

### 업데이트 배포

```bash
cd ~/dojang
git pull
cd build
docker compose --profile prod build app
docker compose --profile prod up -d app
```

### 데이터 백업

```bash
# SQLite DB 백업 (cron으로 일일 실행)
docker cp dojang-app:/app/data/dojang.db ~/backups/dojang-$(date +%Y%m%d).db
```

### 모니터링

```bash
# 디스크 사용량
df -h

# 컨테이너 리소스
docker stats --no-stream

# 앱 로그 (최근 에러)
docker compose logs --tail 50 app | grep -i error
```

## TODO: 서비스화 체크리스트

### 필수 (서비스 전)

- [ ] **인증 시스템** — Google + Kakao OAuth
  - NextAuth.js 또는 FastAPI + authlib
  - users 테이블 추가
  - 세션/토큰 관리
- [ ] **DB 마이그레이션** — 멀티유저 지원
  - 모든 테이블에 user_id 컬럼 추가
  - 데이터 격리 (유저별 커리큘럼, 채팅)
- [ ] **API 사용량 제한**
  - 일일 채팅 횟수 제한 (무료: 20회, 유료: 무제한)
  - rate limiting (FastAPI middleware)
- [ ] **샌드박스 보안**
  - 명령어 타임아웃 (30초)
  - 위험 명령어 차단 (`rm -rf /`, `shutdown` 등)
  - 컨테이너 리소스 제한 (CPU, 메모리)
  - 주기적 컨테이너 리셋 (매일 새벽)

### 권장 (서비스 후)

- [ ] **과금 시스템** — Stripe 연동
  - Free: 일 20회 채팅, 커리큘럼 3개
  - Pro ($10/월): 무제한 채팅, 커리큘럼 무제한
- [ ] **에러 추적** — Sentry 연동
- [ ] **사용량 대시보드** — 관리자용
- [ ] **컨테이너 격리 강화** — 유저별 namespace 또는 gVisor
- [ ] **CDN** — 정적 파일 Cloudflare 캐싱
- [ ] **DB 전환** — SQLite → PostgreSQL (유저 100+ 시)
