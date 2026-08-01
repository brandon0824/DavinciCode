const { Client } = require('pg');

async function resetDatabase() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'root',
    password: 'root',
    database: 'davinci'
  });

  try {
    console.log("🚀 Connecting to 'davinci' database to wipe all data...");
    await client.connect();

    await client.query(`
      TRUNCATE TABLE rooms, room_players, game_states RESTART IDENTITY CASCADE;
    `);

    console.log('✅ 所有房间、玩家和游戏记录已全部彻底清空！数据库从 0 开始。');
  } catch (error) {
    console.error('❌ 清空数据库失败:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

resetDatabase();
