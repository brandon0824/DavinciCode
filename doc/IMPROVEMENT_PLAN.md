# 游戏页面加载与实时同步优化计划

本文档记录本次对仓库中“大厅 → 房间 → 游戏棋盘”流程的分析结果，重点解决首屏加载慢、重复请求、实时同步开销大以及加载状态不友好等问题。

## 一、当前流程

### 大厅

入口：`src/app/page.tsx`、`src/app/HomeClient.tsx`。

```text
打开首页 → 下载/ hydration HomeClient → 读取 sessionStorage
→ GET /api/rooms → 建立 /api/rooms/events SSE → 显示房间列表
```

初始化同时执行普通请求和 SSE（`HomeClient.tsx:255-263`），而大厅 SSE 建立后还会立即 `push()`，因此房间列表会被重复查询。

### 房间

入口：`src/app/room/[roomId]/page.tsx`、`RoomClient.tsx`。

```text
打开 /room/{roomId} → 下载约 80KB RoomClient 并 hydration
→ 从 URL/sessionStorage 读取玩家名
→ GET /snapshot → 建立 SSE → SSE 再次推送完整快照
→ 关闭 Loading，渲染等待页或游戏棋盘
```

`page.tsx` 只返回客户端组件，服务端不会提前输出房间标题、玩家列表或棋盘骨架。

## 二、P0：首屏加载优化

### 1. 消除首次重复请求

涉及：

- `RoomClient.tsx:224-246`
- `src/app/api/rooms/[roomId]/events/route.ts:24-41`
- `HomeClient.tsx:255-263`

当前房间页先请求 `/snapshot`，SSE 连接后又执行一次完整 `push()`；大厅页也存在相同问题。

方案：

- 选择 SSE 首次返回快照，客户端删除额外 `fetchSnapshot()`；或
- 保留普通快照，SSE 增加 `skipInitial=1`，只监听后续事件。
- 初始化阶段只允许一个数据源负责首屏状态。

验收：首次进入大厅或房间时，网络面板只出现一次有效初始化请求。

### 2. 去掉创建/加入房间的人为延迟

涉及：

- `HomeClient.tsx:335-340`（创建后延迟 1 秒）
- `HomeClient.tsx:391-395`（加入后延迟 800ms）

请求成功后应立即 `router.push()`，成功提示放在目标页或使用 Toast。

### 3. 使用 Skeleton 替代全屏 Spinner

涉及：`RoomClient.tsx:575-583`。

先渲染顶部标题、房间号、玩家列表、棋盘和聊天栏骨架，并按阶段显示“连接房间 / 同步玩家 / 同步对局”。首次渲染动画使用 `AnimatePresence initial={false}`，避免首帧动画阻塞（better-ui）。

## 三、P1：降低实时同步和数据库压力

### 1. 读取接口不应清理离线玩家

涉及：`src/lib/roomService.ts:351-374`。

`getRoomPlayers()` 每次读取时检查并调用 `leaveRoom()`，使读取请求产生删除和游戏状态写入。

方案：

- 查询接口保持纯读。
- 通过定时任务/Worker 独立清理离线玩家。
- 清理操作增加事务和幂等保护。

### 2. 缩减快照接口查询

涉及：`src/app/api/rooms/[roomId]/snapshot/route.ts:11-18`。

一次快照调用 `getRoom`、`getRoomPlayers`、`getGameState`、`getUserByUsername`；`getGameState` 还会查询最多 200 条聊天记录。

方案：

- 首屏只返回房间基础信息、玩家列表和游戏必要字段。
- 用户战绩延迟加载。
- 聊天独立接口或增量事件加载。
- 用 JOIN/批量查询减少数据库往返。
- 保持按 viewer 投影隐藏牌面。

### 3. SSE 推送增量事件

涉及：`src/app/api/rooms/[roomId]/events/route.ts:24-40`。

当前每个事件都会重新查询四类数据并序列化完整状态，快速事件还可能并发执行 `push()`，造成旧响应覆盖新状态。

建议推送：

```json
{"type":"turn_changed","version":18,"currentTurn":"Alice"}
```

增加 50～100ms debounce/single-flight、客户端 version 丢旧、聊天/成员/回合分事件推送。

### 4. 不要 25 秒强制断开 SSE

涉及：`src/app/api/rooms/[roomId]/events/route.ts:41-47`、`RoomClient.tsx:239`。

当前连接 25 秒关闭，客户端 2 秒后重连，导致周期性完整查询。

方案：

- 连接延长到 5～15 分钟，或改长连接。
- 使用 `Last-Event-ID`/version 断线续传。
- 重连指数退避（2s、4s、8s、16s）。
- 页面隐藏时暂停，恢复时只同步最新版本。

### 5. 请求取消与竞态保护

为 `fetchSnapshot`、`fetchRoomAndPlayers` 和游戏动作请求增加 `AbortController`；组件卸载时取消请求；使用请求序号或服务器 version 丢弃旧响应；动作按钮增加 pending 防重复提交。

## 四、P1：缩小状态和响应体

当前 `game_data` 同时保存牌堆、手牌、日志和聊天，`getGameState` 每次还附加聊天记录。

方案：

- `game_states` 仅保存当前快照。
- `room_messages` 分页或增量加载聊天。
- `game_actions` 保存动作事件和审计记录。
- 日志限制最近 N 条。
- 普通回合变化不传输完整聊天、牌堆和无关字段。
- 未公开牌只返回 id、颜色、位置、公开状态。

## 五、P2：前端首屏和交互体验

### 1. 拆分大型客户端组件

当前 `RoomClient.tsx` 约 80KB，`HomeClient.tsx` 约 48KB。拆分为 `RoomHeader`、`PlayerList`、`GameBoard`、`ChatPanel`、`GameOverModal`、`CreateRoomForm`、`JoinRoomForm`、`RoomList`。帮助、结算、特殊牌操作等低频模块使用动态 import。

### 2. 使用 Server Component 输出静态首屏

在 Server Component 中读取 Session 和房间基础信息，作为 props 传入客户端；增加 `loading.tsx`/Suspense 输出服务端骨架。理想流程是服务端先输出房间基础骨架，客户端随后只负责实时连接和交互。

### 3. 控制动画

首屏避免整页复杂入场动画；只对低频弹窗和状态变化做动画；使用明确 transition 属性，不使用 `transition: all`；保留 `active:scale-[0.96]` 按压反馈和 reduced-motion 支持。

## 六、推荐实施顺序

### 第一阶段：立即实施

1. 去掉创建/加入房间后的延迟。
2. 消除大厅和房间首次重复请求。
3. 增加房间 Skeleton 和分阶段加载提示。
4. 增加 AbortController 和重复提交保护。

### 第二阶段：降低后端压力

1. 移除读取时的离线清理副作用。
2. SSE 增加 debounce、version 和竞态保护。
3. 延长 SSE 生命周期或支持断线续传。
4. 拆分聊天、日志和游戏快照。

### 第三阶段：架构级优化

1. Server Component 预渲染房间基础信息。
2. 完整快照改为增量事件同步。
3. 拆分大型客户端组件并动态加载低频模块。
4. 建立缓存、版本化快照和数据库查询监控。

## 七、验收指标

优化前后对比：

- FCP、首次房间内容出现时间。
- `/snapshot` 和 SSE 首次快照耗时。
- 首屏有效数据请求数量。
- SSE 每分钟重连次数。
- 单房间每分钟数据库查询次数。
- 游戏状态响应体大小。
- 聊天查询耗时。
- 客户端 JS 下载体积和 hydration 时间。

建议目标：

- 首次进入房间只产生一次初始化请求。
- 房间基础信息在 500ms～1s 内可见（取决于环境）。
- 正常在线期间不发生周期性 25 秒重连。
- 普通回合变化不传输完整聊天和完整游戏快照。
- 页面不可见时不执行高频同步。

## 八、结论

最值得优先处理的是：

1. 首次快照与 SSE 重复取数。
2. SSE 25 秒强制断开造成周期性查询。
3. 读取房间时触发离线清理。
4. 全屏 Spinner 导致感知等待过长。
5. 大型客户端组件阻塞 hydration 和首屏交互。

第一阶段会直接改善“进入房间速度”；第二、三阶段会进一步解决多人并发下的数据库压力和实时同步稳定性。

