from ninja import Query, Router, Status

from core.schemas import ErrorOut
from visits import services
from visits.schemas import ConflictOut, VisitFilters, VisitIn, VisitOut, VisitStatusIn

router = Router(tags=["visits"])


@router.get("/visits", response={200: list[VisitOut], 403: ErrorOut})
async def list_visits(request, filters: Query[VisitFilters]):
    """Visits overlapping [start, end). Canceled visits are hidden unless asked for."""
    return await services.list_visits(request.auth, **filters.dict())


@router.post(
    "/visits",
    response={201: VisitOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut, 409: ConflictOut},
)
async def schedule_visit(request, payload: VisitIn):
    try:
        visit = await services.schedule_visit(
            request.auth, **payload.dict(), agent_id=request.auth.pk
        )
    except services.VisitConflictError as exc:
        return Status(409, {"detail": exc.detail, "conflict": services.to_out(exc.conflict)})
    return Status(201, visit)


@router.patch(
    "/visits/{visit_id}", response={200: VisitOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut}
)
async def update_visit_status(request, visit_id: int, payload: VisitStatusIn):
    return await services.change_status(request.auth, visit_id, payload.status)
