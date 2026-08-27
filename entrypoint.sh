#!/bin/bash
set -e

# Determine whether to use local postgres or external postgres
DB_HOST=${DB_HOST:-${PGHOST:-localhost}}

if [ "${REQUIRE_SECURE_CONFIG:-false}" = "true" ] && { [ -z "${DB_PASSWORD:-}" ] || [ -z "${ADMIN_PASSWORD:-}" ]; }; then
  echo "❌ REQUIRE_SECURE_CONFIG=true 时必须设置 DB_PASSWORD 和 ADMIN_PASSWORD"
  exit 1
fi

if [ "$DB_HOST" = "localhost" ] || [ "$DB_HOST" = "127.0.0.1" ]; then
  echo "🚀 正在检查并启动容器内置 PostgreSQL 服务..."
  
  # Ensure postgres user owns /var/lib/postgresql
  chown -R postgres:postgres /var/lib/postgresql /var/log/postgresql 2>/dev/null || true

  # If cluster data directory is missing or empty, recreate configuration and cluster
  if [ ! -d "/var/lib/postgresql/15/main" ] || [ -z "$(ls -A /var/lib/postgresql/15/main 2>/dev/null)" ]; then
    echo "📝 发现挂载的数据目录尚未初始化，正在为您自动构建全新的 PostgreSQL 15 数据库集群..."
    pg_dropcluster 15 main 2>/dev/null || true
    pg_createcluster 15 main -u postgres
    chown -R postgres:postgres /var/lib/postgresql /var/log/postgresql
  fi

  echo "🌐 配置 PostgreSQL 监听容器网络，允许通过受密码保护的 IP:5432 访问..."
  PG_CONF="/etc/postgresql/15/main/postgresql.conf"
  PG_HBA="/etc/postgresql/15/main/pg_hba.conf"

  if [ -f "$PG_CONF" ]; then
    sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/g" "$PG_CONF" 2>/dev/null || true
    sed -i "s/listen_addresses = 'localhost'/listen_addresses = '*'/g" "$PG_CONF" 2>/dev/null || true
    grep -q "listen_addresses = '*'" "$PG_CONF" || echo "listen_addresses = '*'" >> "$PG_CONF" 2>/dev/null || true
  fi

  if [ -f "$PG_HBA" ]; then
    # Docker PostgreSQL is intentionally reachable from all client networks;
    # access is protected by the database password and external firewall rules.
    grep -q "host all all 0.0.0.0/0 md5" "$PG_HBA" || echo "host all all 0.0.0.0/0 md5" >> "$PG_HBA" 2>/dev/null || true
  fi

  # Bind-mounted directories can reset ownership after cluster creation; enforce it before startup.
  chown -R postgres:postgres /var/lib/postgresql/15/main /var/log/postgresql

  echo "⚡ 启动/重启 PostgreSQL 15 服务..."
  service postgresql restart || service postgresql start

  echo "⌛ 等待 PostgreSQL 服务就绪..."
  until pg_isready -h localhost -p 5432; do
    sleep 1
  done

  DB_PASSWORD=${DB_PASSWORD:-root}
  DB_PASSWORD_SQL=${DB_PASSWORD//\'/\'\'}
  echo "🔑 初始化 PostgreSQL root 账号..."
  sudo -u postgres psql -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'root') THEN CREATE ROLE root WITH LOGIN PASSWORD '$DB_PASSWORD_SQL'; END IF; END \$\$;"
  sudo -u postgres psql -c "ALTER USER root WITH NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '$DB_PASSWORD_SQL';"
  sudo -u postgres psql -c "SELECT 1 FROM pg_database WHERE datname = 'davinci'" | grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE davinci OWNER root;"
fi

echo "📊 执行数据库建表与 Schema 校验初始化 (node scripts/setup-pg.js)..."
export DB_PASSWORD=${DB_PASSWORD:-root}
node scripts/setup-pg.js

echo "🚀 启动 Next.js 生产环境服务器 (端口: 60824)..."
export PORT=60824
export DB_PASSWORD=${DB_PASSWORD:-root}
exec gosu node npm start
