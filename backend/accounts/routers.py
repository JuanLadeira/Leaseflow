from ninja import Router

from accounts import services
from accounts.schemas import LoginIn, RefreshIn, TokenPairOut, UserOut
from accounts.security import JWTAuth
from core.schemas import ErrorOut

router = Router(tags=["auth"])


@router.post("/login", response={200: TokenPairOut, 401: ErrorOut})
async def login(request, payload: LoginIn):
    return await services.login(payload.username, payload.password)


@router.post("/refresh", response={200: TokenPairOut, 401: ErrorOut})
async def refresh(request, payload: RefreshIn):
    return await services.refresh(payload.refresh)


@router.get("/me", response=UserOut, auth=JWTAuth())
async def me(request):
    return request.auth
