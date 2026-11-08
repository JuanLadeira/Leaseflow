from django.http import StreamingHttpResponse
from ninja import Query, Router, Status

from core.schemas import ErrorOut
from leads import services
from leads.schemas import (
    LeadDetailOut,
    LeadFilters,
    LeadListOut,
    LeadStatusIn,
    MessageIn,
    MessageOut,
)

router = Router(tags=["leads"])


@router.get("/leads", response={200: list[LeadListOut], 403: ErrorOut})
async def list_leads(request, filters: Query[LeadFilters]):
    return await services.list_leads(request.auth, filters.status, filters.search, filters.limit)


@router.get("/leads/{lead_id}", response={200: LeadDetailOut, 403: ErrorOut, 404: ErrorOut})
async def get_lead(request, lead_id: int):
    return await services.get_lead_detail(request.auth, lead_id)


@router.patch("/leads/{lead_id}", response={200: LeadDetailOut, 403: ErrorOut, 404: ErrorOut})
async def update_lead_status(request, lead_id: int, payload: LeadStatusIn):
    return await services.change_status(request.auth, lead_id, payload.status)


@router.post("/leads/{lead_id}/messages", response={201: MessageOut, 403: ErrorOut, 404: ErrorOut})
async def send_message(request, lead_id: int, payload: MessageIn):
    message = await services.send_message(request.auth, lead_id, payload.body, payload.ai_generated)
    return Status(201, message)


@router.post("/leads/{lead_id}/reply-suggestion", response={403: ErrorOut, 404: ErrorOut})
async def reply_suggestion(request, lead_id: int):
    """Stream an AI-drafted reply as Server-Sent Events (`delta`, `done`, `error`)."""
    stream = await services.reply_suggestion_stream(request.auth, lead_id)
    response = StreamingHttpResponse(stream, content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"  # disable proxy buffering (nginx)
    return response
