"""The MCP entry point: tool definitions and the Streamable HTTP ASGI app.

This file is to MCP what `routers.py` is to REST: it only parses input,
calls `services.run_tool` and shapes output. Each tool states the scope it
needs and then calls the owning app's service *as the authenticated user*,
so role and portfolio checks are exactly the REST API's.
"""

from datetime import datetime
from typing import Annotated
from uuid import uuid4

from django.conf import settings
from mcp.server.auth.settings import AuthSettings
from mcp.server.mcpserver import Context, MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import ToolAnnotations
from pydantic import Field
from starlette.applications import Starlette

from dashboard import services as dashboard_services
from dashboard.schemas import DashboardOut
from leads import services as lead_services
from leads.models import Lead
from leads.schemas import LeadDetailOut, LeadListOut, MessageOut
from mcp_server import services
from mcp_server.schemas import DraftReplyOut, WhoAmIOut
from mcp_server.security import AgentTokenVerifier
from properties import services as property_services
from properties.models import Unit
from properties.schemas import PropertyDetailOut, PropertyOut, UnitIn, UnitOut
from visits import services as visit_services
from visits.models import Visit
from visits.schemas import VisitIn, VisitOut

INSTRUCTIONS = """Leaseflow is a leasing dashboard. You act as the signed-in user who
created your token: you only see the properties they manage (and those
properties' units and leads) and you can only do what their role allows.
"Not found" can mean the record belongs to someone else. Messages you send
are recorded as AI-generated and go straight to the prospect, so draft first
with `draft_reply` and confirm with your user before `send_message`."""

READ = ToolAnnotations(readOnlyHint=True, openWorldHint=False)
WRITE = ToolAnnotations(readOnlyHint=False, destructiveHint=False, openWorldHint=False)
SEND = ToolAnnotations(readOnlyHint=False, destructiveHint=False, openWorldHint=True)


def _meta(ctx: Context) -> services.CallMeta:
    headers = ctx.headers or {}
    request = getattr(ctx.request_context, "request", None)
    client = getattr(request, "client", None)
    return services.CallMeta(
        # The JSON-RPC id repeats across connections; prefer the caller's correlation id.
        request_id=headers.get("x-request-id") or f"{uuid4().hex[:12]}:{ctx.request_id}",
        client=headers.get("user-agent", ""),
        ip=getattr(client, "host", None),
    )


async def _run(ctx: Context, tool: str, scopes: tuple[str, ...], action, **arguments):
    try:
        return await services.run_tool(tool, scopes, action, arguments, _meta(ctx))
    except services.ToolFailure as exc:
        raise ToolError(exc.detail) from exc


def build_server() -> MCPServer:
    mcp = MCPServer(
        name="leaseflow",
        title="Leaseflow",
        instructions=INSTRUCTIONS,
        version="1.0.0",
        token_verifier=AgentTokenVerifier(),
        auth=AuthSettings(
            issuer_url=settings.MCP_ISSUER_URL,
            resource_server_url=settings.MCP_RESOURCE_URL,
            # The verifier already pins `aud` to MCP_RESOURCE_URL; this repeats the
            # check in the SDK so a token minted for another resource never gets in.
            validate_token_resource=True,
        ),
    )

    @mcp.tool(annotations=READ)
    async def whoami(ctx: Context) -> WhoAmIOut:
        """Who you are acting as: user, roles, token scopes and the property ids you manage."""
        return await _run(ctx, "whoami", (), services.whoami)

    @mcp.tool(annotations=READ)
    async def list_properties(
        ctx: Context,
        search: Annotated[str | None, Field(description="Matches name, city or address")] = None,
        page: Annotated[int, Field(ge=1)] = 1,
        page_size: Annotated[int, Field(ge=1, le=100)] = 20,
    ) -> list[PropertyOut]:
        """Properties in your portfolio with unit counts and occupancy."""

        async def action(agent):
            data = await property_services.list_properties(agent.user, search, page, page_size)
            return [PropertyOut.model_validate(p) for p in data["items"]]

        return await _run(
            ctx, "list_properties", ("properties:read",), action,
            search=search, page=page, page_size=page_size,
        )  # fmt: skip

    @mcp.tool(annotations=READ)
    async def get_property(ctx: Context, property_id: int) -> PropertyDetailOut:
        """One property with all its units (rent, status, availability)."""

        async def action(agent):
            data = await property_services.get_property(agent.user, property_id)
            return PropertyDetailOut.model_validate(data)

        return await _run(
            ctx, "get_property", ("properties:read",), action, property_id=property_id
        )

    @mcp.tool(annotations=WRITE)
    async def create_unit(
        ctx: Context,
        property_id: int,
        label: Annotated[str, Field(min_length=1, max_length=20)],
        rent: Annotated[float, Field(gt=0, description="Monthly rent in USD")],
        bedrooms: Annotated[int, Field(ge=0, le=10)] = 1,
        bathrooms: Annotated[float, Field(ge=0, le=10)] = 1,
        square_feet: Annotated[int, Field(gt=0)] = 650,
        status: Unit.Status = Unit.Status.VACANT,
    ) -> UnitOut:
        """Add a unit to a property you manage. Needs a role that can add units."""
        payload = UnitIn(
            label=label, rent=rent, bedrooms=bedrooms, bathrooms=bathrooms,
            square_feet=square_feet, status=status,
        )  # fmt: skip

        async def action(agent):
            unit = await property_services.create_unit(agent.user, property_id, payload.dict())
            return UnitOut.model_validate(unit)

        return await _run(
            ctx, "create_unit", ("properties:write",), action,
            property_id=property_id, **payload.model_dump(mode="json"),
        )  # fmt: skip

    @mcp.tool(annotations=READ)
    async def list_leads(
        ctx: Context,
        status: Lead.Status | None = None,
        search: Annotated[str | None, Field(description="Matches name or email")] = None,
        limit: Annotated[int, Field(ge=1, le=200)] = 50,
    ) -> list[LeadListOut]:
        """Leads in your portfolio, most recent activity first."""

        async def action(agent):
            rows = await lead_services.list_leads(agent.user, status, search, limit)
            return [LeadListOut.model_validate(r) for r in rows]

        return await _run(
            ctx, "list_leads", ("leads:read",), action,
            status=status, search=search, limit=limit,
        )  # fmt: skip

    @mcp.tool(annotations=READ)
    async def get_lead(ctx: Context, lead_id: int) -> LeadDetailOut:
        """A lead with the unit they want and the full conversation."""

        async def action(agent):
            return LeadDetailOut.model_validate(
                await lead_services.get_lead_detail(agent.user, lead_id)
            )

        return await _run(ctx, "get_lead", ("leads:read",), action, lead_id=lead_id)

    @mcp.tool(annotations=READ)
    async def draft_reply(ctx: Context, lead_id: int) -> DraftReplyOut:
        """Draft the next reply to a lead with the AI assistant. Nothing is sent."""

        async def action(agent):
            return DraftReplyOut(**await lead_services.draft_reply(agent.user, lead_id))

        return await _run(ctx, "draft_reply", ("leads:read",), action, lead_id=lead_id)

    @mcp.tool(annotations=WRITE)
    async def update_lead_status(ctx: Context, lead_id: int, status: Lead.Status) -> LeadDetailOut:
        """Move a lead through the pipeline (e.g. to tour_scheduled after booking a tour)."""

        async def action(agent):
            return LeadDetailOut.model_validate(
                await lead_services.change_status(agent.user, lead_id, status)
            )

        return await _run(
            ctx, "update_lead_status", ("leads:write",), action, lead_id=lead_id, status=status
        )

    @mcp.tool(annotations=SEND)
    async def send_message(
        ctx: Context,
        lead_id: int,
        body: Annotated[str, Field(min_length=1, max_length=4000)],
    ) -> MessageOut:
        """Send a message to the prospect. It is recorded as AI-generated. Confirm first."""

        async def action(agent):
            message = await lead_services.send_message(agent.user, lead_id, body, ai_generated=True)
            return MessageOut.model_validate(message)

        return await _run(ctx, "send_message", ("leads:write",), action, lead_id=lead_id, body=body)

    @mcp.tool(annotations=READ)
    async def get_dashboard(ctx: Context) -> DashboardOut:
        """Occupancy, vacant units and the leads funnel for your portfolio."""

        async def action(agent):
            return DashboardOut.model_validate(await dashboard_services.get_metrics(agent.user))

        return await _run(ctx, "get_dashboard", ("properties:read", "leads:read"), action)

    @mcp.tool(annotations=READ)
    async def list_visits(
        ctx: Context,
        start: Annotated[datetime | None, Field(description="ISO 8601 with offset")] = None,
        end: Annotated[datetime | None, Field(description="ISO 8601 with offset")] = None,
        lead_id: int | None = None,
        include_canceled: bool = False,
    ) -> list[VisitOut]:
        """Tours in your portfolio overlapping [start, end)."""

        async def action(agent):
            rows = await visit_services.list_visits(
                agent.user, start, end, lead_id=lead_id, include_canceled=include_canceled
            )
            return [VisitOut.model_validate(v) for v in rows]

        return await _run(
            ctx, "list_visits", ("visits:read",), action,
            start=start, end=end, lead_id=lead_id, include_canceled=include_canceled,
        )  # fmt: skip

    @mcp.tool(annotations=SEND)
    async def schedule_visit(
        ctx: Context,
        lead_id: int,
        starts_at: Annotated[datetime, Field(description="ISO 8601 with offset")],
        ends_at: Annotated[datetime, Field(description="ISO 8601 with offset, max 2h later")],
        unit_id: Annotated[int | None, Field(description="Defaults to the lead's unit")] = None,
        notes: Annotated[str, Field(max_length=1000)] = "",
    ) -> VisitOut:
        """Book a tour with you as the agent. Fails on overlaps for the unit or for you.
        Moves a new or contacted lead to tour_scheduled."""

        async def action(agent):
            payload = VisitIn(
                lead_id=lead_id, unit_id=unit_id, starts_at=starts_at, ends_at=ends_at, notes=notes
            )
            visit = await visit_services.schedule_visit(
                agent.user, **payload.dict(), agent_id=agent.user.pk
            )
            return VisitOut.model_validate(visit)

        return await _run(
            ctx, "schedule_visit", ("visits:write",), action,
            lead_id=lead_id, unit_id=unit_id, starts_at=starts_at, ends_at=ends_at, notes=notes,
        )  # fmt: skip

    @mcp.tool(annotations=WRITE)
    async def update_visit_status(ctx: Context, visit_id: int, status: Visit.Status) -> VisitOut:
        """Mark a tour completed or canceled. Canceled tours free their slot."""

        async def action(agent):
            visit = await visit_services.change_status(agent.user, visit_id, status)
            return VisitOut.model_validate(visit)

        return await _run(
            ctx, "update_visit_status", ("visits:write",), action,
            visit_id=visit_id, status=status,
        )  # fmt: skip

    return mcp


def build_app() -> Starlette:
    """A fresh server + ASGI app. Stateless Streamable HTTP: every POST carries its
    own bearer token, so nothing ties a request to a server-side session."""
    return build_server().streamable_http_app(
        streamable_http_path="/mcp",
        stateless_http=True,
        transport_security=TransportSecuritySettings(
            enable_dns_rebinding_protection=True,
            allowed_hosts=settings.MCP_ALLOWED_HOSTS,
            allowed_origins=settings.MCP_ALLOWED_ORIGINS,
        ),
    )
