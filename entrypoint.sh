#!/bin/bash
set -e

# Determine whether to use local postgres or external postgres
DB_HOST=${DB_HOST:-${PGHOST:-localhost}}

if [ "$DB_HOST" = "localhost" ] || [ "$DB_HOST" = "127.0.0.1" ]; then
  echo "🚀 正在检查并启动容器内置 PostgreSQL 服务..."
  
  # Ensure postgres user owns /var/lib/postgresql
  chown -R postgres:postgres /var/lib/postgresql 2>/dev/null || true

  # If cluster data directory is missing or empty, recreate configuration and cluster
  if [ ! -d "/var/lib/postgresql/15/main" ] || [ -z "$(ls -A /var/lib/postgresql/15/main 2>/dev/null)" ]; then
    echo "📝 发现挂载的数据目录尚未初始化，正在为您自动构建全新的 PostgreSQL 15 数据库集群..."
    pg_dropcluster 15 main 2>/dev/null || true
    pg_createcluster 15 main
    chown -R postgres:postgres /var/lib/postgresql
  fi

  echo "🌐 配置 PostgreSQL 允许外网远程 IP 访问 (listen_addresses = '*', ssl = off)..."
  PG_CONF="/etc/postgresql/15/main/postgresql.conf"
  PG_HBA="/etc/postgresql/15/main/pg_hba.conf"

  if [ -f "$PG_CONF" ]; then
    sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/g" "$PG_CONF" 2>/dev/null || true
    sed -i "s/listen_addresses = 'localhost'/listen_addresses = '*'/g" "$PG_CONF" 2>/dev/null || true
    sed -i "s/ssl = on/ssl = off/g" "$PG_CONF" 2>/dev/null || true
    grep -q "listen_addresses = '*'" "$PG_CONF" || echo "listen_addresses = '*'" >> "$PG_CONF" 2>/dev/null || true
  fi

  if [ -f "$PG_HBA" ]; then
    grep -q "0.0.0.0/0" "$PG_HBA" || echo "host all all 0.0.0.0/0 md5" >> "$PG_HBA" 2>/dev/null || true
    grep -q "0.0.0.0/0" "$PG_HBA" || echo "host all all 0.0.0.0/0 trust" >> "$PG_HBA" 2>/dev/null || true
  fi

  echo "⚡ 启动/重启 PostgreSQL 15 服务..."
  service postgresql restart || service postgresql start

  echo "⌛ 等待 PostgreSQL 服务就绪..."
  until pg_isready -h localhost -p 5432; do
    sleep 1
  done

  echo "🔑 初始化与同步 PostgreSQL root 账号及其安全密码 (Shithappen0824)..."
  sudo -u postgres psql -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'root') THEN CREATE ROLE root WITH SUPERUSER LOGIN PASSWORD 'Shithappen0824'; ELSE ALTER USER root WITH PASSWORD 'Shithappen0824'; END IF; END \$\$;"
  sudo -u postgres psql -c "SELECT 1 FROM pg_database WHERE datname = 'davinci'" | grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE davinci OWNER root;"
fi

echo "📊 执行数据库建表与 Schema 校验初始化 (node scripts/setup-pg.js)..."
export DB_PASSWORD=Shithappen0824
node scripts/setup-pg.js

echo "🚀 启动 Next.js 生产环境服务器 (端口: 60824)..."
export PORT=60824
export DB_PASSWORD=Shithappen0824
exec npm start
