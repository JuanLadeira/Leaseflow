from django.contrib.auth import aauthenticate, get_user_model
from ninja import Router, Status

from accounts.schemas import ErrorOut, LoginIn, RefreshIn, TokenPairOut, UserOut
from accounts.security import JWTAuth
from accounts.tokens import InvalidToken, create_token, decode_token

router = Router()
User = get_user_model()


def _pair(user_id: int) -> dict[str, str]:
    return {"access": create_token(user_id, "access"), "refresh": create_token(user_id, "refresh")}


@router.post("/login", response={200: TokenPairOut, 401: ErrorOut})
async def login(request, payload: LoginIn):
    user = await aauthenticate(request, username=payload.username, password=payload.password)
    if user is None:
        return Status(401, {"detail": "Invalid username or password."})
    return Status(200, _pair(user.pk))


@router.post("/refresh", response={200: TokenPairOut, 401: ErrorOut})
async def refresh(request, payload: RefreshIn):
    try:
        user_id = decode_token(payload.refresh, "refresh")
    except InvalidToken:
        return Status(401, {"detail": "Invalid or expired refresh token."})
    if not await User.objects.filter(pk=user_id, is_active=True).aexists():
        return Status(401, {"detail": "User not found."})
    return Status(200, _pair(user_id))


@router.get("/me", response=UserOut, auth=JWTAuth())
async def me(request):
    return request.auth
