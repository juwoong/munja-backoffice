#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_ROOT}"

echo "Starting local Postgres (service: db)..."
docker compose up -d db

echo "Waiting for Postgres to accept connections..."
until docker compose exec -T db pg_isready -U postgres -d backoffice >/dev/null 2>&1; do
  sleep 1
  echo "  still waiting..."
done

echo "Postgres is ready on port 5432. Use DATABASE_URL=postgresql://postgres:postgres@localhost:5432/backoffice?schema=public"
