#!/usr/bin/env bash
set -euo pipefail

# Docker deployment settings must come from the repository-local .env.docker file.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ ! -f "${SCRIPT_DIR}/.env.docker" ]]; then
  echo "错误：未找到 ${SCRIPT_DIR}/.env.docker，请配置 ADMIN_PASSWORD、PG_DATA_DIR。" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/.env.docker"
set +a

if [[ -z "${ADMIN_PASSWORD:-}" || -z "${PG_DATA_DIR:-}" ]]; then
  echo "错误：.env.docker 必须设置非空的 ADMIN_PASSWORD、PG_DATA_DIR。" >&2
  exit 1
fi

CONTAINER_NAME="${CONTAINER_NAME:-davinci-code}"
DATA_DIR="${PG_DATA_DIR}"

echo "🔨 正在构建应用镜像并启动 PostgreSQL + Next.js 服务..."
mkdir -p "${DATA_DIR}"
docker compose --env-file "${SCRIPT_DIR}/.env.docker" -f "${SCRIPT_DIR}/docker-compose.yml" down --remove-orphans
docker compose --env-file "${SCRIPT_DIR}/.env.docker" -f "${SCRIPT_DIR}/docker-compose.yml" up -d --build

echo "📋 部署完成！正在打印实时日志 (按 Ctrl+C 随时退出日志打印)..."
docker compose --env-file "${SCRIPT_DIR}/.env.docker" -f "${SCRIPT_DIR}/docker-compose.yml" logs -f app
