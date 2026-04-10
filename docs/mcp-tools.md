# MCP Tools

Claude Code 세션이 호출할 수 있는 MCP 도구 목록. `src/backend/tools.py` 의 `TOOL_REGISTRY` 에 정의되어 있고, `src/backend/mcp_server/server.py` 가 stdio MCP 서버로 노출한다.

용어 정리:
- **topic** = 학습 주제 (CLI, Git, Docker, SQL 등)
- **curriculum** = topic 아래의 학습 코스 (한 topic에 여러 curriculum 가능, 그 중 하나가 default)
- **subject** = curriculum 아래의 과목. `parent_id` 로 2단계 계층을 만들 수 있다 — Part 성격의 상위 subject + 그 아래 학습 subject
- **exercise / knowledge** = subject 아래의 실습 / 노트

## 커리큘럼 생성 워크플로우 (중요)

사용자가 "X 커리큘럼 만들어줘" / "X 가르쳐줘" / "X 배우고 싶어" 등으로 요청했을 때 Claude Code 는 **절대 곧바로 `create_curriculum` 을 호출하면 안 된다**. 3단계 절차를 따르도록 `/app/CLAUDE.md` (`terminal.py` 의 `_CLAUDE_MD_CONTENT`) 에 명시되어 있다.

**1단계 — 목차 제안 (create_* 호출 금지)**
텍스트로만 Part × Subject 트리를 제안하고 승인 받는다:
- 3~4 개 Part 로 묶기 (예: "Part I. 기초" → "Part II. 핵심" → "Part III. 실전")
- 각 Part 아래 3~5 개 subject, 총 10~15 subject 가 목표

**2단계 — 생성**
1. `create_curriculum` 으로 컨테이너 만들기
2. 각 Part 를 `add_subject(parent_id=None)` 로 생성
3. 각 Part 아래 학습 주제를 `add_subject(parent_id=<part 의 id>)` 로 생성
4. 각 학습 subject 마다:
   - `save_knowledge` × 2~4 개 — 서로 다른 각도 (개념/설계 의도/메커니즘/함정/비교)
   - `create_exercise` × 2~3 개 ladder — drill (`output_match`, difficulty 1) → apply (`ai_check`, 2) → extend (`ai_check`, 3)

**3단계 — 자기 점검**
`review_curriculum(curriculum_id=<방금 만든 id>)` 호출. 반환되는 `warnings` 가 "Looks good" 하나만 나올 때까지 지적된 부분 보강 후 재검토.

## 토픽 / 커리큘럼 / 과목

### create_topic
새 topic + 도메인 컨테이너 생성.
- `name` (string, required) — 토픽 이름
- `description` (string)
- `container_image` (string) — 도메인 컨테이너 이미지

### create_curriculum
기존 topic 아래에 새 curriculum 생성. **곧바로 부르지 말 것** — 위의 "커리큘럼 생성 워크플로우" 에 따라 먼저 목차를 텍스트로 제안하고 승인받은 뒤 호출.
- `topic` (string, required) — 토픽 이름
- `name` (string, required) — 커리큘럼 이름 (예: "FastAPI 기초")
- `description` (string)

### get_curriculum
토픽의 커리큘럼 트리 조회 (subject + exercise + 진행률 포함).
- `topic` (string, required)

### add_subject
커리큘럼에 subject 추가. **좋은 커리큘럼은 2단계 계층을 쓴다** — Part 성격의 상위 subject 를 먼저 `parent_id=None` 으로 만든 뒤, 실제 학습 주제는 해당 Part 의 id 를 `parent_id` 로 걸어서 만든다. 10개 이상의 subject 를 전부 `parent_id=None` 으로 만들면 flat 구조가 되어 품질이 떨어진다.
- `name` (string, required)
- `curriculum_id` (integer) — 생략하면 `topic` 의 기본 커리큘럼에 추가
- `topic` (string) — `curriculum_id` 미지정 시 필수
- `description` (string)
- `parent_id` (integer) — 상위 subject. Part 는 None, 학습 subject 는 Part 의 id.

### update_subject
기존 subject 수정.
- `subject_id` (integer, required)
- `name`, `description` (선택)

## 실습 / 실행

### create_exercise
과목 아래에 실습 문제 생성. **한 subject 당 exercise 1개만 만들면 학습 리듬이 단조롭다** — 2~3 개를 ladder 형태로:
- drill (`check_type="output_match"` / `"query_match"` / `"script_check"`, `difficulty=1`) — 개념 확인 드릴, 자동 채점 가능한 형태
- apply (`check_type="ai_check"`, `difficulty=2`) — 실제 상황 시뮬레이션
- extend (`check_type="ai_check"`, `difficulty=3`, 선택) — 응용/변형

같은 subject 안 exercise 들의 `check_type` 과 `difficulty` 를 다양화하는 것이 수를 늘리는 것만큼 중요.

- `subject_id` (integer, required)
- `title` (string, required)
- `description` (string, required) — 마크다운
- `check_type` (string, required) — `ai_check | output_match | query_match | script_check`
- `initial_code` (string)
- `check_value` (string) — 정답 확인용 쿼리/스크립트/예상출력
- `difficulty` (integer, 1-5) — 1=drill, 2=apply, 3=extend
- `ui_type` (string) — `auto | terminal | code | text`

### execute_code
도메인 컨테이너에서 코드/명령 실행.
- `topic` (string, required)
- `code` (string, required)

## 학습 이력

### get_progress
토픽별 시도 / 정답률 통계 조회.
- `topic` (string, required)

## 지식 (노트)

### save_knowledge
subject 에 지식 카드(노트) 저장. **한 subject 에는 2~4 개 카드를 서로 다른 각도로** 작성한다. 카드 하나에 모든 각도를 욱여넣지 말고 각도별로 분리. 추천 각도:
- **개념 정의** — 이게 뭐고 왜 필요한가
- **설계 의도** — 왜 이 방식으로 만들어졌나 (원칙, 트레이드오프)
- **내부 메커니즘** — 실제로 어떻게 동작하나
- **흔한 함정** — 놓치기 쉬운 포인트, 오해
- **비교** — 비슷한 개념들과의 차이

- `title` (string, required) — 어떤 각도의 카드인지 드러나게 (예: "왜 Depends 는 데코레이터가 아닌가" — 설계 의도)
- `content` (string, required) — 마크다운. 한 관점에 집중.
- `subject_id` (integer) — 커리큘럼 생성 시에는 거의 항상 지정
- `topic` (string)
- `tags` (string) — 쉼표 구분

### list_knowledge
저장된 지식 카드 목록.
- `topic` (string)
- `query` (string) — 검색어

## 커리큘럼 품질 점검

### review_curriculum
커리큘럼의 구조 품질을 분석해서 리포트를 반환한다. **커리큘럼을 새로 만들거나 크게 수정한 직후 반드시 호출**. 감지 항목:
- flat 구조 (parent_id 를 안 써서 Part 가 없음)
- 노트/실습 밀도 부족 (leaf subject 당 평균 2 개 미만)
- 난이도/check_type 편향 (전부 `ai_check`, 전부 difficulty 2 등)
- 노트나 실습이 비어있는 subject

반환값:
```json
{
  "curriculum_id": 6,
  "name": "FastAPI 기초",
  "stats": {
    "parts": 0, "top_level_subjects": 12, "sub_level_subjects": 0,
    "total_subjects": 12, "leaf_subjects": 12,
    "avg_knowledge_per_leaf": 1.0, "avg_exercises_per_leaf": 1.0,
    "difficulty_spread": {"1": 1, "2": 8, "3": 3},
    "check_type_spread": {"output_match": 1, "ai_check": 11}
  },
  "warnings": ["Flat structure: 12 top-level subjects, 0 Parts. ...", ...]
}
```

`warnings` 가 "Looks good. No structural issues detected." 하나만 남을 때까지 지적된 부분을 보강한 뒤 다시 호출하며 반복.

- `curriculum_id` (integer, required)

## 호출 흐름 예시

**기존 커리큘럼에 보충** — 학습자가 sketch에서 "SQL의 GROUP BY 자세히 배우고 싶어"라고 말했을 때:

1. `get_curriculum(topic="SQL")` — 현재 SQL 커리큘럼 조회
2. (이미 GROUP BY subject가 있으면) `save_knowledge(...)` 로 보충 노트 추가 (서로 다른 각도로 2~3개)
3. (없으면) `add_subject(curriculum_id=..., name="GROUP BY 심화", parent_id=<적절한 Part>)` 로 새 subject
4. `create_exercise(subject_id=..., check_type="query_match", difficulty=1, ...)` + `create_exercise(..., check_type="ai_check", difficulty=2, ...)` 로 drill + apply 추가

**새 커리큘럼 생성** — 위의 "커리큘럼 생성 워크플로우" 3단계를 따른다. 목차 승인 → `create_curriculum` + `add_subject` 트리 + `save_knowledge` + `create_exercise` → `review_curriculum` 반복.

UI 갱신은 각 mutation 도구가 내부적으로 `data/.notify` 에 기록하므로 자동으로 반영된다 (프론트엔드가 `/api/notify?since=<ts>` 로 폴링). 이 모든 호출이 Claude Code 세션 안에서 일어나므로 외부 API 비용/지연 없이 즉시 반영된다.
