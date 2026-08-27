#!/usr/bin/env bash
set -euo pipefail

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

DATA_DIR="${PG_DATA_DIR}"
echo "⚠️ 正在彻底清空数据库并重新构建启动应用..."

# 1. 停止运行中的容器
echo "🛑 步骤 1/3: 停止并删除 Docker Compose 服务..."
docker compose --env-file "${SCRIPT_DIR}/.env.docker" -f "${SCRIPT_DIR}/docker-compose.yml" down --remove-orphans || true

# 删除本项目旧的应用镜像及构建产生的悬空镜像，避免每次重建都留下
# 一个 2GB 左右的 <none> 镜像。仅清理本次部署相关的 davinci-code 标签，
# 以及 Docker 全局悬空镜像（不影响正在使用的镜像）。
echo "🧹 清理旧的 davinci-code 镜像和悬空镜像..."
docker image rm davinci-code:latest >/dev/null 2>&1 || true
docker image prune -f

# 2. 删除宿主机上的数据持久化目录
echo "🗑️ 步骤 2/3: 清空宿主机数据库持久化目录 (${DATA_DIR})..."
if [[ -d "${DATA_DIR}" && "${DATA_DIR}" != "/" && "${DATA_DIR}" != "." ]]; then
  rm -rf -- "${DATA_DIR}"
fi

# 3. 重新运行打包与启动脚本
echo "🚀 步骤 3/3: 重新运行一键打包与启动脚本 (./docker-build.sh)..."
exec "${SCRIPT_DIR}/docker-build.sh"
