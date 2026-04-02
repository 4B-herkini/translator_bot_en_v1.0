import json
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse
from anthropic import Anthropic
from openai import OpenAI

from backend.config import PROVIDERS, DEFAULT_PROVIDER, MAX_TOKENS, TEMPERATURE, MAX_INPUT_LENGTH
from backend.prompts.translation import SYSTEM_PROMPT, SYSTEM_PROMPT_GROK

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
    stream = client.chat.completions.create(
        model=model,
        temperature=TEMPERATURE,
        max_tokens=MAX_TOKENS,
        stream=True,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text},
        ],
    )
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

    yield sse_event("done", {
        "normalized": section_contents["normalization"].strip(),
        "professional": section_contents["professional"].strip(),
        "friendly": section_contents["friendly"].strip(),
        "concise": section_contents["concise"].strip(),
    })


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
