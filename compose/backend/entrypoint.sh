#!/bin/sh
# Apply migrations (and optionally seed demo data) before starting the server.
set -e

python manage.py migrate --noinput

if [ "${SEED_DEMO:-false}" = "true" ]; then
  python manage.py seed_demo
fi

exec "$@"
