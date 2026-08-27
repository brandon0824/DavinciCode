const { Client } = require('pg');

async function setupDatabase() {
  const host = process.env.DB_HOST || process.env.PGHOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || process.env.PGPORT || '5432', 10);
  const user = process.env.DB_USER || process.env.PGUSER || 'root';
  const password = process.env.DB_PASSWORD || process.env.PGPASSWORD || 'root';
  const dbName = process.env.DB_NAME || process.env.PGDATABASE || 'davinci';
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(dbName)) {
    throw new Error(`Invalid DB_NAME: ${dbName}`);
  }

  let databaseCreated = false;
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
      await adminClient.query(`CREATE DATABASE "${dbName}"`);
      databaseCreated = true;
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
    console.log(`🚀 Connecting to '${dbName}' database to run migrations...`);
    await client.connect();

    if (!databaseCreated) {
      const required = {
        users: ['username', 'password_hash', 'role', 'must_change_password', 'password_reset_expires_at', 'password_reset_by'],
        rooms: ['id', 'name', 'status', 'max_players'],
        room_players: ['room_id', 'username', 'is_host'],
        game_states: ['room_id', 'current_turn_username', 'game_data', 'version'],
        user_sessions: ['token_hash', 'username', 'expires_at'],
        user_presence: ['username', 'last_seen_at'],
        admin_audit_logs: ['admin_username', 'action', 'success', 'created_at'],
        match_history: ['room_id', 'username', 'is_winner', 'match_id'],
        room_messages: ['room_id', 'username', 'message'],
        game_actions: ['room_id', 'username', 'action_id', 'action', 'payload'],
        game_state_snapshots: ['room_id', 'version', 'game_data']
      };
      const schemaResult = await client.query(`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
      `);
      const actual = new Set(schemaResult.rows.map((row) => `${row.table_name}.${row.column_name}`));
      const missing = [];
      for (const [table, columns] of Object.entries(required)) {
        for (const column of columns) if (!actual.has(`${table}.${column}`)) missing.push(`${table}.${column}`);
      }
      if (missing.length) {
        throw new Error(`数据库 '${dbName}' 结构不符合项目要求，缺少表或字段：${missing.join(', ')}。请修复结构后再执行 npm run db:setup；不会自动修改已有数据库。`);
      }
      console.log('✅ Existing database schema validated.');
    }

    // Keep a lightweight schema version ledger so environments can be checked
    // for migration drift.
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(32) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 0. Create users table for user authentication and battle stats
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        total_games INT NOT NULL DEFAULT 0,
        total_wins INT NOT NULL DEFAULT 0,
        total_losses INT NOT NULL DEFAULT 0,
        role VARCHAR(20) NOT NULL DEFAULT 'player',
        must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
        password_reset_expires_at TIMESTAMP WITH TIME ZONE,
        password_reset_by VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        last_login_at TIMESTAMP WITH TIME ZONE
      );
    `);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'player'; ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE; ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMP WITH TIME ZONE; ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_by VARCHAR(50);`);
    console.log('✅ Users table verified/created with battle stats.');

    // 0.1 Seed default Admin user with a bcrypt hash (override in production)
    const bcrypt = require('bcryptjs');
    const adminPassword = process.env.ADMIN_PASSWORD || 'Brandon';
    if (adminPassword.trim().length < 7) {
      throw new Error('ADMIN_PASSWORD must be at least 7 characters');
    }
    const adminPasswordHash = await bcrypt.hash(adminPassword.trim(), 12);
    await client.query(`
      INSERT INTO users (username, password_hash, last_login_at)
      VALUES ('admin', $1, CURRENT_TIMESTAMP)
      ON CONFLICT (username) 
      DO UPDATE SET password_hash = EXCLUDED.password_hash;
    `, [adminPasswordHash]);
    await client.query(`UPDATE users SET role = 'admin' WHERE username = 'admin';`);
    console.log("👑 Default Admin user verified/seeded.");

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
        ,match_id VARCHAR(64)
      );
    `);
    
    // Ensure password column exists on pre-existing rooms tables
    await client.query(`
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS password VARCHAR(255);
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS match_id VARCHAR(64);
    `);
    console.log('✅ Rooms table verified/created with password column.');

    // 2. Create room_players table
    await client.query(`
      CREATE TABLE IF NOT EXISTS room_players (
        id SERIAL PRIMARY KEY,
        match_id VARCHAR(64) NOT NULL DEFAULT '',
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
    await client.query(`ALTER TABLE game_states ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0; ALTER TABLE game_states ADD COLUMN IF NOT EXISTS updated_by VARCHAR(50);`);
    console.log('✅ Game States table verified/created.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        token_hash CHAR(64) PRIMARY KEY,
        username VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS user_sessions_expires_idx ON user_sessions(expires_at);
      CREATE INDEX IF NOT EXISTS rooms_status_created_idx ON rooms(status, created_at);
      CREATE INDEX IF NOT EXISTS room_players_room_idx ON room_players(room_id);
      CREATE INDEX IF NOT EXISTS users_last_login_idx ON users(last_login_at);
      CREATE INDEX IF NOT EXISTS game_states_updated_idx ON game_states(updated_at);
      CREATE TABLE IF NOT EXISTS user_presence (
        username VARCHAR(50) PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS user_presence_seen_idx ON user_presence(last_seen_at);
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id BIGSERIAL PRIMARY KEY,
        admin_username VARCHAR(50) NOT NULL,
        action VARCHAR(80) NOT NULL,
        target_username VARCHAR(50),
        source_ip INET,
        success BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        details JSONB NOT NULL DEFAULT '{}'::jsonb
      );
      CREATE INDEX IF NOT EXISTS admin_audit_logs_created_idx ON admin_audit_logs(created_at DESC);
    `);

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
    await client.query(`ALTER TABLE match_history ADD COLUMN IF NOT EXISTS match_id VARCHAR(64) NOT NULL DEFAULT ''; CREATE INDEX IF NOT EXISTS match_history_user_started_idx ON match_history(username, started_at); CREATE UNIQUE INDEX IF NOT EXISTS match_history_match_user_idx ON match_history(match_id, username) WHERE match_id <> '';`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS room_messages (
        id BIGSERIAL PRIMARY KEY,
        room_id VARCHAR(10) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        username VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
        message VARCHAR(500) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS room_messages_room_created_idx ON room_messages(room_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS game_actions (
        id BIGSERIAL PRIMARY KEY,
        room_id VARCHAR(10) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        match_id VARCHAR(64), username VARCHAR(50) NOT NULL,
        action_id VARCHAR(64) NOT NULL, action VARCHAR(40) NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS game_actions_room_action_idx ON game_actions(room_id, action_id);
      CREATE INDEX IF NOT EXISTS game_actions_room_created_idx ON game_actions(room_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS game_state_snapshots (
        room_id VARCHAR(10) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        game_data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (room_id, version)
      );
    `);
    console.log('✅ Match History table verified/created.');

    await client.query(`
      INSERT INTO schema_migrations(version) VALUES ('20260826-p2-baseline')
      ON CONFLICT (version) DO NOTHING;
    `);
    console.log('✅ Schema migration ledger updated.');

    console.log('\n🎉 PostgreSQL schema initialization completed successfully!');
  } catch (error) {
    console.error('❌ Error running migrations:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupDatabase();
