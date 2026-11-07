from django.contrib import admin

from properties.models import Property, Unit


class UnitInline(admin.TabularInline):
    model = Unit
    extra = 0


@admin.register(Property)
class PropertyAdmin(admin.ModelAdmin):
    list_display = ["name", "city", "state"]
    search_fields = ["name", "address", "city"]
    inlines = [UnitInline]


admin.site.register(Unit)
