#!/bin/bash
set -e

echo "⚠️ 正在彻底清空数据库并重新构建启动应用..."

# 1. 停止运行中的容器
echo "🛑 步骤 1/3: 停止运行中的容器 (davinci-game)..."
docker stop davinci-game 2>/dev/null || true

# 2. 删除宿主机上的数据持久化目录
echo "🗑️ 步骤 2/3: 清空宿主机数据库持久化目录 (/root/davinci_pgdata)..."
rm -rf /root/davinci_pgdata

# 3. 重新运行打包与启动脚本
echo "🚀 步骤 3/3: 重新运行一键打包与启动脚本 (./docker-build.sh)..."
./docker-build.sh
