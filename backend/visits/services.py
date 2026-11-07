"""Tour scheduling rules.

- A visit needs a lead and a unit (the lead's unit of interest by default).
- No double booking: a unit, or an agent, can't have two scheduled visits that overlap.
- Visits can't be booked in the past.
- Booking a tour moves an early-stage lead (new / contacted) to `tour_scheduled`.
"""

from datetime import datetime

from django.utils import timezone

from core.exceptions import ConflictError, DomainError, NotFoundError
from leads.models import Lead
from visits import repositories
from visits.models import Visit

EARLY_STAGES = {Lead.Status.NEW, Lead.Status.CONTACTED}


class VisitConflictError(ConflictError):
    def __init__(self, conflict: Visit):
        when = timezone.localtime(conflict.starts_at).strftime("%b %d, %H:%M")
        super().__init__(
            f"{conflict.unit.label} at {conflict.unit.property.name} already has a "
            f"visit with {conflict.lead.full_name} at {when}."
        )
        self.conflict = conflict


def to_out(visit: Visit) -> dict:
    agent = visit.agent
    return {
        "id": visit.pk,
        "lead_id": visit.lead_id,
        "lead_name": visit.lead.full_name,
        "unit_id": visit.unit_id,
        "unit_label": visit.unit.label,
        "property_id": visit.unit.property_id,
        "property_name": visit.unit.property.name,
        "agent_id": visit.agent_id,
        "agent_name": (agent.get_full_name() or agent.username) if agent else None,
        "starts_at": visit.starts_at,
        "ends_at": visit.ends_at,
        "status": visit.status,
        "notes": visit.notes,
    }


async def list_visits(
    start: datetime | None = None,
    end: datetime | None = None,
    unit_id: int | None = None,
    lead_id: int | None = None,
    include_canceled: bool = False,
) -> list[dict]:
    visits = await repositories.list_visits(start, end, unit_id, lead_id, include_canceled)
    return [to_out(v) for v in visits]


async def schedule_visit(
    *,
    lead_id: int,
    unit_id: int | None,
    starts_at: datetime,
    ends_at: datetime,
    notes: str = "",
    agent_id: int | None = None,
) -> dict:
    lead = await repositories.get_lead(lead_id)
    if lead is None:
        raise NotFoundError("Lead not found.")

    unit_id = unit_id or lead.unit_id
    if unit_id is None:
        raise DomainError("This lead has no unit of interest. Pick a unit.")
    if await repositories.get_unit(unit_id) is None:
        raise NotFoundError("Unit not found.")

    now = timezone.now()
    if starts_at < now:
        raise DomainError("Visits can't be booked in the past.")

    conflict = await repositories.find_overlap(
        unit_id=unit_id, agent_id=agent_id, start=starts_at, end=ends_at
    )
    if conflict is not None:
        raise VisitConflictError(conflict)

    visit = await repositories.create_visit(
        lead=lead,
        unit_id=unit_id,
        agent_id=agent_id,
        starts_at=starts_at,
        ends_at=ends_at,
        notes=notes.strip(),
    )
    if lead.status in EARLY_STAGES:
        await repositories.update_lead_status(lead, Lead.Status.TOUR_SCHEDULED, now)
    return to_out(visit)


async def change_status(visit_id: int, status: str) -> dict:
    visit = await repositories.get_visit(visit_id)
    if visit is None:
        raise NotFoundError("Visit not found.")
    if visit.status != Visit.Status.SCHEDULED and status == Visit.Status.SCHEDULED:
        raise DomainError("A canceled or completed visit can't be reopened. Book a new one.")
    await repositories.update_visit(visit, status=status)
    return to_out(visit)
