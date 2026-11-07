"""Minimal JWT helpers (access + refresh) built on PyJWT.

Kept deliberately small instead of pulling a full auth package: the interview
point is the contract (short-lived access token, longer refresh token,
`type` claim so one can't be used as the other).
"""

from datetime import UTC, datetime
from typing import Literal

import jwt
from django.conf import settings

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
