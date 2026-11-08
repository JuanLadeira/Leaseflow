"""Agent access: the tokens users hand to MCP clients, and an audit trail of
everything those clients did with them."""

import uuid

from django.conf import settings
from django.db import models


class AgentToken(models.Model):
    """A user-issued credential for one MCP client.

    The JWT itself is never stored: only its `jti`, so a token can be listed,
    revoked and tied to audit events. Scopes can only narrow what the user's
    role allows, never widen it.
    """

    jti = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="agent_tokens", on_delete=models.CASCADE
    )
    name = models.CharField(max_length=80)
    scopes = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.name} ({self.user_id})"


class AuditEvent(models.Model):
    """One MCP interaction: a tool call or a rejected authentication."""

    class Outcome(models.TextChoices):
        OK = "ok", "OK"
        NOT_FOUND = "not_found", "Not found (or outside the user's portfolio)"
        FORBIDDEN = "forbidden", "Forbidden by the user's role"
        SCOPE_DENIED = "scope_denied", "Token lacks the scope"
        INVALID = "invalid", "Invalid arguments"
        ERROR = "error", "Unexpected error"
        UNAUTHENTICATED = "unauthenticated", "Token rejected"

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="agent_audit_events",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    token = models.ForeignKey(
        AgentToken, related_name="events", null=True, blank=True, on_delete=models.SET_NULL
    )
    tool = models.CharField(max_length=60, blank=True)
    arguments = models.JSONField(default=dict, blank=True)
    outcome = models.CharField(max_length=20, choices=Outcome.choices, db_index=True)
    detail = models.CharField(max_length=300, blank=True)
    duration_ms = models.PositiveIntegerField(default=0)
    request_id = models.CharField(max_length=64, blank=True)
    client = models.CharField(max_length=200, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self) -> str:
        return f"{self.tool or 'auth'} → {self.outcome}"
