# Domains

도메인은 학습 영역이다. 각 도메인은 자체 Docker 컨테이너를 가진다.

## 기본 도메인

| Domain | Container | Base Image | 설명 |
|--------|-----------|------------|------|
| CLI | dojang-cli | alpine:3.19 | bash, grep, sed, awk, jq 등 |
| Git | dojang-git | alpine:3.19 | git + 시나리오 repo들 |
| Docker | dojang-docker | docker:27-cli | Docker CLI (소켓 마운트) |
| SQL | dojang-sql | mysql:8.0 | MySQL + 연습용 데이터셋 |

## 도메인 구조

```
build/<domain>/
├── Dockerfile          # 컨테이너 정의
├── curriculum.json     # 초기 커리큘럼 (seed 데이터)
├── init.sql            # (SQL) 초기 데이터
├── setup.sh            # (Git) 시나리오 생성 스크립트
└── ...
```

## curriculum.json 형식

```json
{
  "topics": [
    {
      "name": "토픽 이름",
      "description": "설명",
      "order": 1,
      "exercises": [
        {
          "title": "문제 제목",
          "description": "마크다운 설명",
          "initial_code": "에디터 초기 코드",
          "check_type": "query_match | output_match | script_check | ai_check",
          "check_value": "정답 검증 값",
          "difficulty": 1
        }
      ],
      "children": []
    }
  ]
}
```

## 정답 검증 방식

| check_type | 설명 | check_value |
|------------|------|-------------|
| `query_match` | 사용자 쿼리 결과 = check_value 쿼리 결과 | SQL 쿼리 |
| `output_match` | stdout 일치 비교 | 예상 출력 문자열 |
| `script_check` | 스크립트 exit code 0이면 정답 | bash 스크립트 |
| `ai_check` | Claude가 대화로 평가 | (사용 안 함) |

## 새 도메인 추가

1. `build/<name>/` 디렉토리 생성
2. `Dockerfile` 작성
3. `curriculum.json` 작성
4. `build/docker-compose.yml`에 서비스 추가
5. `src/seed.py`의 `domain_configs`에 추가
6. `src/services/container.py`에 실행 로직 필요시 추가
7. `src/routers/exercises.py`의 `_execute_in_domain()`에 분기 추가
