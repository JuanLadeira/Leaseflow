from ninja import Query, Router, Status

from core.schemas import ErrorOut
from visits import services
from visits.schemas import ConflictOut, VisitFilters, VisitIn, VisitOut, VisitStatusIn

router = Router(tags=["visits"])


@router.get("/visits", response=list[VisitOut])
async def list_visits(request, filters: Query[VisitFilters]):
    """Visits overlapping [start, end). Canceled visits are hidden unless asked for."""
    return await services.list_visits(**filters.dict())


@router.post(
    "/visits",
    response={201: VisitOut, 400: ErrorOut, 404: ErrorOut, 409: ConflictOut},
)
async def schedule_visit(request, payload: VisitIn):
    try:
        visit = await services.schedule_visit(**payload.dict(), agent_id=request.auth.pk)
    except services.VisitConflictError as exc:
        return Status(409, {"detail": exc.detail, "conflict": services.to_out(exc.conflict)})
    return Status(201, visit)


@router.patch("/visits/{visit_id}", response={200: VisitOut, 400: ErrorOut, 404: ErrorOut})
async def update_visit_status(request, visit_id: int, payload: VisitStatusIn):
    return await services.change_status(visit_id, payload.status)
