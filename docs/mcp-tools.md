# MCP Tools

Claude Code가 사용하는 MCP 도구 목록. `src/mcp_server/server.py`에 정의.

## 커리큘럼

### get_curriculum
현재 도메인의 커리큘럼 트리 조회. 토픽별 연습문제와 진행률 포함.
- `domain` (string, required): 도메인 이름

### add_topic
커리큘럼에 새 토픽 추가.
- `domain` (string, required): 도메인 이름
- `name` (string, required): 토픽 이름
- `description` (string): 설명
- `parent_id` (integer): 상위 토픽 ID

### update_topic
기존 토픽 수정.
- `topic_id` (integer, required)
- `name`, `description` (string)

### create_exercise
새 연습문제 생성.
- `topic_id` (integer, required)
- `title` (string, required)
- `description` (string, required): 마크다운
- `check_type` (string, required): `query_match | output_match | script_check | ai_check`
- `initial_code` (string): 에디터 초기 코드
- `check_value` (string): 정답 검증 값
- `difficulty` (integer): 1-5
- `ui_type` (string): `auto | terminal | code | text` — auto는 도메인에 따라 자동 결정 (SQL→code, CLI/Git/Docker→terminal)

## 실행

### execute_code
도메인 컨테이너에서 코드 실행.
- `domain` (string, required)
- `code` (string, required)
- `repo` (string): Git 시나리오 이름 (기본: basic)

## 학습 현황

### get_progress
도메인별 진행 현황 조회.
- `domain` (string, required)

## 지식

### save_knowledge
지식 카드 저장.
- `title` (string, required)
- `content` (string, required): 마크다운
- `domain` (string): 관련 도메인
- `tags` (string): 쉼표 구분 태그

### list_knowledge
저장된 지식 카드 목록 조회.
- `domain` (string): 도메인 필터
- `query` (string): 검색어

## UI 알림

### notify_ui
웹 UI에 변경 알림. 데이터 변경 후 호출.
- `event` (string, required): `curriculum_updated | exercise_created | knowledge_updated`
