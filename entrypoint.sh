#!/bin/bash
set -e

# Determine whether to use local postgres or external postgres
DB_HOST=${DB_HOST:-${PGHOST:-localhost}}

if [ "$DB_HOST" = "localhost" ] || [ "$DB_HOST" = "127.0.0.1" ]; then
  echo "🚀 正在检查并启动容器内置 PostgreSQL 服务..."
  
  # Ensure postgres user owns /var/lib/postgresql
  chown -R postgres:postgres /var/lib/postgresql 2>/dev/null || true

  # If cluster directory is missing or empty, create the cluster automatically
  if [ ! -d "/var/lib/postgresql/15/main" ] || [ -z "$(ls -A /var/lib/postgresql/15/main 2>/dev/null)" ]; then
    echo "📝 发现挂载的目录尚未初始化，正在自动创建 PostgreSQL 15 数据库集群..."
    sudo -u postgres pg_createcluster 15 main || true
  fi

  service postgresql start

  echo "⌛ 等待 PostgreSQL 服务启动完成..."
  until pg_isready -h localhost -p 5432; do
    sleep 1
  done

  echo "🔑 初始化 PostgreSQL root 角色与 davinci 数据库..."
  sudo -u postgres psql -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'root') THEN CREATE ROLE root WITH SUPERUSER LOGIN PASSWORD 'root'; END IF; END \$\$;"
  sudo -u postgres psql -c "SELECT 1 FROM pg_database WHERE datname = 'davinci'" | grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE davinci OWNER root;"
fi

echo "📊 执行数据库建表与 Schema 校验初始化 (node scripts/setup-pg.js)..."
node scripts/setup-pg.js

echo "🚀 启动 Next.js 生产环境服务器 (端口: 60824)..."
export PORT=60824
exec npm start
