#!/bin/sh
set -e
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /app/sql/001_init.sql || true
exec "$@"