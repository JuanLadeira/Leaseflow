"""Lead pipeline rules and the AI reply assistant.

The assistant builds a prompt from the lead, the unit they're interested in
and the conversation so far, then streams a suggested reply as Server-Sent
Events. Without an API key it streams a deterministic template, so the demo
and the test-suite run offline.
"""

import asyncio
import json
from collections.abc import AsyncIterator

from django.contrib.auth.models import AbstractBaseUser
from django.utils import timezone

from accounts.permissions import portfolio_of, require
from core import llm
from core.exceptions import NotFoundError
from leads import repositories
from leads.models import Lead, Message

# --- Leads --------------------------------------------------------------------------


def _unit_summary(lead: Lead) -> dict | None:
    unit = lead.unit
    if unit is None:
        return None
    return {
        "id": unit.pk,
        "label": unit.label,
        "property_id": unit.property_id,
        "property_name": unit.property.name,
        "rent": unit.rent,
    }


async def list_leads(
    user: AbstractBaseUser, status: str | None, search: str | None, limit: int
) -> list[dict]:
    await require(user, "leads.view_lead")
    term = search.strip() if search else None
    leads = await repositories.list_leads(
        portfolio_of(user), status, term, max(1, min(limit, 5000))
    )
    return [
        {
            "id": lead.pk,
            "full_name": lead.full_name,
            "email": lead.email,
            "status": lead.status,
            "source": lead.source,
            "unit_id": lead.unit_id,
            "unit_label": lead.unit.label if lead.unit else None,
            "property_name": lead.unit.property.name if lead.unit else None,
            "last_message_preview": lead.last_message_preview or "",
            "last_activity_at": lead.last_activity_at,
        }
        for lead in leads
    ]


async def _get_or_404(user: AbstractBaseUser, lead_id: int) -> Lead:
    """Leads outside the user's portfolio are reported as missing, never as forbidden."""
    lead = await repositories.get_lead(portfolio_of(user), lead_id)
    if lead is None:
        raise NotFoundError("Lead not found.")
    return lead


async def get_lead_detail(user: AbstractBaseUser, lead_id: int) -> dict:
    await require(user, "leads.view_lead", "leads.view_message")
    lead = await _get_or_404(user, lead_id)
    return {
        "id": lead.pk,
        "full_name": lead.full_name,
        "email": lead.email,
        "phone": lead.phone,
        "status": lead.status,
        "source": lead.source,
        "desired_move_in": lead.desired_move_in,
        "budget": lead.budget,
        "created_at": lead.created_at,
        "last_activity_at": lead.last_activity_at,
        "unit": _unit_summary(lead),
        "messages": await repositories.list_messages(lead_id),
    }


async def change_status(user: AbstractBaseUser, lead_id: int, status: str) -> dict:
    await require(user, "leads.change_lead")
    lead = await _get_or_404(user, lead_id)
    await repositories.update_lead(lead, status=status, last_activity_at=timezone.now())
    return await get_lead_detail(user, lead_id)


async def send_message(
    user: AbstractBaseUser, lead_id: int, body: str, ai_generated: bool
) -> Message:
    """Record an agent reply. The first reply moves a `new` lead to `contacted`."""
    await require(user, "leads.add_message")
    lead = await _get_or_404(user, lead_id)
    message = await repositories.create_message(
        lead, direction=Message.Direction.OUTBOUND, body=body, ai_generated=ai_generated
    )
    fields = {"last_activity_at": timezone.now()}
    if lead.status == Lead.Status.NEW:
        fields["status"] = Lead.Status.CONTACTED
    await repositories.update_lead(lead, **fields)
    return message


# --- AI reply assistant ---------------------------------------------------------------

SYSTEM_PROMPT = """You are a leasing assistant for a property management company.
You draft replies that a human leasing agent will review before sending.

Rules:
- Be warm, concise and professional. 3 to 6 sentences, plain text, no markdown.
- Only state facts present in the context (rent, unit, availability). Never invent \
amenities, fees, discounts or policies. If something is unknown, offer to confirm it.
- Always end with one clear next step, ideally proposing a tour time.
- Write in the same language the prospect used.
- Sign off as "The Leasing Team"."""


LANGUAGE_NAMES = {"en": "English", "pt": "Brazilian Portuguese"}


def ui_language_name(accept_language: str | None) -> str | None:
    """Map the agent's UI language (first Accept-Language tag) to a name the model understands."""
    if not accept_language:
        return None
    primary = accept_language.split(",")[0].split(";")[0].strip().lower()
    return LANGUAGE_NAMES.get(primary.split("-")[0])


def build_context(lead: dict, ui_language: str | None = None) -> str:
    unit = lead.get("unit")
    lines = [f"Prospect: {lead['full_name']} (status: {lead['status']}, source: {lead['source']})"]
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
        who = "Prospect" if msg.direction == Message.Direction.INBOUND else "Agent"
        lines.append(f"{who}: {msg.body}")
    if ui_language:
        # The reply goes to the prospect, so their language wins; the agent's UI
        # language only breaks the tie when the conversation doesn't show one.
        lines.append(f"\nIf the prospect's language is unclear, write in {ui_language}.")
    lines.append("\nDraft the agent's next reply.")
    return "\n".join(lines)


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
    lead: dict, *, ui_language: str | None = None, fallback_delay: float = 0.03
) -> AsyncIterator[str]:
    """Yield SSE frames: `delta` (text chunk), then `done` or `error`."""
    use_llm = llm.is_configured()
    if use_llm:
        chunks = llm.stream_text(SYSTEM_PROMPT, build_context(lead, ui_language))
    else:
        chunks = _fallback_stream(lead, fallback_delay)
    try:
        async for chunk in chunks:
            yield sse("delta", {"text": chunk})
    except llm.ProviderError as exc:
        yield sse("error", {"detail": f"AI provider error: {exc.__class__.__name__}"})
        return
    yield sse("done", {"model": llm.model_name() if use_llm else "offline-template"})


async def reply_suggestion_stream(
    user: AbstractBaseUser, lead_id: int, accept_language: str | None = None
) -> AsyncIterator[str]:
    # Resolve the lead before streaming starts so a missing lead is a clean 404.
    lead = await get_lead_detail(user, lead_id)
    return stream_reply_suggestion(lead, ui_language=ui_language_name(accept_language))


async def draft_reply(user: AbstractBaseUser, lead_id: int) -> dict:
    """Non-streaming variant for callers that want the whole draft (the MCP tool)."""
    lead = await get_lead_detail(user, lead_id)
    use_llm = llm.is_configured()
    if use_llm:
        text = "".join(
            [chunk async for chunk in llm.stream_text(SYSTEM_PROMPT, build_context(lead))]
        )
    else:
        text = fallback_reply(lead)
    return {
        "lead_id": lead_id,
        "text": text,
        "model": llm.model_name() if use_llm else "offline-template",
    }
