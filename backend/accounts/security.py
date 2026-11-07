from django.contrib.auth import get_user_model
from ninja.security import HttpBearer

from accounts.tokens import InvalidToken, decode_token

User = get_user_model()


class JWTAuth(HttpBearer):
    """Async bearer auth: Ninja awaits this for async operations."""

    async def authenticate(self, request, token: str):
        try:
            user_id = decode_token(token, "access")
        except InvalidToken:
            return None
        user = await User.objects.filter(pk=user_id, is_active=True).afirst()
        if user is None:
            return None
        request.user = user
        return user
