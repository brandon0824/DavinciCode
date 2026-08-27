-- Legacy/reference schema for Supabase deployments.
-- PostgreSQL Docker deployments use scripts/setup-pg.js as the canonical migration source.
-- Keep table names aligned with the application (match_history, not game_history).
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Drop existing tables if they exist (in reverse order of dependencies)
drop table if exists game_history cascade;
drop table if exists game_states cascade;
drop table if exists room_players cascade;
drop table if exists rooms cascade;

-- 0. Create Users Table (User Accounts & Battle Stats)
create table if not exists users (
  id uuid default uuid_generate_v4() primary key,
  username text unique not null,
  password_hash text not null,
  total_games integer default 0 not null,
  total_wins integer default 0 not null,
  total_losses integer default 0 not null,
  role text default 'player' not null,
  must_change_password boolean default false not null,
  password_reset_expires_at timestamp with time zone,
  password_reset_by text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  last_login_at timestamp with time zone
);

-- 1. Create Rooms Table
create table rooms (
  id text primary key, -- 6-character room code (e.g., '4ARFEU')
  name text not null,
  password text,
  status text not null default 'waiting', -- 'waiting', 'playing', 'finished'
  max_players integer not null default 4,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  started_at timestamp with time zone,
  ended_at timestamp with time zone
  ,match_id text
);

-- 2. Create Room Players Table
create table room_players (
  id uuid default uuid_generate_v4() primary key,
  room_id text references rooms(id) on delete cascade not null,
  username text not null,
  is_host boolean default false not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  left_at timestamp with time zone,
  unique (room_id, username)
);

-- 3. Create Game States Table
create table game_states (
  room_id text references rooms(id) on delete cascade primary key,
  current_turn_username text,
  game_data jsonb not null, -- Stores cards in deck, player hands, exposed cards, etc.
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table game_states add column if not exists version integer not null default 0;
alter table game_states add column if not exists updated_by text;

create table if not exists user_sessions (
  token_hash char(64) primary key,
  username text not null references users(username) on delete cascade,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
create table if not exists user_presence (
  username text primary key references users(username) on delete cascade,
  last_seen_at timestamp with time zone default timezone('utc'::text, now()) not null
);
create table if not exists room_messages (
  id bigserial primary key,
  room_id text not null references rooms(id) on delete cascade,
  username text not null references users(username) on delete cascade,
  message varchar(500) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
create table if not exists game_actions (
  id bigserial primary key,
  room_id text not null references rooms(id) on delete cascade,
  match_id text, username text not null, action_id text not null, action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Create Match History Table
create table match_history (
  id uuid default uuid_generate_v4() primary key,
  match_id text not null default '',
  room_id text not null,
  username text not null,
  is_winner boolean default false not null,
  started_at timestamp with time zone default timezone('utc'::text, now()) not null,
  ended_at timestamp with time zone default timezone('utc'::text, now()) not null
);
create unique index if not exists match_history_match_user_idx on match_history(match_id, username);
create index if not exists rooms_status_created_idx on rooms(status, created_at);
create index if not exists room_players_room_idx on room_players(room_id);
create index if not exists match_history_user_started_idx on match_history(username, started_at);
create index if not exists users_last_login_idx on users(last_login_at);
create index if not exists game_states_updated_idx on game_states(updated_at);
create index if not exists user_presence_seen_idx on user_presence(last_seen_at);
create index if not exists room_messages_room_created_idx on room_messages(room_id, created_at desc);
create unique index if not exists game_actions_room_action_idx on game_actions(room_id, action_id);
create index if not exists game_actions_room_created_idx on game_actions(room_id, created_at desc);
create table if not exists game_state_snapshots (
  room_id text not null references rooms(id) on delete cascade,
  version integer not null,
  game_data jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (room_id, version)
);

-- Enable Realtime for all tables
alter publish supabase_realtime add table rooms;
alter publish supabase_realtime add table room_players;
alter publish supabase_realtime add table game_states;
alter publish supabase_realtime add table match_history;

-- Disable RLS for all tables to allow simple public read/write access for testing
alter table rooms disable row level security;
alter table room_players disable row level security;
alter table game_states disable row level security;
alter table match_history disable row level security;
