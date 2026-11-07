"""Auth business logic: credential checks and the JWT access/refresh contract.

Kept deliberately small instead of pulling a full auth package: the point is
the contract (short-lived access token, longer refresh token, a `type` claim so
one can never be used as the other).
"""

from datetime import UTC, datetime
from typing import Literal

import jwt
from django.conf import settings

from accounts import repositories
from core.exceptions import AuthenticationError

TokenType = Literal["access", "refresh"]


class InvalidToken(Exception):
    pass


def create_token(user_id: int, token_type: TokenType) -> str:
    ttl = settings.JWT_ACCESS_TTL if token_type == "access" else settings.JWT_REFRESH_TTL
    now = datetime.now(UTC)
    payload = {"sub": str(user_id), "type": token_type, "iat": now, "exp": now + ttl}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str, expected_type: TokenType) -> int:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.PyJWTError as exc:
        raise InvalidToken(str(exc)) from exc
    if payload.get("type") != expected_type:
        raise InvalidToken("wrong token type")
    return int(payload["sub"])


def token_pair(user_id: int) -> dict[str, str]:
    return {"access": create_token(user_id, "access"), "refresh": create_token(user_id, "refresh")}


async def login(username: str, password: str) -> dict[str, str]:
    user = await repositories.authenticate(username, password)
    if user is None:
        raise AuthenticationError("Invalid username or password.")
    return token_pair(user.pk)


async def refresh(refresh_token: str) -> dict[str, str]:
    try:
        user_id = decode_token(refresh_token, "refresh")
    except InvalidToken as exc:
        raise AuthenticationError("Invalid or expired refresh token.") from exc
    if not await repositories.active_user_exists(user_id):
        raise AuthenticationError("User not found.")
    return token_pair(user_id)


async def user_from_access_token(token: str):
    try:
        user_id = decode_token(token, "access")
    except InvalidToken:
        return None
    return await repositories.get_active_user(user_id)
