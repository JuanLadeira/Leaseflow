from ninja import NinjaAPI

from accounts.routers import router as auth_router
from accounts.security import JWTAuth
from core.exceptions import DomainError
from dashboard.routers import router as dashboard_router
from leads.routers import router as leads_router
from mcp_server.routers import router as mcp_router
from properties.routers import router as properties_router

api = NinjaAPI(
    title="Leaseflow API",
    version="1.0.0",
    description="Leasing dashboard API: properties, units, leads and an AI reply assistant.",
    urls_namespace="api",
)


@api.exception_handler(DomainError)
def domain_error(request, exc: DomainError):
    """Services raise domain errors; this is the only place they become HTTP."""
    return api.create_response(request, {"detail": exc.detail}, status=exc.status_code)


api.add_router("/auth", auth_router)
api.add_router("/", properties_router, auth=JWTAuth())
api.add_router("/", leads_router, auth=JWTAuth())
api.add_router("/", dashboard_router, auth=JWTAuth())
api.add_router("/mcp", mcp_router, auth=JWTAuth())


@api.get("/health", tags=["meta"])
async def health(request):
    return {"status": "ok"}
