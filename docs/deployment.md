# Operations

Dojang 은 자기 머신에서 돌리는 개인 학습 도구다. 설치는 [README Quick Start](../README.md#quick-start) 한 줄로 끝난다. 이 문서는 일단 띄운 뒤의 운영 (업데이트 / 백업 / 모니터링) 만 다룬다.

## 업데이트

```bash
cd ~/dojang && git pull
# 백엔드 코드는 bind mount + --reload 라 git pull 만으로 자동 반영됨.
# Dockerfile / pyproject.toml / 프론트엔드 소스가 바뀐 경우만 재빌드 필요:
cd build && docker compose build app && docker compose up -d app
```

### macOS 재빌드 시 함정

Docker Desktop 의 credentials helper (`docker-credential-desktop`) 가 기본 PATH 에 없어서, 새 셸에서 `docker compose build` 가 base image metadata 를 못 가져와 실패할 수 있다 (`error getting credentials - err: exec: "docker-credential-desktop": executable file not found`). 해결:

```bash
PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH" docker compose build app
```

또는 `~/.zshrc` / `~/.bashrc` 에 `export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"` 를 한 번 박아둠.

## 데이터 백업

호스트 `data/dojang.db` 만 백업하면 학습 이력 / sketch / 시도가 모두 보존된다. 컨테이너의 `/app/data` 는 호스트 `data/` 를 bind mount 한 것이므로 `docker cp` 가 필요 없다.

```bash
# 일일 cron 예시
cp ~/dojang/data/dojang.db ~/backups/dojang-$(date +%Y%m%d).db
```

claude CLI 의 config 파일 (`~/.claude.json` → `dojang-claude-config` volume) 은 백업 대상이 아님 — `claude /login` 으로 언제든 재발급 가능.

## 모니터링

```bash
docker compose ps
docker compose logs --tail 50 app
df -h
docker stats --no-stream
```
