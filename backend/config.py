import os
from dotenv import load_dotenv

load_dotenv()

# API Keys
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GROK_API_KEY = os.getenv("GROK_API_KEY", "")

# Provider configs
PROVIDERS = {
    "claude": {
        "name": "Claude",
        "description": "일반 번역 — 자연스럽고 맥락 파악 우수",
        "api_key": ANTHROPIC_API_KEY,
        "model": "claude-haiku-4-5-20251001",
        "type": "anthropic",
    },
    "gpt": {
        "name": "GPT",
        "description": "전문 번역 — 기술/법률/의료 용어 강점",
        "api_key": OPENAI_API_KEY,
        "model": "gpt-5-mini",
        "type": "openai",
    },
    "grok": {
        "name": "Grok",
        "description": "직설 번역 — 필터 없이 원문 뉘앙스 그대로",
        "api_key": GROK_API_KEY,
        "model": "grok-3-fast",
        "type": "openai",  # Grok uses OpenAI-compatible API
    },
}

DEFAULT_PROVIDER = "claude"
MAX_TOKENS = 4096
TEMPERATURE = 0.3
MAX_INPUT_LENGTH = 3000

# Review config
REVIEW_MODEL = "claude-sonnet-4-20250514"
REVIEW_MAX_TOKENS = 2048
REVIEW_TEMPERATURE = 0.2
