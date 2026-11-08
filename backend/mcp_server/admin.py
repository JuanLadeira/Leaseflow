from django.contrib import admin

from mcp_server.models import AgentToken, AuditEvent


@admin.register(AgentToken)
class AgentTokenAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "scopes", "created_at", "expires_at", "revoked_at")
    list_filter = ("revoked_at",)


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = ("created_at", "user", "tool", "outcome", "duration_ms", "client")
    list_filter = ("outcome", "tool")
    search_fields = ("tool", "detail", "request_id")
