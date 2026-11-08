"""Bearer-token verification for the MCP transport (the SDK's TokenVerifier protocol)."""

from mcp.server.auth.provider import AccessToken

from mcp_server import services


class AgentTokenVerifier:
    async def verify_token(self, token: str) -> AccessToken | None:
        result = await services.authenticate(token)
        if result is None:
            return None  # the SDK answers 401 with a WWW-Authenticate challenge
        claims, row = result
        return AccessToken(
            token=token,
            client_id=f"agent-token:{row.jti}",
            scopes=list(row.scopes),
            expires_at=int(claims["exp"]),
            resource=claims.get("aud"),
            subject=claims["sub"],
            claims={"jti": str(row.jti)},
        )
