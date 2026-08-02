# 达芬奇密码 (Davinci Code) 桌游项目系统架构与设计文档

本文档详细说明了“达芬奇密码”多人在线桌游的架构设计、技术选型以及核心模块实现方式。

---

## 🏗️ 整体技术架构

本项目采用 **Serverless 友好** 且 **高度自闭环** 的全栈架构设计。前端页面与后端 API 路由均在 Next.js 14 (App Router) 框架内实现，数据持久化保存在 PostgreSQL 关系型数据库中，用户密码使用 Bcrypt 加盐哈希加密。

```
+--------------------------------------------------------------+
|                        浏览器 (Client)                       |
|   - 表现层: React 18 / Tailwind CSS / Framer Motion            |
|   - 认证层: localStorage (持久化会话) / 战绩胜率概览            |
|   - 数据同步: HTTP Polling (数据驱动短轮询)                     |
+--------------------------------------------------------------+
                               |
                               | HTTP (JSON API)
                               v
+--------------------------------------------------------------+
|                     Next.js Full-Stack App                   |
|   - 认证路由: api/auth/register / api/auth/login (Bcrypt)    |
|   - 逻辑服务层: authService.ts / roomService.ts / gameLogic.ts|
+--------------------------------------------------------------+
                               |
                               | SQL / TCP
                               v
+--------------------------------------------------------------+
|                     PostgreSQL 数据库                         |
|   - 永久数据表: users (密码哈希、累计场次、胜负战绩)          |
|   - 临时房间表: rooms / room_players / game_states            |
+--------------------------------------------------------------+
```

---

## 💻 前后端技术职责拆分

本项目的开发和部署模式实现了代码的单体集成，但在逻辑架构上遵循清晰的前后端分离职责：

### 1. 前端表现层 (Client-side / Frontend)
* **运行环境**：用户的 Web 浏览器。
* **主要技术**：
  * **React 18**：核心 UI 视图层。采用声明式组件开发，独立渲染账号登录注册、大厅、等待房间和对局棋盘桌面。
  * **Tailwind CSS**：原子化 CSS 框架。用于高效定制暗黑风面板、毛玻璃背景（backdrop-blur）和精细的间距与色彩规范。
  * **Framer Motion**：轻量级 React 动效库。专用于实现手牌排序滑入、摸牌高亮以及猜牌弹窗等核心卡牌动效。
  * **Lucide React**：轻量 SVG 图标集。提供页面上所需的各类指示图标（如 Crown、Users、Lock、Flag、UserCheck 等）。
  * **Fetch API Polling**：通过浏览器原生 API 周期性轮询（大厅 3s，游戏房 1.5s）后端轻量路由，拉取和保存最新状态。

### 2. 后端接口层 (Server-side / Backend)
* **运行环境**：Node.js 运行时或 Edge/Serverless 函数计算环境。
* **主要技术**：
  * **Next.js Route Handlers**：基于 Next.js App Router 的 RESTful API 路由。处理注册、登录、房间管理与游戏对局指令。
  * **bcryptjs**：加盐哈希密码加密库。服务端在处理注册与登录时，对用户密码进行可控强度的单向哈希处理。
  * **node-postgres (`pg`)**：PostgreSQL 原生 Node.js 客户端。基于 `Pool` 连接池管理与物理数据库的高并发连接。
  * **TypeScript**：全系统静态强类型检验。保障从认证逻辑到游戏棋桌运算的全面类型安全。

### 3. 数据持久层 (Datastore)
* **运行环境**：物理安装或容器部署的 PostgreSQL 关系型数据库。
* **主要技术**：
  * **永久数据表 (`users`)**：保存玩家账号、Bcrypt 加密密码及个人战绩数据（`total_games`, `total_wins`, `total_losses`），永久有效。
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

### 1. 房间表 (`rooms`) —— 24小时自动清理
存储房间的基本生命周期状态：
* `id` (VARCHAR, PK): 唯一房间码（支持 6 位随机生成码或 4-10 位自定义代码）。
* `name` (VARCHAR): 房间名称。
* `password` (VARCHAR, Nullable): 房间加密进入密码。
* `status` (VARCHAR): 房间当前状态：`waiting` (等待中)、`playing` (对局中)、`finished` (已结束)。
* `max_players` (INT): 房间最大人数限制（默认 4 人）。
* `created_at` / `started_at` / `ended_at`: 时间戳记录。
* **🧹 24小时自动清理规则 (Auto 24h Cleanup)**：每次加载房间列表或创建新房间时，系统会自动删除 `created_at < NOW() - INTERVAL '24 hours'` 的过期房间以及完结满 1 小时的历史对局（依赖 `ON DELETE CASCADE` 自动级联清理关联记录），自动释放自定义房间号。**注意：清理过程仅作用于 `rooms` 临时表，绝不触碰 `users` 永久表！**

### 2. 房间玩家关联表 (`room_players`)
记录当前加入房间的成员信息：
* `id` (SERIAL, PK): 自增主键。
* `room_id` (VARCHAR, FK): 关联的房间号（外键关联 `rooms.id`，开启 `ON DELETE CASCADE`）。
* `username` (VARCHAR): 玩家昵称（在同一房间内唯一）。
* `is_host` (BOOLEAN): 是否为房主。
* `joined_at` / `left_at`: 加入和离开时间。

### 3. 游戏全局状态表 (`game_states`)
保存进行中或已结束游戏的核心数据：
* `room_id` (VARCHAR, PK, FK): 关联的房间号。
* `current_turn_username` (VARCHAR): 当前正在行动的玩家。
* `game_data` (JSONB): **对局全局状态对象**（含手牌、摸牌堆、猜牌记录与聊天）。

---

## 🔒 用户认证与战绩自动增量更新

1. **注册与登录交互 (`authService.ts`)**：
   - 注册时对用户提交的密码进行 10 轮加盐 Bcrypt 散列加密，写入 `users` 表。
   - 登录时比对密码散列，成功后将用户账号及战绩缓存至 `localStorage`。
2. **战绩自动结算 (`endGame`)**：
   - 当一场对局产生获胜者（`winner`）时，后端 `endGame` 服务会自动更新 `users` 表：
     - **胜者**：`total_games = total_games + 1`, `total_wins = total_wins + 1`；
     - **负者/认输者**：`total_games = total_games + 1`, `total_losses = total_losses + 1`。
   - 这使得战绩数据与临时房间完全解耦，即便 24 小时后房间缓存被清除，用户的胜负场次与胜率依然完整保留在 `users` 表中。

---

## 🎨 视觉与交互工程规范 (Better-UI & Responsive Design)

* **按压缩放反馈 (`Scale on Press`)**：在所有控件、卡牌及数字按键上应用 `active:scale-[0.96] transition-transform duration-100`。
* **同心圆角与图层阴影**：遵照同心圆角公式，配合多层柔和透明阴影，打造现代化高质感 UI 面板。
* **双色主题切换 (Light/Dark Mode)**：基于自定义 `useTheme` Hook 结合 Tailwind CSS `.dark` 根类，全面适配系统偏好与手动切换。
