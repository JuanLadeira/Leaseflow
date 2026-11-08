"""Django settings for Leaseflow.

Everything environment-specific comes from env vars so the same image runs in
docker-compose, CI and production. Defaults are tuned for local development.
"""

import os
from datetime import timedelta
from pathlib import Path

import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent


def env_bool(name: str, default: bool = False) -> bool:
    return os.environ.get(name, str(default)).lower() in {"1", "true", "yes"}


def env_list(name: str, default: str = "") -> list[str]:
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-insecure-secret-key-change-me")
DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,0.0.0.0,backend")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "accounts",
    "properties",
    "leads",
    "dashboard",
    "visits",
    "mcp_server",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

ASGI_APPLICATION = "config.asgi.application"
WSGI_APPLICATION = "config.wsgi.application"

# Postgres in docker-compose / CI, SQLite as a zero-setup fallback for quick local runs.
DATABASES = {
    "default": dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=0,  # async views: let Django manage per-request connections
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
)
# On Render the blueprint passes the static site's service host, which can be the
# bare service name; the public origin is <name>.onrender.com.
if FRONTEND_HOST := os.environ.get("FRONTEND_HOST"):
    if "." not in FRONTEND_HOST:
        FRONTEND_HOST += ".onrender.com"
    CORS_ALLOWED_ORIGINS.append(f"https://{FRONTEND_HOST}")

# Behind a TLS-terminating proxy (Render, nginx): trust its scheme header.
if env_bool("DJANGO_BEHIND_PROXY"):
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# --- JWT -------------------------------------------------------------------
JWT_SECRET = os.environ.get("JWT_SECRET", SECRET_KEY)
JWT_ALGORITHM = "HS256"
JWT_ACCESS_TTL = timedelta(minutes=int(os.environ.get("JWT_ACCESS_MINUTES", "30")))
JWT_REFRESH_TTL = timedelta(days=int(os.environ.get("JWT_REFRESH_DAYS", "7")))

# --- AI assistant -----------------------------------------------------------
# Without ANTHROPIC_API_KEY the assistant falls back to a deterministic local
# streamer, so the demo and the test-suite work offline.
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-opus-5-5")

# --- MCP server ---------------------------------------------------------------
# Streamable HTTP endpoint mounted next to Django (config/asgi.py). Agent tokens
# carry `aud` = MCP_RESOURCE_URL, so set it to the public URL clients connect to.
MCP_RESOURCE_URL = os.environ.get("MCP_RESOURCE_URL", "http://localhost:8000/mcp")
MCP_ISSUER_URL = os.environ.get("MCP_ISSUER_URL", "http://localhost:8000/api")
# DNS-rebinding protection: Host/Origin headers the MCP endpoint accepts.
MCP_ALLOWED_HOSTS = env_list("MCP_ALLOWED_HOSTS", "localhost:*,127.0.0.1:*,backend:*")
MCP_ALLOWED_ORIGINS = env_list("MCP_ALLOWED_ORIGINS", "http://localhost:*,http://127.0.0.1:*")

# --- Logging ------------------------------------------------------------------
# One JSON object per line for the MCP audit logger (easy to ship to any log
# store); everything else keeps Django's defaults.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"json": {"()": "core.logging.JsonFormatter"}},
    "handlers": {"json": {"class": "logging.StreamHandler", "formatter": "json"}},
    "loggers": {
        "leaseflow.mcp": {
            "handlers": ["json"],
            "level": os.environ.get("MCP_LOG_LEVEL", "INFO"),
            "propagate": False,
        },
        "mcp": {"handlers": ["json"], "level": "WARNING", "propagate": False},
    },
}
