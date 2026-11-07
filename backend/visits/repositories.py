"""Data access for visits. Only ORM code lives here."""

from datetime import datetime

from leads.models import Lead
from properties.models import Unit
from visits.models import Visit


def _with_relations():
    return Visit.objects.select_related("lead", "unit__property", "agent")


async def list_visits(
    start: datetime | None,
    end: datetime | None,
    unit_id: int | None,
    lead_id: int | None,
    include_canceled: bool,
) -> list[Visit]:
    qs = _with_relations()
    if start:
        qs = qs.filter(ends_at__gt=start)
    if end:
        qs = qs.filter(starts_at__lt=end)
    if unit_id:
        qs = qs.filter(unit_id=unit_id)
    if lead_id:
        qs = qs.filter(lead_id=lead_id)
    if not include_canceled:
        qs = qs.exclude(status=Visit.Status.CANCELED)
    return [visit async for visit in qs]


async def get_visit(visit_id: int) -> Visit | None:
    return await _with_relations().filter(pk=visit_id).afirst()


async def get_lead(lead_id: int) -> Lead | None:
    return await Lead.objects.select_related("unit__property").filter(pk=lead_id).afirst()


async def get_unit(unit_id: int) -> Unit | None:
    return await Unit.objects.select_related("property").filter(pk=unit_id).afirst()


async def find_overlap(
    *, unit_id: int, agent_id: int | None, start: datetime, end: datetime
) -> Visit | None:
    """First scheduled visit that overlaps [start, end) on the same unit or agent."""
    qs = _with_relations().filter(
        status=Visit.Status.SCHEDULED, starts_at__lt=end, ends_at__gt=start
    )
    same_unit = qs.filter(unit_id=unit_id)
    if agent_id is not None:
        same_unit = same_unit | qs.filter(agent_id=agent_id)
    return await same_unit.order_by("starts_at").afirst()


async def create_visit(**fields) -> Visit:
    visit = await Visit.objects.acreate(**fields)
    return await get_visit(visit.pk)


async def update_visit(visit: Visit, **fields) -> Visit:
    for name, value in fields.items():
        setattr(visit, name, value)
    await visit.asave(update_fields=list(fields))
    return visit


async def update_lead_status(lead: Lead, status: str, when: datetime) -> None:
    lead.status = status
    lead.last_activity_at = when
    await lead.asave(update_fields=["status", "last_activity_at"])
