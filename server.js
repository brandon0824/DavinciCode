const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;

// 创建Next.js应用
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  try {
    console.log('🚀 启动Next.js服务器...');
    
    // 创建HTTP服务器
    const server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error occurred handling', req.url, err);
        res.statusCode = 500;
        res.end('internal server error');
      }
    });
    
    // 启动服务器
    server.listen(port, () => {
      console.log(`🎉 服务器启动成功！`);
      console.log(`🌐 前端地址: http://${hostname}:${port}`);
      console.log(`🔌 Socket.io: 通过 /api/socket 路由提供`);
      console.log(`\n💡 提示: Socket.io服务器已集成到Next.js API路由中！`);
    });
    
    // 优雅关闭
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('Process terminated');
      });
    });
    
    // 处理Ctrl+C
    process.on('SIGINT', () => {
      console.log('\n🛑 收到中断信号，正在关闭服务器...');
      server.close(() => {
        console.log('✅ 服务器已关闭');
        process.exit(0);
      });
    });
    
  } catch (error) {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
  }
});
