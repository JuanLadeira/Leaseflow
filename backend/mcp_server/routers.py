"""REST endpoints a signed-in user calls to manage their agents' access.

The MCP transport itself is not a Ninja router: see `tools.py`."""

from uuid import UUID

from ninja import Query, Router, Schema, Status

from core.schemas import ErrorOut
from mcp_server import services
from mcp_server.models import AuditEvent
from mcp_server.schemas import AgentTokenCreatedOut, AgentTokenIn, AgentTokenOut, AuditEventOut

router = Router(tags=["mcp"])


class AuditFilters(Schema):
    tool: str | None = None
    outcome: AuditEvent.Outcome | None = None
    limit: int = 100


@router.get("/scopes", response=dict[str, str])
async def list_scopes(request):
    return services.SCOPES


@router.post("/tokens", response={201: AgentTokenCreatedOut, 400: ErrorOut})
async def create_token(request, payload: AgentTokenIn):
    """Issue a token for an MCP client. It acts as you, limited to `scopes`."""
    token = await services.issue_token(request.auth, payload.name, payload.scopes, payload.ttl_days)
    return Status(201, token)


@router.get("/tokens", response=list[AgentTokenOut])
async def list_tokens(request):
    return await services.list_tokens(request.auth)


@router.delete("/tokens/{token_id}", response={204: None, 404: ErrorOut})
async def revoke_token(request, token_id: UUID):
    await services.revoke_token(request.auth, token_id)
    return Status(204, None)


@router.get("/audit", response=list[AuditEventOut])
async def list_audit(request, filters: Query[AuditFilters]):
    """What your agents did (and tried to do) through MCP, newest first."""
    return await services.list_audit(request.auth, filters.tool, filters.outcome, filters.limit)
