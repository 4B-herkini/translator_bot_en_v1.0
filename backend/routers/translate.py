import json
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse
from anthropic import Anthropic
from openai import OpenAI

from backend.config import (
    PROVIDERS, DEFAULT_PROVIDER, MAX_TOKENS, TEMPERATURE, MAX_INPUT_LENGTH,
    ANTHROPIC_API_KEY, REVIEW_MODEL, REVIEW_MAX_TOKENS, REVIEW_TEMPERATURE,
)
from backend.prompts.translation import SYSTEM_PROMPT, SYSTEM_PROMPT_GROK, REVIEW_PROMPT

router = APIRouter()

SECTION_MARKERS = {
    "[NORMALIZED]": "normalization",
    "[/NORMALIZED]": "normalization_done",
    "[PROFESSIONAL]": "professional",
    "[/PROFESSIONAL]": "professional_done",
    "[FRIENDLY]": "friendly",
    "[/FRIENDLY]": "friendly_done",
    "[CONCISE]": "concise",
    "[/CONCISE]": "concise_done",
}

OPEN_TAGS = {"[NORMALIZED]", "[PROFESSIONAL]", "[FRIENDLY]", "[CONCISE]"}
CLOSE_TAGS = {"[/NORMALIZED]", "[/PROFESSIONAL]", "[/FRIENDLY]", "[/CONCISE]"}


def sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def get_system_prompt(provider_id: str) -> str:
    if provider_id == "grok":
        return SYSTEM_PROMPT_GROK
    return SYSTEM_PROMPT


def stream_anthropic(text: str, api_key: str, model: str, system_prompt: str):
    client = Anthropic(api_key=api_key)
    with client.messages.stream(
        model=model,
        max_tokens=MAX_TOKENS,
        temperature=TEMPERATURE,
        system=system_prompt,
        messages=[{"role": "user", "content": text}],
    ) as stream:
        for token in stream.text_stream:
            yield token


def stream_openai(text: str, api_key: str, model: str, system_prompt: str, base_url: str = None):
    kwargs = {"api_key": api_key}
    if base_url:
        kwargs["base_url"] = base_url
    client = OpenAI(**kwargs)
    params = {
        "model": model,
        "temperature": TEMPERATURE,
        "stream": True,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text},
        ],
    }
    # GPT-5 series uses max_completion_tokens and doesn't support temperature
    if model.startswith("gpt-5"):
        params["max_completion_tokens"] = MAX_TOKENS
        del params["temperature"]
    else:
        params["max_tokens"] = MAX_TOKENS
    stream = client.chat.completions.create(**params)
    for chunk in stream:
        delta = chunk.choices[0].delta
        if delta.content:
            yield delta.content


def get_token_stream(text: str, provider_id: str):
    provider = PROVIDERS[provider_id]
    system_prompt = get_system_prompt(provider_id)

    if provider["type"] == "anthropic":
        yield from stream_anthropic(text, provider["api_key"], provider["model"], system_prompt)
    elif provider["type"] == "openai":
        base_url = None
        if provider_id == "grok":
            base_url = "https://api.x.ai/v1"
        yield from stream_openai(text, provider["api_key"], provider["model"], system_prompt, base_url)


REVIEW_MARKERS = {
    "[REVIEW]": "review",
    "[/REVIEW]": "review_done",
    "[REVISED_PROFESSIONAL]": "revised_professional",
    "[/REVISED_PROFESSIONAL]": "revised_professional_done",
    "[REVISED_FRIENDLY]": "revised_friendly",
    "[/REVISED_FRIENDLY]": "revised_friendly_done",
    "[REVISED_CONCISE]": "revised_concise",
    "[/REVISED_CONCISE]": "revised_concise_done",
}


def run_review(original_text: str, translations: dict) -> dict | None:
    if not ANTHROPIC_API_KEY:
        return None

    client = Anthropic(api_key=ANTHROPIC_API_KEY)

    review_input = f"""## Original Input
{original_text}

## Normalized
{translations['normalized']}

## Professional
{translations['professional']}

## Friendly
{translations['friendly']}

## Concise
{translations['concise']}"""

    response = client.messages.create(
        model=REVIEW_MODEL,
        max_tokens=REVIEW_MAX_TOKENS,
        temperature=REVIEW_TEMPERATURE,
        system=REVIEW_PROMPT,
        messages=[{"role": "user", "content": review_input}],
    )

    result_text = response.content[0].text
    return parse_review_response(result_text)


def parse_review_response(text: str) -> dict:
    result = {}
    sections = {
        "review": "",
        "changes": "",
        "revised_professional": "",
        "revised_friendly": "",
        "revised_concise": "",
    }

    tag_map = {
        "[REVIEW]": "review", "[/REVIEW]": None,
        "[CHANGES]": "changes", "[/CHANGES]": None,
        "[REVISED_PROFESSIONAL]": "revised_professional", "[/REVISED_PROFESSIONAL]": None,
        "[REVISED_FRIENDLY]": "revised_friendly", "[/REVISED_FRIENDLY]": None,
        "[REVISED_CONCISE]": "revised_concise", "[/REVISED_CONCISE]": None,
    }

    current = None
    for line in text.split("\n"):
        stripped = line.strip()
        if stripped in tag_map:
            current = tag_map[stripped]
        elif current:
            sections[current] += line + "\n"

    result["summary"] = sections["review"].strip()
    result["changes"] = sections["changes"].strip()
    result["revised_professional"] = sections["revised_professional"].strip()
    result["revised_friendly"] = sections["revised_friendly"].strip()
    result["revised_concise"] = sections["revised_concise"].strip()

    return result


def parse_and_stream(text: str, provider_id: str):
    current_section = None
    buffer = ""
    section_contents = {
        "normalization": "",
        "professional": "",
        "friendly": "",
        "concise": "",
    }

    for token in get_token_stream(text, provider_id):
        buffer += token

        while buffer:
            marker_found = False

            for marker, event_name in SECTION_MARKERS.items():
                idx = buffer.find(marker)
                if idx != -1:
                    before = buffer[:idx].strip("\n")
                    if before and current_section:
                        section_contents[current_section] += before
                        if current_section == "normalization":
                            yield sse_event("normalization", {"token": before})
                        else:
                            yield sse_event("translation", {"tone": current_section, "token": before})

                    buffer = buffer[idx + len(marker):]

                    if marker in OPEN_TAGS:
                        current_section = event_name
                    elif marker in CLOSE_TAGS:
                        if current_section == "normalization":
                            yield sse_event("normalization_done", {
                                "full_text": section_contents["normalization"].strip()
                            })
                        current_section = None

                    marker_found = True
                    break

            if not marker_found:
                possible_partial = False
                for marker in SECTION_MARKERS:
                    for i in range(1, len(marker)):
                        if buffer.endswith(marker[:i]):
                            possible_partial = True
                            break
                    if possible_partial:
                        break

                if possible_partial:
                    break
                else:
                    if current_section and buffer:
                        section_contents[current_section] += buffer
                        if current_section == "normalization":
                            yield sse_event("normalization", {"token": buffer})
                        else:
                            yield sse_event("translation", {"tone": current_section, "token": buffer})
                    buffer = ""

    if buffer and current_section:
        section_contents[current_section] += buffer
        if current_section == "normalization":
            yield sse_event("normalization", {"token": buffer})
        else:
            yield sse_event("translation", {"tone": current_section, "token": buffer})

    # --- Review phase ---
    original_results = {
        "normalized": section_contents["normalization"].strip(),
        "professional": section_contents["professional"].strip(),
        "friendly": section_contents["friendly"].strip(),
        "concise": section_contents["concise"].strip(),
    }

    if ANTHROPIC_API_KEY:
        yield sse_event("review_start", {})
        try:
            review_result = run_review(text, original_results)
            if review_result:
                yield sse_event("review_done", review_result)
                # Use revised translations if available
                final = {
                    "normalized": original_results["normalized"],
                    "professional": review_result.get("revised_professional", original_results["professional"]),
                    "friendly": review_result.get("revised_friendly", original_results["friendly"]),
                    "concise": review_result.get("revised_concise", original_results["concise"]),
                    "review": review_result,
                }
                yield sse_event("done", final)
            else:
                yield sse_event("done", original_results)
        except Exception as e:
            import traceback
            traceback.print_exc()
            yield sse_event("done", original_results)
    else:
        yield sse_event("done", original_results)


@router.get("/providers")
async def get_providers():
    available = {}
    for pid, conf in PROVIDERS.items():
        available[pid] = {
            "name": conf["name"],
            "description": conf["description"],
            "available": bool(conf["api_key"]),
        }
    return available


@router.post("/translate")
async def translate(request: Request):
    body = await request.json()
    text = body.get("text", "").strip()
    provider_id = body.get("provider", DEFAULT_PROVIDER)

    if not text:
        return StreamingResponse(
            iter([sse_event("error", {"message": "텍스트를 입력해주세요."})]),
            media_type="text/event-stream",
        )

    if len(text) > MAX_INPUT_LENGTH:
        return StreamingResponse(
            iter([sse_event("error", {"message": f"입력은 {MAX_INPUT_LENGTH}자까지 가능합니다."})]),
            media_type="text/event-stream",
        )

    if provider_id not in PROVIDERS:
        return StreamingResponse(
            iter([sse_event("error", {"message": f"지원하지 않는 엔진: {provider_id}"})]),
            media_type="text/event-stream",
        )

    provider = PROVIDERS[provider_id]
    if not provider["api_key"]:
        return StreamingResponse(
            iter([sse_event("error", {"message": f"{provider['name']} API 키가 설정되지 않았습니다."})]),
            media_type="text/event-stream",
        )

    def event_generator():
        try:
            yield from parse_and_stream(text, provider_id)
        except Exception as e:
            yield sse_event("error", {"message": str(e)})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
