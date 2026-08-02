const { Client } = require('pg');

async function resetDatabase() {
  const wipeAll = process.argv.includes('--all');

  const host = process.env.DB_HOST || process.env.PGHOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || process.env.PGPORT || '5432', 10);
  const user = process.env.DB_USER || process.env.PGUSER || 'root';
  const password = process.env.DB_PASSWORD || process.env.PGPASSWORD || 'root';
  const dbName = process.env.DB_NAME || process.env.PGDATABASE || 'davinci';

  const client = new Client({
    host,
    port,
    user,
    password,
    database: dbName
  });

  try {
    console.log("🚀 Connecting to 'davinci' database...");
    await client.connect();

    if (wipeAll) {
      console.log("⚠️ 正在彻底清空所有数据（包括 users 用户账号与历史战绩）...");
      await client.query(`
        TRUNCATE TABLE users, rooms, room_players, game_states, match_history RESTART IDENTITY CASCADE;
      `);
      console.log('✅ 所有用户账号、战绩、房间和对局记录已彻底从 0 清空！');
    } else {
      console.log("🧹 正在清空房间与对局缓存（保留 users 用户账号与战绩）...");
      await client.query(`
        TRUNCATE TABLE rooms, room_players, game_states, match_history RESTART IDENTITY CASCADE;
      `);
      console.log('✅ 所有房间与对局记录已彻底清空！用户账号及累计战绩已妥善保留。');
    }
  } catch (error) {
    console.error('❌ 清空数据库失败:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

resetDatabase();
