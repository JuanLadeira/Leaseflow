from datetime import datetime
from uuid import UUID

from ninja import Field, Schema
from pydantic import BaseModel

from mcp_server.models import AuditEvent

# --- Token management (REST) --------------------------------------------------------


class AgentTokenIn(Schema):
    name: str = Field(min_length=1, max_length=80, examples=["Claude Code on my laptop"])
    scopes: list[str] | None = Field(
        default=None, description="Subset of the available scopes. Omit for all of them."
    )
    ttl_days: int = Field(default=7, ge=1, le=90)


class AgentTokenOut(Schema):
    id: UUID
    name: str
    scopes: list[str]
    created_at: datetime
    expires_at: datetime
    revoked_at: datetime | None
    last_used_at: datetime | None


class AgentTokenCreatedOut(AgentTokenOut):
    token: str = Field(description="Shown once. Send it as `Authorization: Bearer <token>`.")
    mcp_url: str


class AuditEventOut(Schema):
    id: int
    created_at: datetime
    token_id: UUID | None
    tool: str
    arguments: dict
    outcome: AuditEvent.Outcome
    detail: str
    duration_ms: int
    request_id: str
    client: str


# --- Tool outputs that have no REST equivalent ---------------------------------------


class DraftReplyOut(BaseModel):
    lead_id: int
    text: str
    model: str


class WhoAmIOut(BaseModel):
    user_id: int
    username: str
    roles: list[str]
    token_scopes: list[str]
    managed_property_ids: list[int] | None = Field(
        description="None means unrestricted (superuser)."
    )
