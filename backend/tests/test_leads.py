import json

import pytest

from leasing.ai import build_context, fallback_reply
from leasing.models import Lead, Message

pytestmark = pytest.mark.django_db(transaction=True)


async def test_list_leads_with_preview_and_filter(auth_client, lead):
    await Lead.objects.acreate(full_name="Leo King", email="leo@example.com", status="lost")
    res = await auth_client.get("/api/leads", {"status": "new"})
    assert res.status_code == 200
    rows = res.json()
    assert [r["full_name"] for r in rows] == ["Ava Smith"]
    assert rows[0]["last_message_preview"] == "Is 1B still available?"
    assert rows[0]["property_name"] == "Maple Court"


async def test_lead_detail_includes_conversation(auth_client, lead):
    res = await auth_client.get(f"/api/leads/{lead.pk}")
    body = res.json()
    assert body["unit"]["label"] == "1B"
    assert body["messages"][0]["direction"] == "inbound"


async def test_update_lead_status(auth_client, lead):
    res = await auth_client.patch(
        f"/api/leads/{lead.pk}", {"status": "tour_scheduled"}, content_type="application/json"
    )
    assert res.status_code == 200
    assert res.json()["status"] == "tour_scheduled"


async def test_update_lead_status_rejects_unknown_value(auth_client, lead):
    res = await auth_client.patch(
        f"/api/leads/{lead.pk}", {"status": "maybe"}, content_type="application/json"
    )
    assert res.status_code == 422


async def test_send_message_marks_new_lead_as_contacted(auth_client, lead):
    res = await auth_client.post(
        f"/api/leads/{lead.pk}/messages",
        {"body": "Yes! Want to tour Saturday?", "ai_generated": True},
        content_type="application/json",
    )
    assert res.status_code == 201
    assert res.json()["ai_generated"] is True
    await lead.arefresh_from_db()
    assert lead.status == "contacted"
    assert await Message.objects.filter(lead=lead).acount() == 2


async def test_reply_suggestion_streams_sse_frames(auth_client, lead, settings):
    settings.ANTHROPIC_API_KEY = ""  # force the offline streamer
    res = await auth_client.post(f"/api/leads/{lead.pk}/reply-suggestion")
    assert res.status_code == 200
    assert res["Content-Type"] == "text/event-stream"
    raw = b"".join([chunk async for chunk in res.streaming_content]).decode()
    frames = [f for f in raw.split("\n\n") if f]
    events = [f.split("\n")[0].removeprefix("event: ") for f in frames]
    assert events[-1] == "done"
    text = "".join(
        json.loads(f.split("\n")[1].removeprefix("data: "))["text"]
        for f in frames
        if f.startswith("event: delta")
    )
    assert text.startswith("Hi Ava")
    assert "1B" in text


async def test_reply_suggestion_404(auth_client):
    res = await auth_client.post("/api/leads/999/reply-suggestion")
    assert res.status_code == 404


async def test_dashboard_metrics(auth_client, lead):
    res = await auth_client.get("/api/dashboard")
    body = res.json()
    assert body["total_units"] == 4
    assert body["occupancy_rate"] == 0.75
    assert body["leads_by_status"]["new"] == 1


def test_prompt_context_contains_facts_only_from_db():
    msg = Message(direction="inbound", body="Do you allow cats?")
    lead = {
        "full_name": "Ava Smith",
        "status": "new",
        "source": "zillow",
        "desired_move_in": None,
        "budget": None,
        "unit": {"property_name": "Maple Court", "label": "1B", "rent": 1900},
        "messages": [msg],
    }
    ctx = build_context(lead)
    assert "Maple Court, unit 1B, rent $1900/month" in ctx
    assert "Prospect: Do you allow cats?" in ctx
    assert fallback_reply(lead).startswith("Hi Ava")
