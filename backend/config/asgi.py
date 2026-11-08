"""ASGI entry point: Django for the app and REST API, the MCP server at /mcp.

Both run in the same process and share the Django ORM and settings. The MCP
app also owns the ASGI lifespan, which starts the SDK's session manager.
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

django_app = get_asgi_application()  # sets Django up before anything imports models

from mcp_server.tools import build_app  # noqa: E402

MCP_PATHS = ("/mcp", "/.well-known/oauth-protected-resource")


def route(mcp_app, fallback):
    async def application(scope, receive, send):
        if scope["type"] == "lifespan":
            return await mcp_app(scope, receive, send)
        path = scope.get("path", "")
        if any(path == p or path.startswith(p + "/") for p in MCP_PATHS):
            return await mcp_app(scope, receive, send)
        return await fallback(scope, receive, send)

    return application


application = route(build_app(), django_app)
