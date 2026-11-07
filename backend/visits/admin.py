from django.contrib import admin

from visits.models import Visit


@admin.register(Visit)
class VisitAdmin(admin.ModelAdmin):
    list_display = ("lead", "unit", "starts_at", "ends_at", "status")
    list_filter = ("status",)
