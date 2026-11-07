from django.contrib import admin

from leads.models import Lead, Message


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = ["full_name", "email", "status", "source", "last_activity_at"]
    list_filter = ["status", "source"]
    search_fields = ["full_name", "email"]
    inlines = [MessageInline]
