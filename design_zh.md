# 达芬奇密码 (DaVinci Code) 桌游项目系统架构与设计文档

本文档详细说明了“达芬奇密码”多人在线桌游的整体架构设计、技术选型、数据库 Schema 以及核心功能实现细节。

Language / 语言选择:
- [English Architecture Document](design.md)
- [中文架构设计文档](design_zh.md)

---

## 🏗️ 整体技术架构

本项目采用 **Serverless 友好** 且 **高度自闭环** 的全栈架构设计。前端页面与后端 API 路由均在 Next.js 14 (App Router) 框架内实现，数据持久化保存在 PostgreSQL 关系型数据库中，用户密码使用 Bcrypt 加盐哈希加密。系统可通过 Docker 容器化并映射 **60824** 端口轻松部署到 Linux 服务器（通过宿主机持久化卷 `/root/davinci_pgdata` 保持数据不丢失）。

```
+----------------------------------------------------------------+
|                          浏览器 (Client)                       |
|   - 表现层: React 18 / Tailwind CSS / Framer Motion            |
|   - 页面集: 登录注册 / 游戏大厅 / 房间面板 / 战绩排行榜 (/stats) |
|   - 认证层: sessionStorage (持久会话) / 门禁校验               |
|   - 数据同步: HTTP Polling (数据驱动短轮询)                     |
+----------------------------------------------------------------+
                               |
                               | HTTP (JSON API, 端口: 60824)
                               v
+----------------------------------------------------------------+
|                     Next.js Full-Stack App                     |
|   - 认证路由: api/auth/register / api/auth/login (Bcrypt)      |
|   - 战绩路由: api/stats (对局历史与全服胜率排行榜)             |
|   - 逻辑服务: authService.ts / roomService.ts / gameLogic.ts  |
+----------------------------------------------------------------+
                               |
                               | SQL / TCP
                               v
+----------------------------------------------------------------+
|                     PostgreSQL 数据库                           |
|   - 永久数据表: users (密码哈希、胜负战绩)                     |
|   - 明细数据表: match_history (单场对局胜负记录与时间)         |
|   - 临时房间表: rooms / room_players / game_states              |
+----------------------------------------------------------------+
```

---

## 💻 前后端技术职责拆分

本项目在逻辑架构上遵循清晰的前后端分离职责：

### 1. 前端表现层 (Client-side / Frontend)
* **运行环境**：用户的 Web 浏览器 (完美适配桌面端与移动端 iPhone/Android)。
* **主要技术**：
  * **React 18**：核心 UI 视图层。采用声明式组件开发，渲染账号登录注册、大厅、等待房间、对局棋盘与个人战绩榜。
  * **Tailwind CSS**：原子化 CSS 框架。用于高效定制暗黑风面板、毛玻璃背景（backdrop-blur）与移动端响应式防折行规则 (`whitespace-nowrap`)。
  * **Framer Motion**：轻量级 React 动效库。专用于实现手牌排序滑入、摸牌高亮、猜牌弹窗以及超时浮动 Toast 提醒。
  * **Lucide React**：轻量 SVG 图标集。提供页面上所需的各类指示图标（如 Crown, Users, Lock, Flag, Trophy, CheckCircle2, XCircle 等）。
  * **Fetch API Polling**：通过浏览器原生 API 周期性轮询（大厅 3s，游戏房 1.5s）后端轻量路由，拉取和保存最新状态。

### 2. 后端接口层 (Server-side / Backend)
* **运行环境**：Node.js 22 运行时 (端口: 60824)。
* **主要技术**：
  * **Next.js Route Handlers**：基于 Next.js App Router 的 RESTful API 路由。处理注册、登录、房间管理、战绩查询与游戏对局指令。
  * **bcryptjs**：加盐哈希密码加密库。服务端在处理注册与登录时，对用户密码进行 10 轮加盐单向哈希处理。
  * **node-postgres (`pg`)**：PostgreSQL 原生 Node.js 客户端。基于 `Pool` 连接池管理与物理数据库的高并发连接。
  * **TypeScript**：全系统静态强类型检验。保障从认证逻辑到游戏棋桌运算的全面类型安全。

### 3. 数据持久层 (Datastore)
* **运行环境**：物理安装或容器部署的 PostgreSQL 关系型数据库。
* **主要技术**：
  * **永久数据表 (`users`)**：保存玩家账号、Bcrypt 加密密码及个人战绩数据（`total_games`, `total_wins`, `total_losses`），永久有效。
  * **对局明细表 (`match_history`)**：记录每一场对局的场次编号、胜负状态、实时胜率与开赛时间，供 `/stats` 战绩榜展现。
  * **临时关系模型 (`rooms` / `room_players`)**：维护实时在线房间和入房成员。
  * **JSONB 二进制大对象 (`game_states`)**：在 `game_states` 表中以 JSONB 原子化存取卡牌布局与对局日志。

---

## 🗄️ 数据库表结构设计 (PostgreSQL)

### 0. 用户表 (`users`) —— 永久保留
存储注册用户的身份信息与战绩数据：
* `id` (SERIAL, PK): 自增主键。
* `username` (VARCHAR, UNIQUE): 唯一用户名（1-20 位字符）。
* `password_hash` (VARCHAR): Bcrypt 加密后的加盐散列密码串（不可逆）。
* `total_games` (INT): 累计参与对战场次（默认 0）。
* `total_wins` (INT): 累计胜场（默认 0）。
* `total_losses` (INT): 累计负场（默认 0）。
* `created_at` / `last_login_at`: 注册与最后登录时间。

### 1. 战绩历史明细表 (`match_history`) —— 永久保留
存储所有完成对局的玩家对战记录：
* `id` (SERIAL, PK): 自增主键。
* `room_id` (VARCHAR): 关联房间号。
* `username` (VARCHAR): 玩家用户名。
* `is_winner` (BOOLEAN): 该场对局是否胜利 (`true` = 胜利 🏆, `false` = 失败 ❌)。
* `started_at` (TIMESTAMP): 游戏开赛时间。
* `ended_at` (TIMESTAMP): 游戏结算完结时间。

### 2. 房间表 (`rooms`) —— 24小时自动清理
存储房间的基本生命周期状态：
* `id` (VARCHAR, PK): 唯一房间码（支持 6 位随机生成码或 4-10 位自定义代码）。
* `name` (VARCHAR): 房间名称。
* `password` (VARCHAR, Nullable): 房间加密进入密码。
* `status` (VARCHAR): 房间当前状态：`waiting` (等待中)、`playing` (对局中)、`finished` (已结束)。
* `max_players` (INT): 房间最大人数限制（默认 4 人）。
* `created_at` / `started_at` / `ended_at`: 时间戳记录。
* **🧹 24小时自动清理规则 (Auto 24h Cleanup)**：每次加载房间列表或创建新房间时，系统会自动删除 `created_at < NOW() - INTERVAL '24 hours'` 的过期房间以及完结满 1 小时的历史对局（依赖 `ON DELETE CASCADE` 自动级联清理关联记录），自动释放自定义房间号。**注意：清理过程仅作用于 `rooms` 临时表，绝不触碰 `users` 永久表与 `match_history` 明细表！**

### 3. 房间玩家关联表 (`room_players`)
记录当前加入房间的成员信息：
* `id` (SERIAL, PK): 自增主键。
* `room_id` (VARCHAR, FK): 关联的房间号（外键关联 `rooms.id`，开启 `ON DELETE CASCADE`）。
* `username` (VARCHAR): 玩家昵称（在同一房间内唯一）。
* `is_host` (BOOLEAN): 是否为房主。
* `joined_at` / `left_at`: 加入和离开时间。

### 4. 游戏全局状态表 (`game_states`)
保存进行中或已结束游戏的核心数据：
* `room_id` (VARCHAR, PK, FK): 关联的房间号。
* `current_turn_username` (VARCHAR): 当前正在行动的玩家。
* `game_data` (JSONB): **对局全局状态对象**（含手牌、摸牌堆、猜牌记录与聊天）。

---

## 🔒 核心逻辑模块与功能实现

1. **🔑 强制注册与登录验证门禁**：
   - 访问房间或创建房间前强制验证用户身份，前端与后端 `roomService.ts` (`SELECT 1 FROM users WHERE username = $1`) 均验证用户名存在性，防止未注册用户绕过登录系统。
2. **🃏 黑白双任意百搭牌 (`-` 牌) 机制**：
   - 牌堆由 24 张扩展至 **26 张**（含 1 张黑色任意百搭牌 `-` 与 1 张白色任意百搭牌 `-`）；
   - 普通牌 0-11 维持从左到右升序规则，任意百搭牌 `-` 放置在手牌最右侧；
   - 猜牌界面中增加 `- (任意百搭牌)` 按键选项，对手需精确猜测出 `-` 才能翻开百搭牌。
3. **🎉 结算弹窗防自动跳转 & 全员手牌公开**：
   - 游戏结束时全量公开所有玩家的最终手牌底牌与百搭牌；
   - 增加确认状态标志，必须由玩家主动点击 `[返回房间待命 (准备下一局)]` 后方可退出结算弹窗并切回等待大厅。
4. **战绩自动结算与排行榜页面 (`/stats`)**：
   - 游戏结束时自动在 `match_history` 插入每位参赛者的胜负及开赛时间，并递增 `users` 表的胜负计数。
   - `/stats` 页面展现个人历史明细与全服胜率排行榜（第 1 名金色 🥇 高亮）。
5. **回合 30 秒倍数超时提醒机制**：
   - 处于自己回合（`isMyTurn === true`）时触发独立计时器，当无操作停留满 30s、60s、90s... 时，自动弹窗与浮动 Toast 醒目提醒玩家做出选择。
6. **容器化与自动化建表部署 (`Dockerfile` & `entrypoint.sh`)**：
   - 使用单镜像封装 Node.js 与嵌入式 PostgreSQL，`entrypoint.sh` 脚本在容器启动时自动初始化 PostgreSQL 数据库并执行 `node scripts/setup-pg.js` 建表，全自动监听 **60824** 端口。挂载 `/root/davinci_pgdata` 确保物理存储持久化。

---

## 🎨 视觉与交互工程规范 (Better-UI & Responsive Design)

* **按压缩放反馈 (`Scale on Press`)**：在所有控件、卡牌及数字按键上应用 `active:scale-[0.96] transition-transform duration-100`。
* **同心圆角与图层阴影**：遵照同心圆角公式，配合多层柔和透明阴影，打造现代化高质感 UI 面板。
* **双色主题切换 (Light/Dark Mode)**：基于自定义 `useTheme` Hook 结合 Tailwind CSS `.dark` 根类，全面适配系统偏好与手动切换。
* **移动端防折行排版**：针对 iPhone/Android 320px-430px 屏幕使用 `whitespace-nowrap` 与 `shrink-0`，确保头部工具栏与对局牌面永不折行错位。
