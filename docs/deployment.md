# Operations

Dojang 은 자기 머신에서 돌리는 개인 학습 도구다. 설치는 [README Quick Start](../README.md#quick-start) 한 줄로 끝난다. 이 문서는 일단 띄운 뒤의 운영 (업데이트 / 백업 / 모니터링) 만 다룬다.

## 업데이트

```bash
cd ~/dojang && git pull
# 백엔드 코드는 bind mount + --reload 라 git pull 만으로 자동 반영됨.
# Dockerfile / pyproject.toml / 프론트엔드 빌드 산출물이 바뀐 경우만 재빌드 필요:
cd build && docker compose build app && docker compose up -d app
```

## 데이터 백업

`data/dojang.db` 만 백업하면 학습 이력 / sketch / 시도가 모두 보존된다.

```bash
# 일일 cron 예시
docker cp dojang-app:/app/data/dojang.db ~/backups/dojang-$(date +%Y%m%d).db
```

## 모니터링

```bash
docker compose ps
docker compose logs --tail 50 app
df -h
docker stats --no-stream
```
