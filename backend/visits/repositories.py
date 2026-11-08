"""Data access for visits. Only ORM code lives here.

Reads take `manager_id` (None = unrestricted): a visit, its lead and its unit
belong to the portfolio of whoever manages the unit's property.
"""

from datetime import datetime

from leads.models import Lead
from properties.models import Unit
from visits.models import Visit


def _scoped(qs, manager_id: int | None, path: str):
    return qs if manager_id is None else qs.filter(**{path: manager_id})


def _with_relations(manager_id: int | None = None):
    qs = Visit.objects.select_related("lead", "unit__property", "agent")
    return _scoped(qs, manager_id, "unit__property__managers")


async def list_visits(
    manager_id: int | None,
    start: datetime | None,
    end: datetime | None,
    unit_id: int | None,
    lead_id: int | None,
    include_canceled: bool,
) -> list[Visit]:
    qs = _with_relations(manager_id)
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


async def get_visit(manager_id: int | None, visit_id: int) -> Visit | None:
    return await _with_relations(manager_id).filter(pk=visit_id).afirst()


async def get_lead(manager_id: int | None, lead_id: int) -> Lead | None:
    qs = _scoped(
        Lead.objects.select_related("unit__property"), manager_id, "unit__property__managers"
    )
    return await qs.filter(pk=lead_id).afirst()


async def get_unit(manager_id: int | None, unit_id: int) -> Unit | None:
    qs = _scoped(Unit.objects.select_related("property"), manager_id, "property__managers")
    return await qs.filter(pk=unit_id).afirst()


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
    return await get_visit(None, visit.pk)


async def update_visit(visit: Visit, **fields) -> Visit:
    for name, value in fields.items():
        setattr(visit, name, value)
    await visit.asave(update_fields=list(fields))
    return visit


async def update_lead_status(lead: Lead, status: str, when: datetime) -> None:
    lead.status = status
    lead.last_activity_at = when
    await lead.asave(update_fields=["status", "last_activity_at"])
