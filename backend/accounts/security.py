from ninja.security import HttpBearer

from accounts import services


class JWTAuth(HttpBearer):
    """Async bearer auth: Ninja awaits this for async operations."""

    async def authenticate(self, request, token: str):
        user = await services.user_from_access_token(token)
        if user is not None:
            request.user = user
        return user
