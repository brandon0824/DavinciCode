# 运维演练手册

## 数据库迁移来源

Docker/Ubuntu PostgreSQL 环境以 `scripts/setup-pg.js` 为唯一正式迁移入口：

```bash
npm run db:setup
```
数据库不存在时会创建并初始化；数据库已存在时会先严格校验项目要求的表和字段。校验失败将直接报错，不会自动修改或删除已有结构和数据。

房间关闭时会立即删除该房间的全部聊天消息；包括房间内最后一名玩家离开导致房间删除的情况。房间被删除时，相关消息也会通过数据库级联规则清理。

`supabase_schema.sql` 仅用于旧的 Supabase 参考部署，不应与 Docker 初始化脚本同时执行。

## 健康检查

运行 Docker 脚本前必须在根目录 `.env.docker` 中配置非空的 `ADMIN_PASSWORD` 和 `PG_DATA_DIR`，脚本不会读取 `.env.local`。`ADMIN_PASSWORD` 仅用于网页管理员登录；Docker PostgreSQL 固定使用 `root` / `brandon_pgdata`。Docker PostgreSQL 对所有网络接口开放，必须通过服务器防火墙或云安全组限制 TCP `5432` 来源。本地 Node.js 启动则直接使用根目录 `.env.local` 中的数据库配置。用户及管理员密码最低长度为 7 个字符。

本地 macOS 可在项目根目录直接执行 `./localStart.sh`，脚本会依次安装依赖、初始化数据库并启动开发服务。

```bash
curl -fsS http://localhost:60824/api/health
```

返回 `503` 时先检查 PostgreSQL 容器和连接环境变量。

## 备份与恢复演练

在非生产数据库执行：

```bash
BACKUP_DIR=./backups npm run db:backup
npm run db:restore -- ./backups/davinci-YYYYMMDD-HHMMSS.dump
```

恢复后使用 `npm run db:setup` 校验结构和迁移状态，并检查 `schema_migrations` 中的版本。
生产恢复前必须确认目标数据库和备份文件路径，避免覆盖错误实例。

## 压力测试

```bash
PRESSURE_CONCURRENCY=20 PRESSURE_DURATION_MS=30000 npm run test:pressure
```

压力测试只针对健康接口或明确的只读接口；游戏动作压测前应使用隔离数据库。

## E2E

```bash
npm run test:e2e
```

测试配置包含桌面 Chromium 和 iPhone 13 移动端项目。执行前确保本地服务端口 `60824` 空闲、数据库已启动，并已安装 Playwright 浏览器。
