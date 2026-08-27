#!/usr/bin/env bash
set -euo pipefail

backup_dir="${BACKUP_DIR:-./backups}"
timestamp="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup_dir"
output="$backup_dir/davinci-$timestamp.dump"

pg_dump --format=custom --no-owner \
  --host="${DB_HOST:-localhost}" \
  --port="${DB_PORT:-5432}" \
  --username="${DB_USER:-root}" \
  --dbname="${DB_NAME:-davinci}" \
  --file="$output"
echo "Backup written to $output"
