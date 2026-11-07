from ninja import Router

from dashboard import services
from dashboard.schemas import DashboardOut

router = Router(tags=["dashboard"])


@router.get("/dashboard", response=DashboardOut)
async def dashboard(request):
    return await services.get_metrics()
