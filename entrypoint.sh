#!/bin/bash
set -e

echo "📊 执行数据库建表与 Schema 校验初始化 (node scripts/setup-pg.js)..."
node scripts/setup-pg.js

echo "🚀 启动 Next.js 生产环境服务器 (端口: 60824)..."
exec npm start
