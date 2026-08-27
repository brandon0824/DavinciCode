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
IMAGE_NAME="${IMAGE_NAME:-davinci-code:latest}"
DATA_DIR="${PG_DATA_DIR}"
DB_PASSWORD_VALUE="brandon_pgdata"

echo "🛑 步骤 1/5: 正在停止已有同名容器 (${CONTAINER_NAME})..."
docker stop "${CONTAINER_NAME}" 2>/dev/null || true

echo "🧹 步骤 2/5: 正在删除已有同名容器 (${CONTAINER_NAME})..."
docker rm "${CONTAINER_NAME}" 2>/dev/null || true

echo "🗑️ 步骤 3/5: 正在删除旧 Docker 镜像 (davinci-code:latest)..."
docker rmi "${IMAGE_NAME}" 2>/dev/null || true

echo "🔨 步骤 4/5: 正在重新构建最新 Docker 镜像..."
docker build -t "${IMAGE_NAME}" .

echo "🚀 步骤 5/5: 正在启动新 Docker 容器 (Web端口仅本地: 127.0.0.1:60824, 挂载宿主机持久化目录 ${DATA_DIR})..."
mkdir -p "${DATA_DIR}"
docker run -d \
  -p 127.0.0.1:60824:60824 \
  -p 5432:5432 \
  -v "${DATA_DIR}:/var/lib/postgresql" \
  -e "DB_PASSWORD=${DB_PASSWORD_VALUE}" \
  -e "ADMIN_PASSWORD=${ADMIN_PASSWORD}" \
  --name "${CONTAINER_NAME}" \
  --restart=always \
  "${IMAGE_NAME}"

echo "📋 部署完成！正在打印实时日志 (按 Ctrl+C 随时退出日志打印)..."
docker logs -f "${CONTAINER_NAME}"
