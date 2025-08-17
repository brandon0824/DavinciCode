import mysql from 'mysql2/promise';

// MySQL连接配置
export const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'root',
  database: 'davinci',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// 创建连接池
export const pool = mysql.createPool(dbConfig);

// 测试数据库连接
export async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL数据库连接成功');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ MySQL数据库连接失败:', error);
    return false;
  }
}

// 初始化数据库表
export async function initDatabase() {
  try {
    const connection = await pool.getConnection();
    
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

    // 创建房间玩家关系表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS room_players (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_id VARCHAR(10) NOT NULL,
        user_id INT NOT NULL,
        username VARCHAR(50) NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        left_at TIMESTAMP NULL,
        is_host BOOLEAN DEFAULT FALSE,
        is_current_turn BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_room_user (room_id, user_id),
        INDEX idx_room_id (room_id),
        INDEX idx_user_id (user_id)
      )
    `);

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

    // 创建游戏历史表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS game_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_id VARCHAR(10) NOT NULL,
        user_id INT NOT NULL,
        username VARCHAR(50) NOT NULL,
        action_type ENUM('question', 'answer', 'guess', 'reveal', 'join', 'leave', 'start', 'end') NOT NULL,
        action_data JSON,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_room_id (room_id),
        INDEX idx_timestamp (timestamp)
      )
    `);

    connection.release();
    console.log('✅ 数据库表初始化成功');
    return true;
  } catch (error) {
    console.error('❌ 数据库表初始化失败:', error);
    return false;
  }
}
