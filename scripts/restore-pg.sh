#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <backup.dump>" >&2
  exit 2
fi
if [[ ! -f "$1" ]]; then
  echo "Backup file not found: $1" >&2
  exit 2
fi

pg_restore --clean --if-exists --no-owner \
  --host="${DB_HOST:-localhost}" \
  --port="${DB_PORT:-5432}" \
  --username="${DB_USER:-root}" \
  --dbname="${DB_NAME:-davinci}" "$1"
echo "Restored $1"
