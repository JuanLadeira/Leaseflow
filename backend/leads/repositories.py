"""Data access for leads and their conversations. Only ORM code lives here.

Reads take `manager_id` (None = unrestricted): a lead belongs to the portfolio
of whoever manages the property of the unit it is interested in.
"""

from django.db.models import Count, OuterRef, Q, QuerySet, Subquery
from django.db.models.functions import Left

from leads.models import Lead, Message


def _in_portfolio(qs: QuerySet[Lead], manager_id: int | None) -> QuerySet[Lead]:
    return qs if manager_id is None else qs.filter(unit__property__managers=manager_id)


async def list_leads(
    manager_id: int | None, status: str | None, search: str | None, limit: int
) -> list[Lead]:
    last_message = Message.objects.filter(lead=OuterRef("pk")).order_by("-created_at", "-id")
    qs = _in_portfolio(Lead.objects.select_related("unit__property"), manager_id).annotate(
        last_message_preview=Left(Subquery(last_message.values("body")[:1]), 140)
    )
    if status:
        qs = qs.filter(status=status)
    if search:
        qs = qs.filter(Q(full_name__icontains=search) | Q(email__icontains=search))
    return [lead async for lead in qs[:limit]]


async def get_lead(manager_id: int | None, lead_id: int) -> Lead | None:
    qs = _in_portfolio(Lead.objects.select_related("unit__property"), manager_id)
    return await qs.filter(pk=lead_id).afirst()


async def list_messages(lead_id: int) -> list[Message]:
    return [m async for m in Message.objects.filter(lead_id=lead_id)]


async def update_lead(lead: Lead, **fields) -> Lead:
    for name, value in fields.items():
        setattr(lead, name, value)
    await lead.asave(update_fields=list(fields))
    return lead


async def create_message(lead: Lead, **fields) -> Message:
    return await Message.objects.acreate(lead=lead, **fields)


async def count_by_status(manager_id: int | None) -> dict[str, int]:
    rows = (
        _in_portfolio(Lead.objects.all(), manager_id)
        .values("status")
        .annotate(n=Count("id", distinct=True))
        .order_by()
    )
    return {row["status"]: row["n"] async for row in rows}
