const { Client } = require('pg');

async function setupDatabase() {
  const host = process.env.DB_HOST || process.env.PGHOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || process.env.PGPORT || '5432', 10);
  const user = process.env.DB_USER || process.env.PGUSER || 'root';
  const password = process.env.DB_PASSWORD || process.env.PGPASSWORD || 'root';
  const dbName = process.env.DB_NAME || process.env.PGDATABASE || 'davinci';

  // Connection to default 'postgres' database to create the new database
  const adminClient = new Client({
    host,
    port,
    user,
    password,
    database: 'postgres'
  });

  try {
    console.log(`🚀 Connecting to default postgres db at ${host}:${port}...`);
    await adminClient.connect();
    
    // Check if database exists
    const checkDbResult = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );
    
    if (checkDbResult.rows.length === 0) {
      console.log(`📝 Database '${dbName}' does not exist. Creating...`);
      await adminClient.query(`CREATE DATABASE ${dbName}`);
      console.log(`✅ Database '${dbName}' created successfully.`);
    } else {
      console.log(`ℹ️ Database '${dbName}' already exists.`);
    }
  } catch (error) {
    console.error('❌ Error creating database:', error);
    process.exit(1);
  } finally {
    await adminClient.end();
  }

  // Connection to target database to create tables
  const client = new Client({
    host,
    port,
    user,
    password,
    database: dbName
  });

  try {
    console.log("🚀 Connecting to 'davinci' database to run migrations...");
    await client.connect();

    // 0. Create users table for user authentication and battle stats
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        total_games INT NOT NULL DEFAULT 0,
        total_wins INT NOT NULL DEFAULT 0,
        total_losses INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        last_login_at TIMESTAMP WITH TIME ZONE
      );
    `);
    console.log('✅ Users table verified/created with battle stats.');

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

    // 4. Create match_history table for personal game history
    await client.query(`
      CREATE TABLE IF NOT EXISTS match_history (
        id SERIAL PRIMARY KEY,
        room_id VARCHAR(10) NOT NULL,
        username VARCHAR(50) NOT NULL,
        is_winner BOOLEAN NOT NULL DEFAULT FALSE,
        started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        ended_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);
    console.log('✅ Match History table verified/created.');

    console.log('\n🎉 PostgreSQL schema initialization completed successfully!');
  } catch (error) {
    console.error('❌ Error running migrations:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupDatabase();
