from django.db.models import Count, OuterRef, Q, Subquery
from django.db.models.functions import Left
from django.http import StreamingHttpResponse
from django.shortcuts import aget_object_or_404
from django.utils import timezone
from ninja import Query, Router, Schema, Status

from accounts.schemas import ErrorOut
from leasing.ai import stream_reply_suggestion
from leasing.models import Lead, Message, Property, Unit
from leasing.schemas import (
    DashboardOut,
    LeadDetailOut,
    LeadListOut,
    LeadStatusIn,
    MessageIn,
    MessageOut,
    Page,
    PropertyDetailOut,
    PropertyIn,
    PropertyOut,
    UnitIn,
    UnitOut,
)
from leasing.selectors import (
    lead_detail,
    occupancy,
    properties_with_stats,
    serialize_property,
)

router = Router()


# --- Properties --------------------------------------------------------------------


class PropertyFilters(Schema):
    search: str | None = None
    page: int = 1
    page_size: int = 12


@router.get("/properties", response=Page[PropertyOut])
async def list_properties(request, filters: Query[PropertyFilters]):
    qs = properties_with_stats()
    if filters.search:
        term = filters.search.strip()
        qs = qs.filter(
            Q(name__icontains=term) | Q(city__icontains=term) | Q(address__icontains=term)
        )
    page_size = max(1, min(filters.page_size, 100))
    page = max(1, filters.page)
    count = await qs.acount()
    offset = (page - 1) * page_size
    items = [serialize_property(p) async for p in qs[offset : offset + page_size]]
    return {"items": items, "count": count, "page": page, "page_size": page_size}


@router.post("/properties", response={201: PropertyOut})
async def create_property(request, payload: PropertyIn):
    prop = await Property.objects.acreate(**payload.dict())
    prop = await properties_with_stats().aget(pk=prop.pk)
    return Status(201, serialize_property(prop))


@router.get("/properties/{property_id}", response={200: PropertyDetailOut, 404: ErrorOut})
async def get_property(request, property_id: int):
    prop = await properties_with_stats().filter(pk=property_id).afirst()
    if prop is None:
        return Status(404, {"detail": "Property not found."})
    units = [u async for u in Unit.objects.filter(property_id=property_id)]
    return Status(200, {**serialize_property(prop), "units": units})


@router.post("/properties/{property_id}/units", response={201: UnitOut, 404: ErrorOut})
async def create_unit(request, property_id: int, payload: UnitIn):
    if not await Property.objects.filter(pk=property_id).aexists():
        return Status(404, {"detail": "Property not found."})
    unit = await Unit.objects.acreate(property_id=property_id, **payload.dict())
    return Status(201, unit)


# --- Leads -------------------------------------------------------------------------


class LeadFilters(Schema):
    status: Lead.Status | None = None
    search: str | None = None
    limit: int = 1000


@router.get("/leads", response=list[LeadListOut])
async def list_leads(request, filters: Query[LeadFilters]):
    last_message = Message.objects.filter(lead=OuterRef("pk")).order_by("-created_at", "-id")
    qs = Lead.objects.select_related("unit__property").annotate(
        last_message_preview=Left(Subquery(last_message.values("body")[:1]), 140)
    )
    if filters.status:
        qs = qs.filter(status=filters.status)
    if filters.search:
        term = filters.search.strip()
        qs = qs.filter(Q(full_name__icontains=term) | Q(email__icontains=term))
    limit = max(1, min(filters.limit, 5000))
    return [
        {
            "id": lead.pk,
            "full_name": lead.full_name,
            "email": lead.email,
            "status": lead.status,
            "source": lead.source,
            "unit_label": lead.unit.label if lead.unit else None,
            "property_name": lead.unit.property.name if lead.unit else None,
            "last_message_preview": lead.last_message_preview or "",
            "last_activity_at": lead.last_activity_at,
        }
        async for lead in qs[:limit]
    ]


@router.get("/leads/{lead_id}", response={200: LeadDetailOut, 404: ErrorOut})
async def get_lead(request, lead_id: int):
    data = await lead_detail(lead_id)
    if data is None:
        return Status(404, {"detail": "Lead not found."})
    return Status(200, data)


@router.patch("/leads/{lead_id}", response={200: LeadDetailOut, 404: ErrorOut})
async def update_lead_status(request, lead_id: int, payload: LeadStatusIn):
    updated = await Lead.objects.filter(pk=lead_id).aupdate(
        status=payload.status, last_activity_at=timezone.now()
    )
    if not updated:
        return Status(404, {"detail": "Lead not found."})
    return Status(200, await lead_detail(lead_id))


@router.post("/leads/{lead_id}/messages", response={201: MessageOut, 404: ErrorOut})
async def send_message(request, lead_id: int, payload: MessageIn):
    lead = await aget_object_or_404(Lead, pk=lead_id)
    message = await Message.objects.acreate(
        lead=lead,
        direction=Message.Direction.OUTBOUND,
        body=payload.body,
        ai_generated=payload.ai_generated,
    )
    lead.last_activity_at = timezone.now()
    if lead.status == Lead.Status.NEW:
        lead.status = Lead.Status.CONTACTED
    await lead.asave(update_fields=["last_activity_at", "status"])
    return Status(201, message)


@router.post("/leads/{lead_id}/reply-suggestion", response={404: ErrorOut})
async def reply_suggestion(request, lead_id: int):
    """Stream an AI-drafted reply as Server-Sent Events (`delta`, `done`, `error`)."""
    data = await lead_detail(lead_id)
    if data is None:
        return Status(404, {"detail": "Lead not found."})
    response = StreamingHttpResponse(
        stream_reply_suggestion(data), content_type="text/event-stream"
    )
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"  # disable proxy buffering (nginx)
    return response


# --- Dashboard ---------------------------------------------------------------------


@router.get("/dashboard", response=DashboardOut)
async def dashboard(request):
    units = await Unit.objects.aaggregate(
        total=Count("id"), vacant=Count("id", filter=Q(status=Unit.Status.VACANT))
    )
    by_status = {s.value: 0 for s in Lead.Status}
    async for row in Lead.objects.values("status").annotate(n=Count("id")).order_by():
        by_status[row["status"]] = row["n"]
    total_leads = sum(by_status.values())
    return {
        "total_units": units["total"],
        "vacant_units": units["vacant"],
        "occupancy_rate": occupancy(units["total"], units["vacant"]),
        "leads_by_status": by_status,
        "conversion_rate": round(by_status["won"] / total_leads, 4) if total_leads else 0.0,
    }
