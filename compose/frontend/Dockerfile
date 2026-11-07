# syntax=docker/dockerfile:1
# Leaseflow frontend: Vite + React 19.
# Targets: `dev` (Vite dev server with HMR) and `prod` (static build served by nginx).

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm PATH="/pnpm:$PATH"
RUN corepack enable
WORKDIR /app
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# --- dev ---------------------------------------------------------------------------
FROM base AS dev
EXPOSE 5173
CMD ["pnpm", "dev", "--host", "0.0.0.0"]

# --- build -------------------------------------------------------------------------
FROM base AS build
COPY frontend/ ./
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm build

# --- prod: only static files + nginx -------------------------------------------------
FROM nginx:1.29-alpine AS prod
COPY compose/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
