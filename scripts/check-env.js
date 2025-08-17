#!/usr/bin/env node

const mysql = require('mysql2/promise');
const { createClient } = require('redis');

// 颜色定义
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// 打印带颜色的消息
function printMessage(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function printHeader(message) {
  console.log(`\n${colors.bright}${colors.blue}================================${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}  ${message}${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}================================${colors.reset}`);
}

function printSuccess(message) {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function printError(message) {
  console.log(`${colors.red}❌ ${message}${colors.reset}`);
}

function printWarning(message) {
  console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

function printInfo(message) {
  console.log(`${colors.cyan}ℹ️  ${message}${colors.reset}`);
}

// 检查Node.js版本
function checkNodeVersion() {
  printHeader('检查Node.js环境');
  
  const version = process.version;
  const majorVersion = parseInt(version.slice(1).split('.')[0]);
  
  console.log(`当前Node.js版本: ${version}`);
  
  if (majorVersion >= 18) {
    printSuccess(`Node.js版本符合要求 (>= 18)`);
  } else {
    printError(`Node.js版本过低，需要18+版本`);
    return false;
  }
  
  return true;
}

// 检查npm版本
function checkNpmVersion() {
  const { execSync } = require('child_process');
  
  try {
    const version = execSync('npm --version', { encoding: 'utf8' }).trim();
    const majorVersion = parseInt(version.split('.')[0]);
    
    console.log(`当前npm版本: ${version}`);
    
    if (majorVersion >= 8) {
      printSuccess(`npm版本符合要求 (>= 8)`);
      return true;
    } else {
      printError(`npm版本过低，需要8+版本`);
      return false;
    }
  } catch (error) {
    printError(`无法获取npm版本: ${error.message}`);
    return false;
  }
}

// 检查MySQL连接
async function checkMySQL() {
  printHeader('检查MySQL数据库');
  
  const dbConfig = {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root',
    database: 'davinci',
    connectTimeout: 5000
  };
  
  try {
    // 先尝试连接MySQL服务器（不指定数据库）
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      connectTimeout: 5000
    });
    
    printSuccess('MySQL服务器连接成功');
    
    // 检查数据库是否存在
    const [rows] = await connection.execute('SHOW DATABASES LIKE "davinci"');
    
    if (rows.length > 0) {
      printSuccess('数据库 "davinci" 存在');
      
      // 检查表结构
      await connection.execute('USE davinci');
      const [tables] = await connection.execute('SHOW TABLES');
      
      if (tables.length >= 5) {
        printSuccess(`数据库表结构完整 (${tables.length} 个表)`);
      } else {
        printWarning(`数据库表结构可能不完整 (${tables.length} 个表，期望 >= 5)`);
      }
      
    } else {
      printWarning('数据库 "davinci" 不存在，需要运行 npm run db:setup');
    }
    
    await connection.end();
    return true;
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      printError('MySQL服务未启动，请启动MySQL服务');
      printInfo('macOS: brew services start mysql');
      printInfo('Docker: docker run --name mysql-davinci -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=davinci -p 3306:3306 -d mysql:8.0');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      printError('MySQL访问被拒绝，请检查用户名和密码');
    } else {
      printError(`MySQL连接失败: ${error.message}`);
    }
    return false;
  }
}

// 检查Redis连接
async function checkRedis() {
  printHeader('检查Redis服务');
  
  try {
    const redis = createClient({
      url: 'redis://localhost:6379',
      socket: {
        host: 'localhost',
        port: 6379,
        connectTimeout: 5000
      }
    });
    
    await redis.connect();
    const pong = await redis.ping();
    
    if (pong === 'PONG') {
      printSuccess('Redis服务连接成功');
      await redis.disconnect();
      return true;
    } else {
      printError('Redis服务响应异常');
      return false;
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      printError('Redis服务未启动，请启动Redis服务');
      printInfo('macOS: brew services start redis');
      printInfo('Docker: docker run --name redis-davinci -p 6379:6379 -d redis:6.0-alpine');
    } else {
      printError(`Redis连接失败: ${error.message}`);
    }
    return false;
  }
}

// 检查端口占用
function checkPorts() {
  printHeader('检查端口占用');
  
  const { execSync } = require('child_process');
  const ports = [3000, 3306, 6379];
  
  for (const port of ports) {
    try {
      const result = execSync(`lsof -i :${port}`, { encoding: 'utf8' });
      if (result.trim()) {
        printWarning(`端口 ${port} 被占用`);
        console.log(result);
      } else {
        printSuccess(`端口 ${port} 可用`);
      }
    } catch (error) {
      printSuccess(`端口 ${port} 可用`);
    }
  }
}

// 检查项目依赖
function checkDependencies() {
  printHeader('检查项目依赖');
  
  try {
    const fs = require('fs');
    const path = require('path');
    
    if (fs.existsSync('node_modules')) {
      printSuccess('项目依赖已安装');
      
      // 检查关键依赖
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const requiredDeps = ['next', 'react', 'mysql2', 'redis', 'socket.io'];
      
      for (const dep of requiredDeps) {
        if (packageJson.dependencies[dep]) {
          printSuccess(`依赖 ${dep} 已安装`);
        } else {
          printWarning(`依赖 ${dep} 未找到`);
        }
      }
      
    } else {
      printWarning('项目依赖未安装，请运行 npm install');
      return false;
    }
    
    return true;
    
  } catch (error) {
    printError(`检查依赖失败: ${error.message}`);
    return false;
  }
}

// 主函数
async function main() {
  console.log(`${colors.bright}${colors.blue}🚀 达芬奇密码游戏环境检查${colors.reset}\n`);
  
  let allChecksPassed = true;
  
  // 检查Node.js环境
  if (!checkNodeVersion()) allChecksPassed = false;
  if (!checkNpmVersion()) allChecksPassed = false;
  
  // 检查项目依赖
  if (!checkDependencies()) allChecksPassed = false;
  
  // 检查端口占用
  checkPorts();
  
  // 检查数据库服务
  if (!(await checkMySQL())) allChecksPassed = false;
  if (!(await checkRedis())) allChecksPassed = false;
  
  // 总结
  printHeader('检查结果');
  
  if (allChecksPassed) {
    printSuccess('所有检查通过！环境配置正确，可以启动项目');
    printInfo('启动命令: npm run dev');
  } else {
    printError('部分检查未通过，请根据上述提示解决问题');
    printInfo('快速修复: ./scripts/deploy.sh dev');
  }
  
  console.log('\n');
}

// 运行检查
main().catch(console.error);

