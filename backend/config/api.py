from ninja import NinjaAPI

from accounts.api import router as auth_router
from accounts.security import JWTAuth
from leasing.api import router as leasing_router

api = NinjaAPI(
    title="Leaseflow API",
    version="1.0.0",
    description="Leasing dashboard API: properties, units, leads and an AI reply assistant.",
    urls_namespace="api",
)

api.add_router("/auth", auth_router, tags=["auth"])
api.add_router("/", leasing_router, auth=JWTAuth(), tags=["leasing"])


@api.get("/health", tags=["meta"])
async def health(request):
    return {"status": "ok"}
