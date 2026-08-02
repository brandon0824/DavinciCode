#!/bin/bash
set -e

echo "🛑 步骤 1/5: 正在停止已有同名容器 (davinci-game)..."
docker stop davinci-game 2>/dev/null || true

echo "🧹 步骤 2/5: 正在删除已有同名容器 (davinci-game)..."
docker rm davinci-game 2>/dev/null || true

echo "🗑️ 步骤 3/5: 正在删除旧 Docker 镜像 (davinci-code:latest)..."
docker rmi davinci-code:latest 2>/dev/null || true

echo "🔨 步骤 4/5: 正在重新构建最新 Docker 镜像..."
docker build -t davinci-code:latest .

echo "🚀 步骤 5/5: 正在启动新 Docker 容器 (端口: 60824, 挂载宿主机持久化目录 /root/davinci_pgdata)..."
docker run -d \
  -p 60824:60824 \
  -v /root/davinci_pgdata:/var/lib/postgresql \
  --name davinci-game \
  --restart=always \
  davinci-code:latest

echo "📋 部署完成！正在打印实时日志 (按 Ctrl+C 随时退出日志打印)..."
docker logs -f davinci-game
