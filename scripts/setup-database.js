#!/usr/bin/env node

const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'root',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

async function setupDatabase() {
  let connection;
  
  try {
    console.log('🚀 开始设置数据库...');
    
    // 连接MySQL（不指定数据库）
    connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
    });
    
    console.log('✅ 连接到MySQL成功');
    
    // 创建数据库（如果不存在）
    await connection.execute('CREATE DATABASE IF NOT EXISTS davinci');
    console.log('✅ 数据库 davinci 创建成功');
    
    // 关闭当前连接
    await connection.end();
    
    // 重新连接到davinci数据库
    connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: 'davinci', // 直接指定数据库
    });
    
    console.log('✅ 连接到davinci数据库成功');
    
    // 创建用户表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE,
        password_hash VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP NULL,
        INDEX idx_username (username)
      )
    `);
    console.log('✅ 用户表创建成功');
    
    // 创建房间表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS rooms (
        id VARCHAR(10) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        status ENUM('waiting', 'playing', 'finished') DEFAULT 'waiting',
        max_players INT DEFAULT 4,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        started_at TIMESTAMP NULL,
        ended_at TIMESTAMP NULL,
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
      )
    `);
    console.log('✅ 房间表创建成功');
    
    // 创建房间玩家关系表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS room_players (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_id VARCHAR(10) NOT NULL,
        user_id INT,
        username VARCHAR(50) NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        left_at TIMESTAMP NULL,
        is_host BOOLEAN DEFAULT FALSE,
        is_current_turn BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        INDEX idx_room_id (room_id),
        INDEX idx_user_id (user_id),
        UNIQUE KEY unique_room_user (room_id, username)
      )
    `);
    console.log('✅ 房间玩家表创建成功');
    
    // 创建游戏状态表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS game_states (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_id VARCHAR(10) NOT NULL,
        current_turn INT DEFAULT 0,
        game_data JSON,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        UNIQUE KEY unique_room (room_id),
        INDEX idx_room_id (room_id)
      )
    `);
    console.log('✅ 游戏状态表创建成功');
    
    // 创建游戏历史表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS game_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_id VARCHAR(10) NOT NULL,
        user_id INT,
        username VARCHAR(50) NOT NULL,
        action_type ENUM('question', 'answer', 'guess', 'reveal', 'join', 'leave', 'start', 'end') NOT NULL,
        action_data JSON,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        INDEX idx_room_id (room_id),
        INDEX idx_timestamp (timestamp)
      )
    `);
    console.log('✅ 游戏历史表创建成功');
    
    // 插入一些测试数据
    console.log('📝 插入测试数据...');
    
    // 创建测试房间
    await connection.execute(`
      INSERT IGNORE INTO rooms (id, name, status, max_players) VALUES 
      ('TEST01', '测试房间1', 'waiting', 4),
      ('TEST02', '测试房间2', 'waiting', 4)
    `);
    
    // 创建测试玩家
    await connection.execute(`
      INSERT IGNORE INTO room_players (room_id, username, is_host) VALUES 
      ('TEST01', '测试玩家1', TRUE),
      ('TEST01', '测试玩家2', FALSE),
      ('TEST02', '测试玩家3', TRUE)
    `);
    
    console.log('✅ 测试数据插入成功');
    
    console.log('\n🎉 数据库设置完成！');
    console.log('📊 数据库: davinci');
    console.log('🏠 主机: localhost:3306');
    console.log('👤 用户: root');
    console.log('🔑 密码: root');
    
    // 显示表结构
    console.log('\n📋 数据库表结构:');
    const [tables] = await connection.execute('SHOW TABLES');
    for (const table of tables) {
      const tableName = Object.values(table)[0];
      console.log(`  - ${tableName}`);
    }
    
  } catch (error) {
    console.error('❌ 数据库设置失败:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 运行设置
setupDatabase();
