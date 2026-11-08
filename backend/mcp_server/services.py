"""Agent access rules: issuing tokens, authenticating MCP calls, and running
every tool through one audited, permission-checked path.

How an MCP tool call is authorized (all of it, nothing else):

1. `security.AgentTokenVerifier` checks the JWT (signature, expiry,
   `type=mcp`, `aud` = this MCP server) and that its token row is not
   revoked and its user is still active. Otherwise: HTTP 401.
2. `run_tool` checks the token carries the tool's scope.
3. The tool calls the owning app's service *as the user*: the same role
   (Django permission) and portfolio checks as the REST API apply.

So an agent can do at most what its user can do, and less if the token's
scopes say so. There is no service account and no bypass.
"""

import logging
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import timedelta
from typing import Any
from uuid import UUID

from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser
from django.utils import timezone
from mcp.server.auth.middleware.auth_context import get_access_token

from accounts import repositories as accounts_repo
from accounts import services as accounts_services
from accounts.services import InvalidToken
from core.exceptions import DomainError, NotFoundError, PermissionDeniedError
from mcp_server import repositories
from mcp_server.models import AgentToken, AuditEvent
from properties import services as properties_services

logger = logging.getLogger("leaseflow.mcp")

SCOPES: dict[str, str] = {
    "properties:read": "List and read properties, units and portfolio metrics.",
    "properties:write": "Add units to properties.",
    "leads:read": "List and read leads and conversations, draft replies.",
    "leads:write": "Change a lead's status and send messages to prospects.",
}

MAX_LOGGED_STRING = 120
REDACTED_ARGUMENTS = {"body"}  # message text to prospects: log its size, not its content


class ScopeDeniedError(PermissionDeniedError):
    pass


class ToolFailure(Exception):
    """Raised by `run_tool` after auditing; the MCP layer turns it into an error result."""

    def __init__(self, detail: str):
        super().__init__(detail)
        self.detail = detail


@dataclass(frozen=True)
class CallMeta:
    """Transport details of one call, for the audit trail only (never for decisions)."""

    request_id: str = ""
    client: str = ""
    ip: str | None = None


@dataclass(frozen=True)
class Agent:
    """Who is acting: the user, through which token, limited to which scopes."""

    user: AbstractBaseUser
    token_id: UUID
    scopes: frozenset[str]


# --- Tokens ---------------------------------------------------------------------------


def _check_scopes(scopes: list[str] | None) -> list[str]:
    if scopes is None:
        return list(SCOPES)
    unknown = sorted(set(scopes) - set(SCOPES))
    if unknown:
        raise DomainError(f"Unknown scopes: {', '.join(unknown)}.")
    if not scopes:
        raise DomainError("A token needs at least one scope.")
    return sorted(set(scopes))


async def issue_token(user: AbstractBaseUser, name: str, scopes: list[str] | None, ttl_days: int):
    scopes = _check_scopes(scopes)
    ttl = timedelta(days=ttl_days)
    row = await repositories.create_token(user.pk, name, scopes, timezone.now() + ttl)
    jwt = accounts_services.create_token(
        user.pk,
        "mcp",
        ttl=ttl,
        claims={"jti": str(row.jti), "aud": settings.MCP_RESOURCE_URL, "scope": " ".join(scopes)},
    )
    logger.info(
        "mcp.token.issued",
        extra={"event": {"user_id": user.pk, "token_id": str(row.jti), "scopes": scopes}},
    )
    return {**_token_out(row), "token": jwt, "mcp_url": settings.MCP_RESOURCE_URL}


def _token_out(row: AgentToken) -> dict:
    return {
        "id": row.jti,
        "name": row.name,
        "scopes": row.scopes,
        "created_at": row.created_at,
        "expires_at": row.expires_at,
        "revoked_at": row.revoked_at,
        "last_used_at": row.last_used_at,
    }


async def list_tokens(user: AbstractBaseUser) -> list[dict]:
    return [_token_out(t) for t in await repositories.list_tokens(user.pk)]


async def revoke_token(user: AbstractBaseUser, token_id: UUID) -> None:
    if not await repositories.revoke_token(user.pk, token_id):
        raise NotFoundError("Token not found.")
    logger.info(
        "mcp.token.revoked", extra={"event": {"user_id": user.pk, "token_id": str(token_id)}}
    )


async def list_audit(user: AbstractBaseUser, tool: str | None, outcome: str | None, limit: int):
    return await repositories.list_events(user.pk, tool, outcome, max(1, min(limit, 500)))


# --- Authentication -----------------------------------------------------------------


async def authenticate(raw_token: str) -> tuple[dict, AgentToken] | None:
    """Return (claims, token row) for a usable MCP token, else None. Every rejection
    is logged and audited with its reason."""
    try:
        claims = accounts_services.decode_claims(
            raw_token, "mcp", audience=settings.MCP_RESOURCE_URL
        )
        jti = UUID(claims["jti"])
    except (InvalidToken, KeyError, ValueError) as exc:
        await _reject(f"invalid token: {exc}")
        return None

    row = await repositories.get_active_token(jti)
    if row is None:
        await _reject("token revoked or expired", user_id=int(claims["sub"]))
        return None
    if row.user_id != int(claims["sub"]) or not row.user.is_active:
        await _reject("user inactive", user_id=row.user_id, token_id=row.jti)
        return None
    await repositories.touch_token(row.jti, timezone.now())
    return claims, row


async def _reject(reason: str, user_id: int | None = None, token_id: UUID | None = None):
    logger.warning(
        "mcp.auth.rejected",
        extra={"event": {"reason": reason, "user_id": user_id, "token_id": _str(token_id)}},
    )
    await repositories.record_event(
        user_id=user_id,
        token_id=token_id,
        outcome=AuditEvent.Outcome.UNAUTHENTICATED,
        detail=reason[:300],
    )


async def current_agent() -> Agent:
    """Resolve the acting user for this request from the verified bearer token.

    The user is re-read from the database on every call, so deactivating a user
    or revoking a token takes effect immediately."""
    access = get_access_token()
    if access is None or not access.claims:
        raise PermissionDeniedError("Not authenticated.")
    user = await accounts_repo.get_active_user(int(access.subject or 0))
    if user is None:
        raise PermissionDeniedError("User is no longer active.")
    return Agent(user=user, token_id=UUID(access.claims["jti"]), scopes=frozenset(access.scopes))


# --- Tool execution --------------------------------------------------------------------


def redact(arguments: dict[str, Any]) -> dict[str, Any]:
    safe = {}
    for key, value in arguments.items():
        if key in REDACTED_ARGUMENTS and isinstance(value, str):
            safe[key] = f"<redacted, {len(value)} chars>"
        elif isinstance(value, str) and len(value) > MAX_LOGGED_STRING:
            safe[key] = value[:MAX_LOGGED_STRING] + "…"
        else:
            safe[key] = value if isinstance(value, int | float | bool | None) else str(value)
    return safe


_OUTCOMES: list[tuple[type[Exception], str]] = [
    (ScopeDeniedError, AuditEvent.Outcome.SCOPE_DENIED),
    (PermissionDeniedError, AuditEvent.Outcome.FORBIDDEN),
    (NotFoundError, AuditEvent.Outcome.NOT_FOUND),
    (DomainError, AuditEvent.Outcome.INVALID),
]


async def run_tool(
    tool: str,
    required_scopes: tuple[str, ...],
    action: Callable[[Agent], Awaitable[Any]],
    arguments: dict[str, Any],
    meta: CallMeta,
) -> Any:
    """The single path every MCP tool takes: resolve the agent, check scopes, run the
    domain service as the user, then log and audit the outcome (success or not)."""
    started = time.perf_counter()
    agent: Agent | None = None
    outcome, detail = AuditEvent.Outcome.OK, ""
    try:
        agent = await current_agent()
        missing = [s for s in required_scopes if s not in agent.scopes]
        if missing:
            raise ScopeDeniedError(f"This token lacks the scope(s): {', '.join(missing)}.")
        return await action(agent)
    except DomainError as exc:
        outcome = next(o for cls, o in _OUTCOMES if isinstance(exc, cls))
        detail = exc.detail
        raise ToolFailure(exc.detail) from exc
    except Exception as exc:
        outcome, detail = AuditEvent.Outcome.ERROR, f"{exc.__class__.__name__}: {exc}"
        logger.exception("mcp.tool.crashed", extra={"event": {"tool": tool}})
        raise ToolFailure("Internal error. It has been logged.") from exc
    finally:
        duration_ms = round((time.perf_counter() - started) * 1000)
        safe_args = redact(arguments)
        event = {
            "tool": tool,
            "outcome": outcome,
            "detail": detail,
            "user_id": agent.user.pk if agent else None,
            "username": agent.user.get_username() if agent else None,
            "token_id": _str(agent.token_id) if agent else None,
            "scopes": sorted(agent.scopes) if agent else None,
            "arguments": safe_args,
            "duration_ms": duration_ms,
            "request_id": meta.request_id,
            "client": meta.client,
            "ip": meta.ip,
        }
        level = logging.INFO if outcome == AuditEvent.Outcome.OK else logging.WARNING
        logger.log(level, "mcp.tool.call", extra={"event": event})
        await repositories.record_event(
            user_id=event["user_id"],
            token_id=agent.token_id if agent else None,
            tool=tool,
            arguments=safe_args,
            outcome=outcome,
            detail=detail[:300],
            duration_ms=duration_ms,
            request_id=meta.request_id[:64],
            client=meta.client[:200],
            ip=meta.ip,
        )


async def whoami(agent: Agent) -> dict:
    return {
        "user_id": agent.user.pk,
        "username": agent.user.get_username(),
        "roles": await accounts_repo.role_names(agent.user.pk),
        "token_scopes": sorted(agent.scopes),
        "managed_property_ids": await properties_services.managed_property_ids(agent.user),
    }


def _str(value: object) -> str | None:
    return None if value is None else str(value)
