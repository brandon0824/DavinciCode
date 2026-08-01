-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Drop existing tables if they exist (in reverse order of dependencies)
drop table if exists game_history cascade;
drop table if exists game_states cascade;
drop table if exists room_players cascade;
drop table if exists rooms cascade;

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

-- 4. Create Game History Table
create table game_history (
  id uuid default uuid_generate_v4() primary key,
  room_id text references rooms(id) on delete cascade not null,
  username text not null,
  action_type text not null, -- 'guess', 'reveal', 'draw', 'pass'
  action_data jsonb,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Realtime for all tables
alter publish supabase_realtime add table rooms;
alter publish supabase_realtime add table room_players;
alter publish supabase_realtime add table game_states;
alter publish supabase_realtime add table game_history;

-- Disable RLS for all tables to allow simple public read/write access for testing
alter table rooms disable row level security;
alter table room_players disable row level security;
alter table game_states disable row level security;
alter table game_history disable row level security;
