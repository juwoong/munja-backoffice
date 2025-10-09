#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_ROOT}"

echo "Stopping local Postgres (service: db)..."
docker compose stop db

if docker compose ps -a db >/dev/null 2>&1; then
  echo "Container stopped. To remove volumes run: docker compose rm -f db"
fi
