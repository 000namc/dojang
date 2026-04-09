# Domains (= Topics)

도메인은 학습 영역(=topic)이다. 각 도메인은 자체 Docker 컨테이너를 가지고, 시드 데이터(`curriculum.json` + `knowledge.json`)를 함께 들고 있다.

## 기본 도메인

| Topic | Container | Base Image | 무엇을 연습하는지 |
|--------|-----------|------------|------|
| CLI | dojang-cli | alpine:3.19 | bash, grep, sed, awk, find, jq |
| Git | dojang-git | alpine:3.19 | branch, merge, rebase, conflict |
| Docker | dojang-docker | docker:27-cli | image, container, Dockerfile, compose |
| SQL | dojang-sql | mysql:8.0 | SELECT, JOIN, GROUP BY, subquery |

## 도메인 디렉토리 구조

```
build/<topic>/
├── Dockerfile          # 컨테이너 이미지 정의
├── curriculum.json     # 시드 커리큘럼: subject + exercise + knowledge
├── knowledge.json      # (선택) 추가 노트 시드
├── init.sql            # (SQL) 초기 데이터
├── setup.sh            # (Git) 시나리오 생성 스크립트
└── gen_data.py         # (Python) 샘플 데이터 생성
```

## curriculum.json 형식

`build/<topic>/curriculum.json` 은 그 topic의 **default curriculum** 으로 시드된다.

```json
{
  "name": "CLI 기초",
  "description": "리눅스 명령어 입문 코스",
  "topics": [
    {
      "name": "첫 걸음: 여기가 어디지?",
      "description": "pwd, ls, cd 같은 기본 위치 명령",
      "order": 1,
      "knowledge": [
        {
          "title": "pwd: 현재 위치 확인",
          "content": "...마크다운...",
          "tags": "navigation"
        }
      ],
      "exercises": [
        {
          "title": "현재 위치 출력",
          "description": "마크다운 설명",
          "initial_code": "# 여기에 명령어 작성\n",
          "check_type": "ai_check",
          "check_value": "",
          "difficulty": 1,
          "ui_type": "auto"
        }
      ],
      "children": []
    }
  ]
}
```

> 참고: 시드 JSON 안에서 "topics" 키는 사실 **subjects** 를 의미한다 (코드 정리 전 잔재). 각 항목 = subject = 별자리의 별 1개.

## 정답 검증 방식 (check_type)

| check_type | 설명 | check_value |
|------------|------|-------------|
| `output_match` | stdout 일치 비교 | 예상 출력 문자열 |
| `script_check` | 스크립트 exit code 0이면 정답 | bash 스크립트 |
| `query_match` | (SQL) 사용자 쿼리 결과 = 정답 쿼리 결과 | 정답 SQL |
| `ai_check` | Claude Code 세션이 대화로 평가 | (자유) |

## ui_type

각 exercise의 UI를 결정한다.

| ui_type | 렌더링 |
|---------|--------|
| `auto` | 컨테이너 종류로 자동 (SQL → code, CLI/Git/Docker → terminal) |
| `code` | Monaco 에디터 |
| `terminal` | xterm.js |
| `text` | 단순 텍스트 입력 |

## 새 도메인 추가하는 법

1. `build/<topic>/` 디렉토리 생성
2. `Dockerfile` 작성 — 기본 이미지 + 학습에 필요한 도구 설치
3. `curriculum.json` 작성 — subject + exercise + knowledge 시드
4. `knowledge.json` (선택) — 추가 노트
5. `build/docker-compose.yml` 에 서비스 추가
   ```yaml
   dojang-<topic>:
     build: ./<topic>
     container_name: dojang-<topic>
   ```
6. `src/backend/seed.py` 의 `topic_configs` 와 시드 로더 매핑 (`for topic_dir_name, topic_name in [...]`) 에 추가
7. `cd build && docker compose build dojang-<topic>`
8. 빈 DB로 첫 부팅 → 자동 시드. 기존 사용자라면 토픽을 수동 추가하거나 DB를 초기화해야 함.

## 새 도메인 예시 — Rust

```dockerfile
# build/rust/Dockerfile
FROM rust:1.83-alpine
WORKDIR /workspace
RUN apk add --no-cache bash
CMD ["sleep", "infinity"]
```

```json
// build/rust/curriculum.json
{
  "name": "Rust 기초",
  "description": "ownership 부터 trait까지",
  "topics": [
    {
      "name": "ownership 입문",
      "order": 1,
      "exercises": [
        {
          "title": "borrow checker 이해",
          "description": "다음 코드를 컴파일되게 고쳐보세요",
          "initial_code": "fn main() { let s = String::from(\"hi\"); print(s); print(s); }",
          "check_type": "script_check",
          "check_value": "cargo build",
          "difficulty": 2
        }
      ]
    }
  ]
}
```
