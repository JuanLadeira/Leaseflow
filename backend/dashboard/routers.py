from ninja import Router

from core.schemas import ErrorOut
from dashboard import services
from dashboard.schemas import DashboardOut

router = Router(tags=["dashboard"])


@router.get("/dashboard", response={200: DashboardOut, 403: ErrorOut})
async def dashboard(request):
    return await services.get_metrics(request.auth)
