# 达芬奇密码 (Davinci Code) 桌游项目系统架构与设计文档

本文档详细说明了“达芬奇密码”多人在线桌游的架构设计、技术选型以及核心模块实现方式。

---

## 🏗️ 整体技术架构

本项目采用 **Serverless 友好** 且 **高度自闭环** 的全栈架构设计。前端页面与后端 API 路由均在 Next.js 14 (App Router) 框架内实现，数据持久化保存在 PostgreSQL 关系型数据库中。

```
+--------------------------------------------------------------+
|                        浏览器 (Client)                       |
|   - 表现层: React 18 / Tailwind CSS / Framer Motion            |
|   - 交互动效: Scale on Press / Dark Mode / Better-UI           |
|   - 数据同步: HTTP Polling (数据驱动短轮询)                     |
+--------------------------------------------------------------+
                               |
                               | HTTP (JSON API)
                               v
+--------------------------------------------------------------+
|                     Next.js Full-Stack App                   |
|   - 后端路由层: api/rooms/[roomId]/game/route.ts (无状态 API) |
|   - 逻辑服务层: roomService.ts / gameLogic.ts                |
+--------------------------------------------------------------+
                               |
                               | SQL / TCP
                               v
+--------------------------------------------------------------+
|                     PostgreSQL 数据库                         |
|   - 关系型表: rooms / room_players                           |
|   - 游戏状态: game_states (JSONB 格式存储大对象)              |
+--------------------------------------------------------------+
```

---

## 💻 前后端技术职责拆分

本项目的开发和部署模式实现了代码的单体集成，但在逻辑架构上遵循清晰的前后端分离职责：

### 1. 前端表现层 (Client-side / Frontend)
* **运行环境**：用户的 Web 浏览器。
* **主要技术**：
  * **React 18**：核心 UI 视图层。采用声明式组件开发，独立渲染大厅、等待房间和对局棋盘桌面。
  * **Tailwind CSS**：原子化 CSS 框架。用于高效定制暗黑风面板、毛玻璃背景（backdrop-blur）和精细的间距与色彩规范。
  * **Framer Motion**：轻量级 React 动效库。专用于实现手牌排序滑入、摸牌高亮以及猜牌弹窗等核心卡牌动效。
  * **Lucide React**：轻量 SVG 图标集。提供页面上所需的各类指示图标（如 Crown、Users、Lock、Flag 等）。
  * **Fetch API Polling**：通过浏览器原生 API 周期性轮询（大厅 3s，游戏房 1.5s）后端轻量路由，拉取和保存最新状态。

### 2. 后端接口层 (Server-side / Backend)
* **运行环境**：Node.js 运行时或 Edge/Serverless 函数计算环境。
* **主要技术**：
  * **Next.js Route Handlers**：构建于 Next.js App Router 上的 API 路由。基于 Web 标准的 `NextRequest` 和 `NextResponse` 处理 RESTful 数据交互。
  * **node-postgres (`pg`)**：PostgreSQL 原生 Node.js 客户端。基于 `Pool` 数据库连接池设计，管理与物理 PostgreSQL 库的高并发连接。
  * **TypeScript**：全系统静态强类型检验。从前端模型组件到后端服务层、游戏物理规则引擎，实现全面的安全性保护。

### 3. 数据持久层 (Datastore)
* **运行环境**：物理安装或容器部署的 PostgreSQL 关系型数据库。
* **主要技术**：
  * **SQL 关系模型**：通过 `rooms` 表和 `room_players` 表强类型关联，清晰表达玩家入房与房主委派关系。
  * **JSONB 二进制大对象**：游戏对局卡牌布局信息较为复杂，本项目直接采用 PostgreSQL 独有的 `JSONB` 格式在 `game_states` 表中进行原子读写。极大地简化了数据结构，避免了大量多表联查导致的 SQL 级性能损耗。

---

## 🗄️ 数据库表结构设计 (PostgreSQL)

项目共使用 3 张核心表来保存游戏数据。在设计上，将复杂的、多变的实时游戏卡牌状态通过 **JSONB** 格式直接存储于 `game_states` 表中。

### 1. 房间表 (`rooms`)
存储房间的基本生命周期状态：
* `id` (VARCHAR, PK): 唯一房间码（支持 6 位随机生成码或 4-10 位自定义代码）。
* `name` (VARCHAR): 房间名称。
* `password` (VARCHAR, Nullable): 房间加密进入密码。
* `status` (VARCHAR): 房间当前状态：`waiting` (等待中)、`playing` (对局中)、`finished` (已结束)。
* `max_players` (INT): 房间最大人数限制（默认 4 人）。
* `created_at` / `started_at` / `ended_at`: 时间戳记录。
* **🧹 24小时自动清理与循环回收 (Auto 24h Cleanup)**：每次加载房间列表或创建新房间时，系统会自动删除 `created_at < NOW() - INTERVAL '24 hours'` 的过期房间以及完结满 1 小时的历史对局（依赖 `ON DELETE CASCADE` 自动级联清理关联记录），自动释放自定义房间号。

### 2. 房间玩家关联表 (`room_players`)
记录当前加入房间的成员信息：
* `id` (SERIAL, PK): 自增主键。
* `room_id` (VARCHAR, FK): 关联的房间号（外键关联 `rooms.id`，开启 `ON DELETE CASCADE`）。
* `username` (VARCHAR): 玩家昵称（在同一房间内唯一，支持 1-20 位字符）。
* `is_host` (BOOLEAN): 是否为房主。
* `joined_at` / `left_at`: 加入和离开时间。

### 3. 游戏全局状态表 (`game_states`)
保存进行中或已结束游戏的核心数据：
* `room_id` (VARCHAR, PK, FK): 关联的房间号。
* `current_turn_username` (VARCHAR): 当前正在行动的玩家。
* `game_data` (JSONB): **对局全局状态对象**，包含以下子结构：
  ```json
  {
    "deck": [ { "id": "black-5", "color": "black", "value": 5, "isRevealed": false } ],
    "hands": {
      "player1": [ { "id": "white-2", "color": "white", "value": 2, "isRevealed": false } ]
    },
    "currentTurn": "player1",
    "turnStatus": "drawing",
    "lastDrawnCard": null,
    "winner": null,
    "logs": [ "游戏开始！", "player1 摸了一张黑色牌。" ],
    "chat": [ { "username": "player1", "message": "你好！", "timestamp": "12:00:00" } ]
  }
  ```

---

## 🔄 实时状态同步模型：Data-Driven Polling

为了确保项目可以无感部署到任何 **Serverless / Edge 托管平台（如 Vercel、Cloudflare Pages）**，规避了需要常驻 Node 进程的 Socket.io WebSocket 架构，转而使用**数据驱动的 HTTP 短轮询（Data-Driven Polling）**：

1. **零状态后端 (Stateless)**：后端 API 路由不保存任何常驻内存连接，每次 HTTP 请求进来后直接与 PostgreSQL 交互。
2. **前端高频轮询 (Client-Side Polling)**：
   * **房间大厅**：每 3 秒请求一次 `/api/rooms` 刷新可用房间列表。
   * **游戏房间内**：每 1.5 秒同时发起两个请求，分别获取最新的房间成员列表（`/api/rooms/[roomId]`）和核心游戏状态（`/api/rooms/[roomId]/game`）。
3. **独立局部内部滚动 (Isolated Scroll Container)**：
   * 战局日志与聊天记录面板绑定到独立的 `chatContainerRef`。
   * 数据轮询与更新仅改变聊天面板本身的内部 `scrollTop`，完全避免拉动页面视口。

---

## 🎴 核心游戏算法与机制 (`gameLogic.ts` & `roomService.ts`)

1. **牌堆初始化与洗牌**：
   * 共有 24 张牌（0-11 黑色牌各 1 张，0-11 白色牌各 1 张），采用 Fisher-Yates 随机算法洗牌。
2. **达芬奇密码手牌升序排序规则 (`sortCards`)**：
   * 玩家手牌严格按数值从左到右**升序**排列（小在左，大在右）。
   * 当数值相同时，**黑色牌必须置于左侧，白色牌置于右侧**。
3. **认输机制 (Surrender)**：
   * 替代粗暴强退，玩家可主动认输。认输后该玩家所有手牌强制公开并标记出局，回合转移。
   * 当全场仅剩 1 位玩家未出局时，系统自动判定该玩家获得最终胜利，保持房间和历史记录可供查阅。
4. **全角色断线重连 (Universal Rejoin)**：
   * 无论是房主还是普通玩家，在对局中误关闭或刷新网页后，只要输入原用户名与房间密码，系统通过校验匹配后均许可重返现有对局。

---

## 🎨 视觉与交互工程规范 (Better-UI & Responsive Design)

* **按压缩放反馈 (`Scale on Press`)**：在所有控件、卡牌及数字按键上应用 `active:scale-[0.96] transition-transform duration-100`。
* **同心圆角与图层阴影**：遵照同心圆角公式，配合多层柔和透明阴影，打造现代化高质感 UI 面板。
* **双色主题切换 (Light/Dark Mode)**：基于自定义 `useTheme` Hook 结合 Tailwind CSS `.dark` 根类，全面适配系统偏好与手动切换。
