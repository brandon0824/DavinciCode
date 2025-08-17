# DavinciCode

达芬奇密码游戏 支持实时 多人

## 🎨 UI 特性

### 主页面设计
- **左右两列布局**：左侧包含创建房间和加入房间功能，右侧显示可用房间列表
- **卡片式设计**：每个功能模块都采用白色卡片设计，带有微妙的阴影和边框
- **颜色编码**：蓝色用于创建房间，绿色用于加入房间，灰色用于房间列表
- **响应式设计**：支持桌面和移动设备的响应式布局

### 房间页面设计
- **顶部导航栏**：包含返回按钮、房间信息、玩家数量和操作按钮
- **中央白色卡片**：显示游戏等待状态和玩家槽位信息
- **玩家槽位**：4个玩家槽位，已加入的玩家显示绿色背景，空槽位显示灰色背景
- **操作按钮**：房主可以开始游戏，所有玩家都可以离开房间

## 🚀 技术特性

- **Next.js 14**：使用最新的App Router
- **TypeScript**：完整的类型安全
- **Tailwind CSS**：现代化的CSS框架
- **MySQL**：关系型数据库存储
- **Redis**：缓存和实时通信
- **Socket.io**：实时双向通信
- **响应式设计**：支持各种屏幕尺寸
- **实时更新**：房间状态实时同步

## 📋 环境要求

- **Node.js**: 18.0.0 或更高版本
- **npm**: 8.0.0 或更高版本
- **MySQL**: 8.0 或更高版本
- **Redis**: 6.0 或更高版本

## ⚡ 快速开始

### 1. 克隆项目
```bash
git clone <repository-url>
cd DavinciCode
```

### 2. 安装依赖
```bash
npm install
```

### 3. 环境配置

#### 3.1 安装并启动MySQL
```bash
# macOS (使用Homebrew)
brew install mysql
brew services start mysql

# 设置MySQL root密码
mysql -u root -p
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'root';
FLUSH PRIVILEGES;
EXIT;
```

#### 3.2 安装并启动Redis
```bash
# macOS (使用Homebrew)
brew install redis
brew services start redis
```

### 4. 初始化数据库
```bash
# 运行数据库初始化脚本
npm run db:setup
```

### 5. 配置环境变量（可选）
项目使用默认配置，可以直接运行。如果需要自定义配置，可以手动创建 `.env.local` 文件：

在项目根目录创建 `.env.local` 文件，内容如下：

```bash
# 数据库配置（可选，默认使用以下配置）
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=root
DB_NAME=davinci

# Redis配置（可选，默认使用以下配置）
REDIS_HOST=localhost
REDIS_PORT=6379

# 应用配置
PORT=3000
NODE_ENV=development
```

**默认配置说明**：
- **MySQL**: localhost:3306, 用户: root, 密码: root, 数据库: davinci
- **Redis**: localhost:6379
- **应用端口**: 3000

**注意**: 创建 `.env.local` 为了在需要自定义配置时使用。请用户根据自己的数据库环境修改文件中信息。

### 6. 启动应用

#### 开发模式
```bash
npm run dev
```

#### 生产模式
```bash
npm run build
npm start
```

### 7. 访问应用
- **前端地址**: http://localhost:3000
- **API接口**: http://localhost:3000/api
- **Socket.io**: 通过 `/api/socket` 路由提供

## 🔧 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm start

# 运行数据库初始化
npm run db:setup

# 环境检查
npm run check-env

# 代码检查
npm run lint
```

## ✅ 待办事项

- [ ] 添加游戏逻辑实现
- [ ] 实现实时聊天功能
- [ ] 添加房间设置选项
- [ ] 优化移动端体验
- [ ] 添加主题切换功能
- [ ] 实现用户认证系统
- [ ] 添加游戏统计功能
- [ ] 优化数据库性能
- [ ] 技术栈调整
  - [x] 前端: Next.js + React
  - [ ] 数据库: Supabase (PostgreSQL)
  - [ ] ORM: Supabase Client
  - [ ] 实时通信: Supabase Realtime
  - [ ] 认证: Supabase Auth
  - [ ] 部署: Vercel

## 📄 许可证

本项目采用 MIT 许可证。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
