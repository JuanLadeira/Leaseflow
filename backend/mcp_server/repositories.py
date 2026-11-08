"""Data access for agent tokens and the audit trail. Only ORM code lives here."""

from datetime import datetime
from uuid import UUID

from django.utils import timezone

from mcp_server.models import AgentToken, AuditEvent


async def create_token(user_id: int, name: str, scopes: list[str], expires_at) -> AgentToken:
    return await AgentToken.objects.acreate(
        user_id=user_id, name=name, scopes=scopes, expires_at=expires_at
    )


async def get_active_token(jti: UUID) -> AgentToken | None:
    """A token that exists, is not revoked and is not past its expiry."""
    return (
        await AgentToken.objects.filter(
            pk=jti, revoked_at__isnull=True, expires_at__gt=timezone.now()
        )
        .select_related("user")
        .afirst()
    )


async def touch_token(jti: UUID, when: datetime) -> None:
    await AgentToken.objects.filter(pk=jti).aupdate(last_used_at=when)


async def list_tokens(user_id: int) -> list[AgentToken]:
    return [t async for t in AgentToken.objects.filter(user_id=user_id)]


async def revoke_token(user_id: int, jti: UUID) -> bool:
    updated = await AgentToken.objects.filter(
        pk=jti, user_id=user_id, revoked_at__isnull=True
    ).aupdate(revoked_at=timezone.now())
    return updated == 1


async def record_event(**fields) -> AuditEvent:
    return await AuditEvent.objects.acreate(**fields)


async def list_events(user_id: int, tool: str | None, outcome: str | None, limit: int):
    qs = AuditEvent.objects.filter(user_id=user_id)
    if tool:
        qs = qs.filter(tool=tool)
    if outcome:
        qs = qs.filter(outcome=outcome)
    return [e async for e in qs[:limit]]
