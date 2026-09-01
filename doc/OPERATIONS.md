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

运行 Docker 脚本前必须在根目录 `.env.docker` 中配置非空的 `ADMIN_PASSWORD` 和 `PG_DATA_DIR`，脚本不会读取 `.env.local`。脚本通过 Docker Compose 启动独立的 `app` 与 `postgres` 服务。`ADMIN_PASSWORD` 仅用于网页管理员登录；Docker PostgreSQL 固定使用 `root` / `brandon_pgdb`。PostgreSQL 对所有网络接口开放并映射宿主机 TCP `5432`，必须通过服务器防火墙或云安全组限制来源。本地 Node.js 启动则直接使用根目录 `.env.local` 中的数据库配置。用户及管理员密码最低长度为 7 个字符。

本地 macOS 可在项目根目录直接执行 `./localStart.sh`，脚本会依次安装依赖、初始化数据库并启动开发服务。

## 在线与房间离线策略

在线人数以过去 15 秒内的 `user_presence.last_seen_at` 心跳为准；页面可见时 Footer 约每 4 秒刷新一次心跳。该指标仅用于在线展示，不等同于房间成员清理。

房间成员在读取房间状态时会检查心跳。超过 **5 分钟**未更新的成员才会被自动移出房间并触发房主转移与房间日志；显式“退出房间”会立即生效。此宽限期用于避免移动端切换应用、浏览器暂停定时器或 SSE 时误删对局成员。

房间 SSE 会在约 25 秒后由服务端关闭，客户端会在页面可见时自动重连；这属于当前实现的预期行为。排查“正在重连”状态时，应同时检查 `/api/health`、反向代理对流式响应的缓冲设置，以及浏览器是否处于后台。

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
