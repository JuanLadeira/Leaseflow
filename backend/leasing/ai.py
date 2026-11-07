"""AI reply assistant.

Builds a prompt from the lead, the unit they're interested in and the
conversation so far, then streams a suggested reply. The frontend consumes the
stream token by token (Server-Sent Events over a POST + fetch ReadableStream).

When ANTHROPIC_API_KEY is not configured we stream a deterministic, template
based reply instead, so the product demo and the test-suite run offline.
"""

import asyncio
import json
from collections.abc import AsyncIterator

import anthropic
from django.conf import settings

SYSTEM_PROMPT = """You are a leasing assistant for a property management company.
You draft replies that a human leasing agent will review before sending.

Rules:
- Be warm, concise and professional. 3 to 6 sentences, plain text, no markdown.
- Only state facts present in the context (rent, unit, availability). Never invent \
amenities, fees, discounts or policies. If something is unknown, offer to confirm it.
- Always end with one clear next step, ideally proposing a tour time.
- Write in the same language the prospect used.
- Sign off as "The Leasing Team"."""


def build_context(lead: dict) -> str:
    unit = lead.get("unit")
    lines = [
        f"Prospect: {lead['full_name']} (status: {lead['status']}, source: {lead['source']})",
    ]
    if lead.get("desired_move_in"):
        lines.append(f"Desired move-in: {lead['desired_move_in']}")
    if lead.get("budget"):
        lines.append(f"Budget: ${lead['budget']}/month")
    if unit:
        lines.append(
            f"Interested in: {unit['property_name']}, unit {unit['label']}, "
            f"rent ${unit['rent']}/month"
        )
    lines.append("\nConversation so far (oldest first):")
    for msg in lead["messages"]:
        who = "Prospect" if msg.direction == "inbound" else "Agent"
        lines.append(f"{who}: {msg.body}")
    lines.append("\nDraft the agent's next reply.")
    return "\n".join(lines)


async def _anthropic_stream(context: str) -> AsyncIterator[str]:
    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    async with client.messages.stream(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=2048,
        system=SYSTEM_PROMPT,
        output_config={"effort": "low"},  # short drafting task: favour latency
        messages=[{"role": "user", "content": context}],
    ) as stream:
        async for text in stream.text_stream:
            yield text


def fallback_reply(lead: dict) -> str:
    first_name = lead["full_name"].split()[0]
    unit = lead.get("unit")
    if unit:
        offer = (
            f"Unit {unit['label']} at {unit['property_name']} is listed at "
            f"${unit['rent']:,.0f}/month and I'd be happy to show it to you."
        )
    else:
        offer = "I'd be happy to share the units that match what you're looking for."
    return (
        f"Hi {first_name}, thanks for reaching out! {offer} "
        "Would Thursday at 5:30 PM or Saturday at 11:00 AM work for a tour? "
        "If you have any questions about the application process, just reply here.\n\n"
        "The Leasing Team"
    )


async def _fallback_stream(lead: dict, delay: float) -> AsyncIterator[str]:
    for word in fallback_reply(lead).split(" "):
        yield word + " "
        if delay:
            await asyncio.sleep(delay)


def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def stream_reply_suggestion(
    lead: dict, *, fallback_delay: float = 0.03
) -> AsyncIterator[str]:
    """Yield SSE frames: `delta` (text chunk), then `done` or `error`."""
    use_llm = bool(settings.ANTHROPIC_API_KEY)
    chunks = (
        _anthropic_stream(build_context(lead))
        if use_llm
        else _fallback_stream(lead, fallback_delay)
    )
    try:
        async for chunk in chunks:
            yield sse("delta", {"text": chunk})
    except anthropic.APIError as exc:
        yield sse("error", {"detail": f"AI provider error: {exc.__class__.__name__}"})
        return
    yield sse("done", {"model": settings.ANTHROPIC_MODEL if use_llm else "offline-template"})
