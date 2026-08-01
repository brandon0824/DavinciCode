const { Client } = require('pg');

async function setupDatabase() {
  // Connection to default 'postgres' database to create the new database
  const adminClient = new Client({
    host: 'localhost',
    port: 5432,
    user: 'root',
    password: 'root',
    database: 'postgres'
  });

  try {
    console.log('🚀 Connecting to default postgres db...');
    await adminClient.connect();
    
    // Check if davinci database exists
    const checkDbResult = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = 'davinci'"
    );
    
    if (checkDbResult.rows.length === 0) {
      console.log("📝 Database 'davinci' does not exist. Creating...");
      // CREATE DATABASE cannot run in a transaction block
      await adminClient.query('CREATE DATABASE davinci');
      console.log("✅ Database 'davinci' created successfully.");
    } else {
      console.log("ℹ️ Database 'davinci' already exists.");
    }
  } catch (error) {
    console.error('❌ Error creating database:', error);
    process.exit(1);
  } finally {
    await adminClient.end();
  }

  // Connection to 'davinci' database to create tables
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'root',
    password: 'root',
    database: 'davinci'
  });

  try {
    console.log("🚀 Connecting to 'davinci' database to run migrations...");
    await client.connect();

    // 1. Create rooms table
    await client.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id VARCHAR(10) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        password VARCHAR(255),
        status VARCHAR(20) NOT NULL DEFAULT 'waiting',
        max_players INT NOT NULL DEFAULT 4,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        started_at TIMESTAMP WITH TIME ZONE,
        ended_at TIMESTAMP WITH TIME ZONE
      );
    `);
    
    // Ensure password column exists on pre-existing rooms tables
    await client.query(`
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS password VARCHAR(255);
    `);
    console.log('✅ Rooms table verified/created with password column.');

    // 2. Create room_players table
    await client.query(`
      CREATE TABLE IF NOT EXISTS room_players (
        id SERIAL PRIMARY KEY,
        room_id VARCHAR(10) REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
        username VARCHAR(50) NOT NULL,
        is_host BOOLEAN DEFAULT FALSE NOT NULL,
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        left_at TIMESTAMP WITH TIME ZONE,
        UNIQUE (room_id, username)
      );
    `);
    console.log('✅ Room Players table verified/created.');

    // 3. Create game_states table
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_states (
        room_id VARCHAR(10) REFERENCES rooms(id) ON DELETE CASCADE PRIMARY KEY,
        current_turn_username VARCHAR(50),
        game_data JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);
    console.log('✅ Game States table verified/created.');

    console.log('\n🎉 PostgreSQL schema initialization completed successfully!');
  } catch (error) {
    console.error('❌ Error running migrations:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupDatabase();
