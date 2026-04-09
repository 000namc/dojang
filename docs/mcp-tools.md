# MCP Tools

Claude Code 세션이 호출할 수 있는 MCP 도구 목록. `src/backend/tools.py` 의 `TOOL_REGISTRY` 에 정의되어 있고, `src/backend/mcp_server/server.py` 가 stdio MCP 서버로 노출한다.

용어 정리:
- **topic** = 학습 주제 (CLI, Git, Docker, SQL 등)
- **curriculum** = topic 아래의 학습 코스 (한 topic에 여러 curriculum 가능, 그 중 하나가 default)
- **subject** = curriculum 아래의 과목 (예: SQL의 "JOIN", "GROUP BY")
- **exercise / knowledge** = subject 아래의 실습 / 노트

## 토픽 / 커리큘럼 / 과목

### create_topic
새 topic + 도메인 컨테이너 생성.
- `name` (string, required) — 토픽 이름
- `description` (string)
- `container_image` (string) — 도메인 컨테이너 이미지

### create_curriculum
기존 topic 아래에 새 curriculum 생성.
- `topic` (string, required) — 토픽 이름
- `name` (string, required) — 커리큘럼 이름

### get_curriculum
토픽의 커리큘럼 트리 조회 (subject + exercise + 진행률 포함).
- `topic` (string, required)

### add_subject
커리큘럼에 새 과목(subject) 추가.
- `curriculum_id` (integer, required)
- `name` (string, required)
- `description` (string)
- `order` (integer)
- `parent_id` (integer) — 상위 subject (트리 구조 지원)

### update_subject
기존 subject 수정.
- `subject_id` (integer, required)
- `name`, `description`, `order_num` (선택)

## 실습 / 실행

### create_exercise
과목 아래에 실습 문제 생성.
- `subject_id` (integer, required)
- `title` (string, required)
- `description` (string, required) — 마크다운
- `check_type` (string, required) — `ai_check | output_match | script_check`
- `initial_code` (string)
- `check_value` (string)
- `difficulty` (integer, 1-5)
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
지식 카드 저장.
- `title` (string, required)
- `content` (string, required) — 마크다운
- `topic` (string)
- `subject_id` (integer) — subject에 첨부할 경우
- `tags` (string) — 쉼표 구분

### list_knowledge
저장된 지식 카드 목록.
- `topic` (string)
- `query` (string) — 검색어

## UI 알림

### notify_ui
도구가 데이터를 변경한 직후 호출하면 프론트엔드 폴링이 즉시 감지해서 UI를 갱신한다.
- `event` (string, required) — 자유 문자열 (예: `curriculum_updated`, `knowledge_updated`)

`data/.notify` 파일에 `{event, ts}` 형태의 JSON을 기록하며, 프론트엔드는 `/api/notify?since=<ts>` 폴링으로 변경을 감지한다.

## 호출 흐름 예시

학습자가 sketch에서 "SQL의 GROUP BY 자세히 배우고 싶어"라고 말했을 때 Claude Code가 할 수 있는 흐름:

1. `get_curriculum(topic="SQL")` — 현재 SQL 커리큘럼 조회
2. (이미 GROUP BY subject가 있으면) `save_knowledge(...)` 로 보충 노트 추가
3. (없으면) `add_subject(curriculum_id=..., name="GROUP BY 심화")` 로 새 과목
4. `create_exercise(subject_id=..., title="GROUP BY + HAVING", ...)` 로 실습 추가
5. `notify_ui(event="curriculum_updated")` 로 프론트 갱신 트리거

이 모든 호출이 Claude Code 세션 안에서 일어나므로 외부 API 비용/지연 없이 즉시 반영된다.
