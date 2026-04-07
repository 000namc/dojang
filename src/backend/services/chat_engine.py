"""Chat engine — 일반 대화는 GPT-4.1 mini, 커리큘럼 설계는 Claude Haiku."""

import asyncio
import json
from collections.abc import AsyncGenerator

from openai import AsyncOpenAI
from anthropic import AsyncAnthropic

from src.backend.config import Settings
from src.backend.tools import to_openai_tools, handle_tool, get_db, TOOL_REGISTRY

# 모듈 로드 시 한 번만 변환
TOOLS = to_openai_tools()


# ---------------------------------------------------------------------------
# System prompt builder
# ---------------------------------------------------------------------------

def build_system_prompt(topic_name: str, context: dict | None = None) -> str:
    try:
        db = get_db()
        rows = db.execute("SELECT name, description FROM topics").fetchall()
        db.close()
        topic_list = ", ".join(f"{r['name']}({r['description']})" for r in rows)
    except Exception:
        topic_list = "CLI, Git, Docker, SQL"

    prompt = f"""\
너는 Dojang 학습 플랫폼의 튜터야. 한국어로 대화해.

## 플랫폼 구조

주제(토픽) → 커리큘럼(과목 목록) → 실습/노트
- 주제(토픽): 학습자가 배우고 싶은 것 (예: 선형회귀, Git, SQL)
- 커리큘럼: 주제 아래의 학습 단계들 (add_subject으로 생성)
- 실습: 직접 해보는 연습문제 (create_exercise로 생성)
- 노트: 핵심 개념 정리 (save_knowledge로 생성)

## 현재 상태

학습자가 선택한 주제(토픽): {topic_name}
존재하는 주제 목록: {topic_list}

## 역할

학습자가 모르는 것을 대화하면서 함께 알아가고, 필요한 커리큘럼을 만들어주는 튜터.

## 커리큘럼 생성 규칙

학습자가 커리큘럼 생성을 요청하면, 바로 만들지 말고 **3단계 확인 절차**를 거친다.

### 1단계: 확인 질문 (도구 호출 없이 텍스트로)

다음을 확인한다:
- **주제 선택**: 기존 주제(예: CLI) 아래에 만들지, 새 주제를 만들지?
  - 새 주제라면 이름은?
  - 기존 주제라면 어떤 주제?
- **커리큘럼 이름**: 적절한 이름을 제안하고 확인 (예: "CLI 완전 초보자 코스")

학습자가 명확히 의도를 밝힌 경우 (예: "CLI 초보자 커리큘럼 만들어줘") 불필요한 질문은 건너뛴다.

### 2단계: 구조 설계 (design_curriculum 도구 호출)

주제와 커리큘럼 이름이 정해지면 design_curriculum 도구를 호출한다. 이 도구는 AI 설계 전문가가 구조를 설계해서 돌려준다.

**절대 규칙**: design_curriculum의 반환값을 너의 말로 바꾸거나 요약하지 마라. 반환된 텍스트를 있는 그대로 학습자에게 전달해라. 과목별 📖 노트 목록, ✏️ 실습 목록, 난이도 표시가 모두 포함되어 있다.

학습자가 피드백을 주면:
- **작은 수정** (과목 1개 빼기/추가, 이름 변경, 순서 변경 등): 너가 직접 수정해서 다시 보여준다.
- **큰 수정** (전체 방향 변경, 대상 수준 변경, 절반 이상 재구성 등): design_curriculum을 다시 호출해서 새로 설계한다.
학습자가 "좋아", "진행해", "이대로 만들어줘" 등으로 확인할 때까지 반복한다.

### 3단계: 실제 생성 (도구 호출)

학습자가 구조를 확인("좋아", "진행해", "이대로 만들어줘" 등)하면, design_curriculum을 다시 호출하지 않는다. 바로 create_curriculum + add_subject으로 실제 생성을 시작한다.
- 새 주제: create_topic → create_curriculum → add_subject들 (curriculum_id 지정)
- 기존 주제: create_curriculum → add_subject들 (curriculum_id 지정)
- 주제 이름은 학습자가 배우려는 것 그대로 사용한다 (예: "선형회귀", Python이 아님)
- add_subject 호출 시 반드시 create_curriculum에서 받은 curriculum_id를 지정한다

3단계에서는 먼저 커리큘럼 폴더와 과목 뼈대만 만든다. 노트/실습은 만들지 않고 멈춘다.
시스템이 자동으로 상세 가이드를 생성한 후, 그 가이드에 따라 노트와 실습을 채우라는 지시가 올 것이다. 그 지시를 따라 도구를 호출하면 된다.

### 과목 구성 규칙

좁고 깊게 — 과목 수는 적게(3~5개), 각 과목 안의 내용은 풍부하게.

- 과목 하나는 하나의 주제에 집중한다 (예: "여기가 어디지? — pwd, ls, cd").
- 노트(save_knowledge): 과목당 2~3개. 각 노트는 하나의 개념을 다룬다.
  - 교과서 한 섹션 수준으로 충실하게 작성. 개념 설명 + 수식(필요 시) + 예시 + 왜 중요한지.
  - 마크다운과 LaTeX 수식($...$, $$...$$)을 적극 활용.
- 실습(create_exercise): 과목당 3~5개. 쉬운 것부터 어려운 순서로.
  - 노트에서 배운 개념을 바로 손으로 연습하도록 설계.
  - 실습 언어를 학습자가 특정하지 않으면 Python을 기본으로 사용.
  - check_type은 내용에 따라 적절히 선택 (코드면 script_check 또는 output_match, 개념이면 ai_check).

## 대화 규칙

- 학습자가 가볍게 질문하면 친절하게 설명한다. 바로 커리큘럼을 만들지 않는다.
- 학습자가 명시적으로 커리큘럼 생성을 요청하면 그때 도구를 사용한다.
- 필요하면 execute_code로 직접 실행해서 결과를 보여준다.
- 절대 "주제가 없다", "지원하지 않는다"고 거절하지 않는다. 어떤 주제든 만들 수 있다."""

    if context:
        ctx_type = context.get("type")
        if ctx_type == "exercise":
            title = context.get("exercise_title", "")
            desc = context.get("exercise_description", "")
            prompt += f"\n\n[현재 학습자가 보고 있는 문제]\n제목: {title}\n설명: {desc}"
        elif ctx_type == "knowledge":
            title = context.get("card_title", "")
            content = context.get("card_content", "")
            prompt += f"\n\n[현재 학습자가 보고 있는 노트]\n제목: {title}\n내용:\n{content}"

    return prompt


# ---------------------------------------------------------------------------
# Tool execution (wraps sync handler in thread)
# ---------------------------------------------------------------------------

async def execute_tool(name: str, arguments: dict, settings: Settings | None = None) -> str:
    if name == "design_curriculum" and settings:
        return await _design_curriculum(arguments, settings)
    result = await asyncio.to_thread(handle_tool, name, arguments)
    return json.dumps(result, ensure_ascii=False)


async def _design_curriculum(args: dict, settings: Settings) -> str:
    """Haiku에게 커리큘럼 구조를 설계하게 한다."""
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    topic = args.get("topic", "")
    name = args.get("name", "")
    description = args.get("description", "")
    level = args.get("level", "초보자")

    response = await client.messages.create(
        model=settings.anthropic_model,
        max_tokens=4096,
        system="""\
너는 학습 커리큘럼 설계 전문가야. 주어진 주제와 대상에 맞는 커리큘럼 구조를 설계해줘.

규칙:
- 과목은 3~5개. 좁고 깊게.
- 각 과목에 들어갈 노트(2~3개)와 실습(3~5개)의 제목과 간단한 설명을 포함해.
- 쉬운 것부터 어려운 순서로 배치해.
- 한국어로 작성해.

출력 형식:
📋 "{커리큘럼 이름}" 구성안:

**1. {과목명}** — {한 줄 설명}
   📖 {노트1 제목} — {노트1 핵심 내용 한 줄}
   📖 {노트2 제목} — {노트2 핵심 내용 한 줄}
   ✏️ {실습1 제목} (⭐) — {실습1 설명 한 줄}
   ✏️ {실습2 제목} (⭐⭐) — {실습2 설명 한 줄}

**2. {과목명}** — ...

각 항목을 개별 줄로 작성. 노트와 실습을 쉼표로 묶지 말고 한 줄에 하나씩.
마지막에 "이대로 진행할까요? 추가하거나 빼고 싶은 내용이 있으면 말씀해주세요." 를 붙여.""",
        messages=[{
            "role": "user",
            "content": f"주제: {topic}\n커리큘럼 이름: {name}\n설명: {description}\n대상 수준: {level}",
        }],
    )
    return response.content[0].text


# ---------------------------------------------------------------------------
# Haiku curriculum planner — 구조 설계 + 실행 가이드 생성
# ---------------------------------------------------------------------------

_PLAN_PROMPT = """\
너는 학습 커리큘럼 설계 전문가야. 방금 생성된 과목들을 보고, GPT가 내용을 채울 수 있도록 **상세한 실행 가이드**를 만들어줘.

각 과목마다 다음을 작성해:

## 과목: {과목명} (subject_id: {id})

### 노트 (save_knowledge) — 2~3개
각 노트마다:
- **제목**: 노트 제목
- **핵심 내용**: 반드시 포함해야 할 개념, 예시, 수식 등을 구체적으로 기술
- **tags**: 적절한 태그

### 실습 (create_exercise) — 3~5개 (쉬운 순서 → 어려운 순서)
각 실습마다:
- **제목**: 실습 제목
- **설명**: 학습자에게 보여줄 문제 설명 (마크다운)
- **initial_code**: 미리 채워줄 코드 (있으면)
- **check_type**: output_match / script_check / ai_check
- **check_value**: 정답 기준 (있으면)
- **difficulty**: 1~5
- **ui_type**: terminal / code / text

노트는 교과서 한 섹션 수준으로 충실하게. 실습은 노트에서 배운 것을 바로 연습할 수 있도록.
한국어로 작성해."""


async def _haiku_plan(settings: Settings, subjects_info: str) -> str:
    """Haiku에게 커리큘럼 상세 가이드를 요청한다. 비스트리밍 단일 호출."""
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    response = await client.messages.create(
        model=settings.anthropic_model,
        max_tokens=16384,
        system=_PLAN_PROMPT,
        messages=[{"role": "user", "content": f"다음 과목들에 대한 상세 실행 가이드를 만들어줘:\n\n{subjects_info}"}],
    )
    return response.content[0].text


# ---------------------------------------------------------------------------
# Streaming chat loop
# ---------------------------------------------------------------------------

_PLANNING_TRIGGER_TOOLS = {"create_curriculum", "add_subject"}


async def stream_chat(
    messages: list[dict],
    system_prompt: str,
    settings: Settings,
) -> AsyncGenerator[str, None]:
    """SSE 이벤트를 yield하는 agentic chat loop.

    커리큘럼 도구 감지 시:
    1. mini가 커리큘럼 + 과목 뼈대 생성
    2. Haiku가 상세 실행 가이드 생성 (비스트리밍)
    3. mini가 가이드에 따라 노트/실습 채우기
    """

    openai_client = AsyncOpenAI(api_key=settings.openai_api_key)
    model = settings.openai_model

    api_messages = [{"role": "system", "content": system_prompt}] + messages

    full_text = ""
    max_tool_rounds = 15
    planned = False

    for _ in range(max_tool_rounds):
        stream = await openai_client.chat.completions.create(
            model=model,
            messages=api_messages,
            tools=TOOLS,
            stream=True,
        )

        current_text = ""
        tool_calls_acc: dict[int, dict] = {}

        async for chunk in stream:
            delta = chunk.choices[0].delta if chunk.choices else None
            if not delta:
                continue

            if delta.content:
                current_text += delta.content
                yield f"event: text_delta\ndata: {json.dumps({'text': delta.content}, ensure_ascii=False)}\n\n"

            if delta.tool_calls:
                for tc in delta.tool_calls:
                    idx = tc.index
                    if idx not in tool_calls_acc:
                        tool_calls_acc[idx] = {"id": tc.id or "", "name": "", "arguments": ""}
                    if tc.id:
                        tool_calls_acc[idx]["id"] = tc.id
                    if tc.function:
                        if tc.function.name:
                            tool_calls_acc[idx]["name"] = tc.function.name
                        if tc.function.arguments:
                            tool_calls_acc[idx]["arguments"] += tc.function.arguments

        finish_reason = chunk.choices[0].finish_reason if chunk.choices else None

        full_text += current_text

        if finish_reason != "tool_calls" or not tool_calls_acc:
            break

        # Execute tool calls
        assistant_msg: dict = {"role": "assistant", "content": current_text or None}
        assistant_msg["tool_calls"] = [
            {
                "id": tc["id"],
                "type": "function",
                "function": {"name": tc["name"], "arguments": tc["arguments"]},
            }
            for tc in tool_calls_acc.values()
        ]
        api_messages.append(assistant_msg)

        for tc in tool_calls_acc.values():
            name = tc["name"]
            try:
                args = json.loads(tc["arguments"])
            except json.JSONDecodeError:
                args = {}

            yield f"event: tool_use_start\ndata: {json.dumps({'id': tc['id'], 'name': name, 'input': args}, ensure_ascii=False)}\n\n"

            result_str = await execute_tool(name, args, settings)

            yield f"event: tool_result\ndata: {json.dumps({'tool_use_id': tc['id'], 'content': result_str}, ensure_ascii=False)}\n\n"

            api_messages.append({
                "role": "tool",
                "tool_call_id": tc["id"],
                "content": result_str,
            })

        # 커리큘럼 도구 감지 → 과목 미생성 시 먼저 생성 지시, 이후 Haiku 가이드
        called_tools = {tc["name"] for tc in tool_calls_acc.values()}
        if called_tools & _PLANNING_TRIGGER_TOOLS and not planned:
            # create_curriculum만 호출되고 add_subject은 아직 안 된 경우 → 과목 먼저 만들게 함
            subjects_info = _extract_subjects_info(api_messages)
            if not subjects_info or "과목 정보를 추출할 수 없음" in subjects_info:
                api_messages.append({
                    "role": "user",
                    "content": "커리큘럼이 생성되었으니, 이제 앞서 확인한 구조대로 add_subject을 호출해서 과목들을 만들어줘. 노트/실습은 아직 만들지 마.",
                })
                continue  # 다음 라운드에서 mini가 add_subject 호출

            planned = True
            yield f"event: planning\ndata: {json.dumps({'status': 'generating_guide'})}\n\n"

            guide = await _haiku_plan(settings, subjects_info)

            yield f"event: planning\ndata: {json.dumps({'status': 'guide_ready'})}\n\n"

            # 가이드를 과목별로 분할하여 순차 실행
            subject_sections = _split_guide_by_subject(guide)

            for i, section in enumerate(subject_sections):
                is_last = (i == len(subject_sections) - 1)
                suffix = " 마지막 과목이므로 완료 후 notify_ui를 호출해." if is_last else ""
                api_messages.append({
                    "role": "user",
                    "content": f"[가이드 {i+1}/{len(subject_sections)}] 아래 과목의 노트와 실습을 만들어줘.{suffix}\n\n{section}",
                })

                # mini가 이 과목의 내용을 채움
                for __ in range(5):  # 과목당 최대 5라운드
                    topic_stream = await openai_client.chat.completions.create(
                        model=model, messages=api_messages, tools=TOOLS, stream=True,
                    )
                    t_text = ""
                    t_tool_calls: dict[int, dict] = {}

                    async for chunk in topic_stream:
                        delta = chunk.choices[0].delta if chunk.choices else None
                        if not delta:
                            continue
                        if delta.content:
                            t_text += delta.content
                            yield f"event: text_delta\ndata: {json.dumps({'text': delta.content}, ensure_ascii=False)}\n\n"
                        if delta.tool_calls:
                            for tc in delta.tool_calls:
                                idx = tc.index
                                if idx not in t_tool_calls:
                                    t_tool_calls[idx] = {"id": tc.id or "", "name": "", "arguments": ""}
                                if tc.id:
                                    t_tool_calls[idx]["id"] = tc.id
                                if tc.function:
                                    if tc.function.name:
                                        t_tool_calls[idx]["name"] = tc.function.name
                                    if tc.function.arguments:
                                        t_tool_calls[idx]["arguments"] += tc.function.arguments

                    t_finish = chunk.choices[0].finish_reason if chunk.choices else None
                    full_text += t_text

                    if t_finish != "tool_calls" or not t_tool_calls:
                        if t_text:
                            api_messages.append({"role": "assistant", "content": t_text})
                        break

                    # 도구 실행
                    t_assistant: dict = {"role": "assistant", "content": t_text or None}
                    t_assistant["tool_calls"] = [
                        {"id": tc["id"], "type": "function", "function": {"name": tc["name"], "arguments": tc["arguments"]}}
                        for tc in t_tool_calls.values()
                    ]
                    api_messages.append(t_assistant)

                    for tc in t_tool_calls.values():
                        name = tc["name"]
                        try:
                            args = json.loads(tc["arguments"])
                        except json.JSONDecodeError:
                            args = {}
                        yield f"event: tool_use_start\ndata: {json.dumps({'id': tc['id'], 'name': name, 'input': args}, ensure_ascii=False)}\n\n"
                        result_str = await execute_tool(name, args, settings)
                        yield f"event: tool_result\ndata: {json.dumps({'tool_use_id': tc['id'], 'content': result_str}, ensure_ascii=False)}\n\n"
                        api_messages.append({"role": "tool", "tool_call_id": tc["id"], "content": result_str})

            break  # 과목별 루프 완료

    yield f"event: done\ndata: {json.dumps({'full_text': full_text}, ensure_ascii=False)}\n\n"


def _split_guide_by_subject(guide: str) -> list[str]:
    """Haiku 가이드를 '## 과목:' 구분자로 과목별 섹션으로 분할."""
    import re
    sections = re.split(r'\n(?=## 과목:)', guide)
    # 빈 섹션 제거
    return [s.strip() for s in sections if s.strip() and '과목' in s]


def _extract_subjects_info(api_messages: list[dict]) -> str:
    """메시지 히스토리에서 add_subject 호출과 결과를 매칭하여 과목 정보 추출."""
    # assistant 메시지에서 add_subject 호출 찾기
    subject_calls: dict[str, dict] = {}  # tool_call_id -> args
    for msg in api_messages:
        if msg.get("role") == "assistant" and msg.get("tool_calls"):
            for tc in msg["tool_calls"]:
                if tc["function"]["name"] == "add_subject":
                    try:
                        args = json.loads(tc["function"]["arguments"])
                        subject_calls[tc["id"]] = args
                    except json.JSONDecodeError:
                        pass

    # tool 결과에서 subject_id 찾기
    for msg in api_messages:
        if msg.get("role") == "tool" and msg.get("tool_call_id") in subject_calls:
            try:
                result = json.loads(msg["content"])
                subject_calls[msg["tool_call_id"]]["subject_id"] = result.get("id")
            except (json.JSONDecodeError, AttributeError):
                pass

    lines = []
    for args in subject_calls.values():
        subject_id = args.get("subject_id", "?")
        name = args.get("name", "?")
        desc = args.get("description", "")
        lines.append(f"- 과목: {name} (subject_id: {subject_id}, 설명: {desc})")

    return "\n".join(lines) if lines else "과목 정보를 추출할 수 없음"
