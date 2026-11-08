"""The MCP server, driven by the official MCP client over Streamable HTTP.

The client talks to the real ASGI app in-process (no network), so these tests
cover the whole path a real agent takes: bearer auth, the SDK transport,
scope checks, and the same domain services and permission rules as REST.
"""

import json
import logging
from contextlib import asynccontextmanager
from datetime import timedelta

import httpx2
import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from mcp import Client
from mcp.client.streamable_http import streamable_http_client

from accounts.services import create_token
from config.asgi import route
from leads.models import Lead, Message
from mcp_server import services as mcp_services
from mcp_server.models import AgentToken, AuditEvent
from mcp_server.tools import build_app
from properties.models import Property, Unit

pytestmark = pytest.mark.django_db(transaction=True)

BASE = "http://localhost:8000"


@asynccontextmanager
async def running_app():
    """A fresh MCP app with its lifespan running (the SDK's session manager runs
    once per app). Entered inside the test's own task, as anyio requires."""
    app = build_app()
    async with app.router.lifespan_context(app):
        yield app


@pytest.fixture
def connect():
    @asynccontextmanager
    async def _connect(token: str | None):
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        async with running_app() as app:
            http = httpx2.AsyncClient(
                transport=httpx2.ASGITransport(app=app), base_url=BASE, headers=headers
            )
            async with http, Client(streamable_http_client(f"{BASE}/mcp", http_client=http)) as c:
                yield c

    return _connect


async def agent_token(user, scopes=None) -> str:
    return (await mcp_services.issue_token(user, "test agent", scopes, ttl_days=1))["token"]


async def raw_post(token: str | None) -> httpx2.Response:
    """A bare `tools/list` POST, to look at HTTP-level auth responses."""
    headers = {"accept": "application/json, text/event-stream"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    async with running_app() as app:
        async with httpx2.AsyncClient(
            transport=httpx2.ASGITransport(app=app), base_url=BASE
        ) as http:
            return await http.post(
                "/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"}, headers=headers
            )


def result(res):
    assert not res.is_error, res.content[0].text
    data = res.structured_content
    return data["result"] if set(data) == {"result"} else data


def error(res) -> str:
    assert res.is_error
    return res.content[0].text


# --- Authentication --------------------------------------------------------------------


async def test_missing_token_gets_401_with_resource_metadata():
    res = await raw_post(None)
    assert res.status_code == 401
    assert "resource_metadata=" in res.headers["www-authenticate"]


async def test_app_access_token_is_not_an_agent_token(user):
    res = await raw_post(create_token(user.pk, "access"))
    assert res.status_code == 401
    event = await AuditEvent.objects.alatest("created_at")
    assert event.outcome == AuditEvent.Outcome.UNAUTHENTICATED
    assert "invalid token" in event.detail


async def test_token_for_another_resource_is_rejected(user, settings):
    token = await agent_token(user)
    settings.MCP_RESOURCE_URL = "https://evil.example/mcp"
    token_elsewhere = await agent_token(user)
    settings.MCP_RESOURCE_URL = f"{BASE}/mcp"
    assert (await raw_post(token_elsewhere)).status_code == 401
    assert (await raw_post(token)).status_code == 200


async def test_agent_token_is_not_accepted_by_the_rest_api(user, anon_client):
    token = await agent_token(user)
    res = await anon_client.get("/api/leads", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401


async def test_revoked_token_and_deactivated_user_lose_access_immediately(user):
    token = await agent_token(user)
    assert (await raw_post(token)).status_code == 200

    await AgentToken.objects.all().aupdate(revoked_at=timezone.now())
    assert (await raw_post(token)).status_code == 401

    fresh = await agent_token(user)
    await get_user_model().objects.filter(pk=user.pk).aupdate(is_active=False)
    assert (await raw_post(fresh)).status_code == 401


async def test_expired_token_is_rejected(user):
    token = await agent_token(user)
    await AgentToken.objects.all().aupdate(expires_at=timezone.now() - timedelta(seconds=1))
    assert (await raw_post(token)).status_code == 401


# --- Acting strictly as the user -------------------------------------------------------


async def test_agent_only_sees_its_users_portfolio(connect, user, lead, other_lead):
    async with connect(await agent_token(user)) as mcp:
        leads = result(await mcp.call_tool("list_leads", {}))
        assert [row["full_name"] for row in leads] == ["Ava Smith"]

        props = result(await mcp.call_tool("list_properties", {}))
        assert [p["name"] for p in props] == ["Maple Court"]

        metrics = result(await mcp.call_tool("get_dashboard", {}))
        assert metrics["total_units"] == 4


@pytest.mark.parametrize(
    ("tool", "arguments"),
    [
        ("get_lead", {}),
        ("draft_reply", {}),
        ("update_lead_status", {"status": "won"}),
        ("send_message", {"body": "Here is a discount just for you"}),
    ],
)
async def test_agent_cannot_reach_another_users_lead(
    connect, user, lead, other_lead, tool, arguments
):
    async with connect(await agent_token(user)) as mcp:
        res = await mcp.call_tool(tool, {"lead_id": other_lead.pk, **arguments})
    assert error(res).endswith("Lead not found.")
    await other_lead.arefresh_from_db()
    assert other_lead.status == Lead.Status.NEW
    assert await Message.objects.filter(lead=other_lead).acount() == 1


async def test_agent_cannot_reach_another_users_property(connect, user, other_lead):
    prop_id = (await Unit.objects.aget(pk=other_lead.unit_id)).property_id
    async with connect(await agent_token(user)) as mcp:
        assert error(await mcp.call_tool("get_property", {"property_id": prop_id})).endswith(
            "Property not found."
        )
        res = await mcp.call_tool(
            "create_unit", {"property_id": prop_id, "label": "X1", "rent": 999}
        )
        assert error(res).endswith("Property not found.")
    assert not await Unit.objects.filter(label="X1").aexists()


async def test_viewer_agent_can_read_but_not_write(connect, viewer, lead):
    await (await Property.objects.aget(name="Maple Court")).managers.aadd(viewer)
    async with connect(await agent_token(viewer)) as mcp:
        assert result(await mcp.call_tool("get_lead", {"lead_id": lead.pk}))["id"] == lead.pk

        res = await mcp.call_tool("update_lead_status", {"lead_id": lead.pk, "status": "won"})
        assert "leads.change_lead" in error(res)
        res = await mcp.call_tool("send_message", {"lead_id": lead.pk, "body": "Hi"})
        assert "leads.add_message" in error(res)
    await lead.arefresh_from_db()
    assert lead.status == Lead.Status.NEW


async def test_token_scopes_narrow_what_an_agent_can_do(connect, user, lead):
    """A leasing agent may send messages, but this token was issued read-only."""
    async with connect(await agent_token(user, scopes=["leads:read"])) as mcp:
        assert result(await mcp.call_tool("get_lead", {"lead_id": lead.pk}))
        res = await mcp.call_tool("send_message", {"lead_id": lead.pk, "body": "Hi"})
        assert "leads:write" in error(res)
        assert "properties:read" in error(await mcp.call_tool("list_properties", {}))
    assert await Message.objects.filter(lead=lead).acount() == 1


async def test_agent_workflow_draft_then_send(connect, user, lead, settings):
    settings.ANTHROPIC_API_KEY = ""  # offline drafts
    async with connect(await agent_token(user)) as mcp:
        me = result(await mcp.call_tool("whoami", {}))
        assert me["username"] == "agent" and me["roles"] == ["Leasing agent"]

        draft = result(await mcp.call_tool("draft_reply", {"lead_id": lead.pk}))
        assert draft["text"].startswith("Hi Ava")

        sent = result(
            await mcp.call_tool("send_message", {"lead_id": lead.pk, "body": draft["text"]})
        )
        assert sent["ai_generated"] is True
    await lead.arefresh_from_db()
    assert lead.status == Lead.Status.CONTACTED


# --- Logs and audit trail --------------------------------------------------------------


async def test_every_call_is_audited_with_outcome_and_redacted_body(
    connect, user, lead, other_lead
):
    token = await agent_token(user)
    async with connect(token) as mcp:
        await mcp.call_tool("send_message", {"lead_id": lead.pk, "body": "secret text"})
        await mcp.call_tool("get_lead", {"lead_id": other_lead.pk})

    events = [e async for e in AuditEvent.objects.order_by("id")]
    assert [(e.tool, e.outcome) for e in events] == [
        ("send_message", "ok"),
        ("get_lead", "not_found"),
    ]
    sent = events[0]
    assert sent.user_id == user.pk
    assert sent.token_id is not None
    assert sent.arguments == {"lead_id": lead.pk, "body": "<redacted, 11 chars>"}
    assert sent.request_id and sent.client.startswith("python-httpx")


async def test_tool_calls_emit_structured_json_logs(connect, user, lead, caplog):
    caplog.set_level(logging.INFO, logger="leaseflow.mcp")
    async with connect(await agent_token(user)) as mcp:
        await mcp.call_tool("get_lead", {"lead_id": lead.pk})

    record = next(r for r in caplog.records if r.getMessage() == "mcp.tool.call")
    assert record.event["tool"] == "get_lead"
    assert record.event["outcome"] == "ok"
    assert record.event["username"] == "agent"
    assert record.event["duration_ms"] >= 0

    from core.logging import JsonFormatter

    line = json.loads(JsonFormatter().format(record))
    assert line["event"] == "mcp.tool.call" and line["tool"] == "get_lead"


async def test_users_only_see_their_own_audit_events(auth_client, connect, other_agent, other_lead):
    async with connect(await agent_token(other_agent)) as mcp:
        await mcp.call_tool("list_leads", {})
    assert (await auth_client.get("/api/mcp/audit")).json() == []


# --- Token management (REST) -----------------------------------------------------------


async def test_issue_list_and_revoke_tokens(auth_client):
    res = await auth_client.post(
        "/api/mcp/tokens",
        {"name": "Claude Code", "scopes": ["leads:read"]},
        content_type="application/json",
    )
    assert res.status_code == 201
    body = res.json()
    assert body["scopes"] == ["leads:read"] and body["mcp_url"].endswith("/mcp")

    listed = (await auth_client.get("/api/mcp/tokens")).json()
    assert [t["name"] for t in listed] == ["Claude Code"]
    assert "token" not in listed[0]

    assert (await auth_client.delete(f"/api/mcp/tokens/{body['id']}")).status_code == 204
    assert (await auth_client.delete(f"/api/mcp/tokens/{body['id']}")).status_code == 404


async def test_unknown_scope_is_rejected(auth_client):
    res = await auth_client.post(
        "/api/mcp/tokens", {"name": "x", "scopes": ["admin"]}, content_type="application/json"
    )
    assert res.status_code == 400


async def test_cannot_revoke_someone_elses_token(auth_client, other_agent):
    token_id = (await mcp_services.issue_token(other_agent, "theirs", None, 1))["id"]
    assert (await auth_client.delete(f"/api/mcp/tokens/{token_id}")).status_code == 404


async def test_asgi_router_sends_mcp_paths_to_the_mcp_app():
    seen = []

    def app(name):
        async def _app(scope, receive, send):
            seen.append(name)

        return _app

    application = route(app("mcp"), app("django"))
    for path in ["/mcp", "/.well-known/oauth-protected-resource/mcp", "/api/leads", "/mcpx"]:
        await application({"type": "http", "path": path}, None, None)
    await application({"type": "lifespan"}, None, None)
    assert seen == ["mcp", "mcp", "django", "django", "mcp"]
