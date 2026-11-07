"""Thin LLM adapter shared by every app.

Apps build prompts in their services and call `stream_text`; only this module
knows about the Anthropic SDK. Without ANTHROPIC_API_KEY, `is_configured()` is
False and callers use their own offline fallback.
"""

from collections.abc import AsyncIterator

import anthropic
from django.conf import settings

ProviderError = anthropic.APIError


def is_configured() -> bool:
    return bool(settings.ANTHROPIC_API_KEY)


def model_name() -> str:
    return settings.ANTHROPIC_MODEL


async def stream_text(system: str, user_content: str, max_tokens: int = 2048) -> AsyncIterator[str]:
    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    async with client.messages.stream(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=max_tokens,
        system=system,
        output_config={"effort": "low"},  # short drafting task: favour latency
        messages=[{"role": "user", "content": user_content}],
    ) as stream:
        async for text in stream.text_stream:
            yield text
