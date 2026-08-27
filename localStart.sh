#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

if [[ ! -f "${SCRIPT_DIR}/.env.local" ]]; then
  echo "错误：未找到 .env.local，请先在项目根目录配置本地数据库和管理员密码。" >&2
  exit 1
fi

echo "📦 安装/更新本地依赖..."
npm install

echo "🗄️ 初始化本地 PostgreSQL 数据库..."
npm run db:setup

echo "🚀 启动本地开发服务 (http://localhost:60824)..."
exec npm run dev
