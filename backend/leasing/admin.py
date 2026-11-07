from django.contrib import admin

from leasing.models import Lead, Message, Property, Unit


class UnitInline(admin.TabularInline):
    model = Unit
    extra = 0


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0


@admin.register(Property)
class PropertyAdmin(admin.ModelAdmin):
    list_display = ["name", "city", "state"]
    search_fields = ["name", "address", "city"]
    inlines = [UnitInline]


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = ["full_name", "email", "status", "source", "last_activity_at"]
    list_filter = ["status", "source"]
    search_fields = ["full_name", "email"]
    inlines = [MessageInline]


admin.site.register(Unit)
