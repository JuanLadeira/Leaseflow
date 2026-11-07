# syntax=docker/dockerfile:1
# Leaseflow backend: Django + Django Ninja on uvicorn (ASGI).
# Targets: `dev` (hot reload, dev deps) and `prod` (slim, non-root).

FROM python:3.13-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir "uv>=0.9,<1"
WORKDIR /app

# --- dev: all dependency groups, source mounted as a volume by compose ------------
FROM base AS dev
COPY backend/pyproject.toml backend/uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen --no-install-project
COPY compose/backend/entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["uvicorn", "config.asgi:application", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# --- prod: runtime deps only, code baked into the image ----------------------------
FROM base AS prod
COPY backend/pyproject.toml backend/uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen --no-dev --no-install-project
COPY backend/ ./
COPY compose/backend/entrypoint.sh /entrypoint.sh
RUN useradd --create-home --uid 1000 app && chown -R app /app
USER app
EXPOSE 8000
ENTRYPOINT ["/entrypoint.sh"]
# PORT and WEB_CONCURRENCY come from the platform when it sets them (Render sets
# WEB_CONCURRENCY=1 on its free plan, where two workers can run out of memory).
CMD ["sh", "-c", "exec uvicorn config.asgi:application --host 0.0.0.0 --port ${PORT:-8000} --workers ${WEB_CONCURRENCY:-2}"]
