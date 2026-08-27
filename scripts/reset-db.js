const { Client } = require('pg');

async function resetDatabase() {
  const host = process.env.DB_HOST || process.env.PGHOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || process.env.PGPORT || '5432', 10);
  const user = 'root';
  const password = 'brandon_pgdb';
  const dbName = process.env.DB_NAME || process.env.PGDATABASE || 'davinci';

  const client = new Client({
    host,
    port,
    user,
    password,
    database: dbName
  });

  try {
    console.log(`🗑️ 连接数据库 ${dbName} 清空所有对战数据与表结构...`);
    await client.connect();

    await client.query('DROP TABLE IF EXISTS match_history CASCADE');
    await client.query('DROP TABLE IF EXISTS game_states CASCADE');
    await client.query('DROP TABLE IF EXISTS room_players CASCADE');
    await client.query('DROP TABLE IF EXISTS rooms CASCADE');
    await client.query('DROP TABLE IF EXISTS users CASCADE');

    console.log('✅ 所有旧数据表已被成功重置清空！');
  } catch (error) {
    console.error('❌ 重置数据库失败:', error);
  } finally {
    await client.end();
  }
}

resetDatabase();
