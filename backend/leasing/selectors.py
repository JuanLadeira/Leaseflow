"""Read-side query helpers (kept out of the API layer so they are easy to test)."""

from django.db.models import Count, Q, QuerySet

from leasing.models import Lead, Message, Property, Unit


def properties_with_stats() -> QuerySet[Property]:
    return Property.objects.annotate(
        unit_count=Count("units", distinct=True),
        vacant_count=Count("units", filter=Q(units__status=Unit.Status.VACANT), distinct=True),
    )


def occupancy(unit_count: int, vacant_count: int) -> float:
    if unit_count == 0:
        return 0.0
    return round((unit_count - vacant_count) / unit_count, 4)


def serialize_property(prop: Property) -> dict:
    return {
        "id": prop.pk,
        "name": prop.name,
        "address": prop.address,
        "city": prop.city,
        "state": prop.state,
        "image_url": prop.image_url,
        "unit_count": prop.unit_count,
        "vacant_count": prop.vacant_count,
        "occupancy_rate": occupancy(prop.unit_count, prop.vacant_count),
    }


def serialize_lead_unit(unit: Unit | None) -> dict | None:
    if unit is None:
        return None
    return {
        "id": unit.pk,
        "label": unit.label,
        "property_id": unit.property_id,
        "property_name": unit.property.name,
        "rent": unit.rent,
    }


async def lead_detail(lead_id: int) -> dict | None:
    lead = await Lead.objects.select_related("unit__property").filter(pk=lead_id).afirst()
    if lead is None:
        return None
    messages = [m async for m in Message.objects.filter(lead_id=lead_id)]
    return {
        "id": lead.pk,
        "full_name": lead.full_name,
        "email": lead.email,
        "phone": lead.phone,
        "status": lead.status,
        "source": lead.source,
        "desired_move_in": lead.desired_move_in,
        "budget": lead.budget,
        "created_at": lead.created_at,
        "last_activity_at": lead.last_activity_at,
        "unit": serialize_lead_unit(lead.unit),
        "messages": messages,
    }
