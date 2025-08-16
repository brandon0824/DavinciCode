# Davinci Code Game

此项目使用 Next.js 构建，演示达芬奇密码卡牌游戏的基础框架。玩家可以创建或加入房间（最多四人），当前版本将房间与玩家信息保存在运行时内存中。

## 开始

```bash
npm install
npm run dev
```

在浏览器打开 [http://localhost:3000](http://localhost:3000)。在首页输入昵称并创建或加入房间。

## TODO

- 实现完整的达芬奇密码游戏逻辑
- 房间满员时阻止额外玩家加入
- 后续接入持久化存储（如 Supabase）
