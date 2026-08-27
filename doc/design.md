# DaVinci Code Board Game - System Architecture & Design Document

This document provides a detailed technical description of the system architecture, technology choices, database schema, and core module implementation details for the "DaVinci Code" online multiplayer board game.

Language Options:
- [English Architecture Document](design.md)
- [Chinese Architecture Document / 中文架构设计文档](design_zh.md)

---

## 🏗️ Overall System Architecture

This project adopts a **Serverless-friendly** and **self-contained** full-stack architecture. Frontend views and backend API routes are implemented within the Next.js 14 (App Router) framework. Data is persisted in a PostgreSQL relational database, and user passwords are stored as salted Bcrypt hashes. The system is containerized via Docker and mapped to port **60824**, with the host PostgreSQL volume controlled by the required `PG_DATA_DIR` setting in `.env.docker`.

```
+----------------------------------------------------------------+
|                         Browser (Client)                       |
|   - View Layer: React 18 / Tailwind CSS / Framer Motion        |
|   - Pages: Auth / Game Lobby / Room Panel / Stats (/stats)     |
|   - Auth Layer: sessionStorage (Persistent Session) / Gatekeeper|
|   - Data Sync: HTTP Polling (Data-driven Short Polling)        |
+----------------------------------------------------------------+
                               |
                               | HTTP (JSON API, Port: 60824)
                               v
+----------------------------------------------------------------+
|                     Next.js Full-Stack App                     |
|   - Auth Routes: api/auth/register / api/auth/login (Bcrypt)   |
|   - Stats Routes: api/stats (Match History & Leaderboard)      |
|   - Logic Services: authService.ts / roomService.ts / gameLogic|
+----------------------------------------------------------------+
                               |
                               | SQL / TCP
                               v
+----------------------------------------------------------------+
|                     PostgreSQL Database                        |
|   - Permanent Tables: users (Password Hash, Battle Stats)      |
|   - Detail Tables: match_history (Per-match Record & Timestamp)|
|   - Temporary Tables: rooms / room_players / game_states       |
+----------------------------------------------------------------+
```

---

## 💻 Frontend & Backend Technical Responsibilities

Follows clean separation of concerns:

### 1. Client-Side (Frontend)
* **Environment**: Web Browser (Desktop & Mobile iPhone/Android).
* **Core Tech Stack**:
  * **React 18**: Core UI view layer using component-driven development for login, lobby, waiting room, game board, and leaderboard.
  * **Tailwind CSS**: Utility-first CSS framework for dark-mode panels, backdrop blur effects, and mobile responsive non-wrapping rules (`whitespace-nowrap`).
  * **Framer Motion**: Lightweight animation library for card sorting slide-ins, draw highlights, guessing modal, and timeout toasts.
  * **Lucide React**: Vector SVG icons (Crown, Users, Lock, Flag, Trophy, CheckCircle2, XCircle, etc.).
  * **Fetch API Polling**: Periodic polling (Lobby 3s, Game Room 1.5s) to pull and synchronize real-time states.

### 2. Server-Side (Backend)
* **Environment**: Node.js 22 Runtime (Port: 60824).
* **Core Tech Stack**:
  * **Next.js Route Handlers**: RESTful API routes handling authentication, room management, stats querying, and game turn commands.
  * **bcryptjs**: Password encryption library executing 10-round salted one-way hashing for user authentication.
  * **node-postgres (`pg`)**: Native Node.js PostgreSQL client managing high-concurrency connection pools (`Pool`).
  * **TypeScript**: Full static type safety from auth logic to game matrix algorithms.

### 3. Datastore
* **Environment**: Physical PostgreSQL or Containerized PostgreSQL 15.
* **Core Tech Stack**:
  * **Permanent Table (`users`)**: Stores player accounts, Bcrypt password hashes, and battle stats (`total_games`, `total_wins`, `total_losses`).
  * **Detail Table (`match_history`)**: Records individual match outcomes, win rates, and timestamps for the `/stats` leaderboard.
  * **Temporary Models (`rooms` / `room_players`)**: Maintains active online rooms and members.
  * **JSONB Storage (`game_states`)**: Atomically stores card layouts, logs, and game state JSON objects.

---

## 🗄️ Database Schema Design (PostgreSQL)

### 0. Users Table (`users`) — Permanent
* `id` (SERIAL, PK): Primary key.
* `username` (VARCHAR, UNIQUE): Unique username (1-20 characters).
* `password_hash` (VARCHAR): Bcrypt salted password hash.
* `total_games` (INT): Total games played (default 0).
* `total_wins` (INT): Total wins (default 0).
* `total_losses` (INT): Total losses (default 0).
* `created_at` / `last_login_at`: Registration and last login timestamps.

### 1. Match History Table (`match_history`) — Permanent
* `id` (SERIAL, PK): Primary key.
* `room_id` (VARCHAR): Room ID.
* `username` (VARCHAR): Player username.
* `is_winner` (BOOLEAN): Win flag (`true` = Victory 🏆, `false` = Defeat ❌).
* `started_at` (TIMESTAMP): Match start time.
* `ended_at` (TIMESTAMP): Match completion time.

### 2. Rooms Table (`rooms`) — Auto 24h Cleanup
* `id` (VARCHAR, PK): Room code (6-char random or 4-10 custom code).
* `name` (VARCHAR): Room name.
* `password` (VARCHAR, Nullable): Room password.
* `status` (VARCHAR): Room status: `waiting`, `playing`, `finished`.
* `max_players` (INT): Maximum player count (default 4).
* `created_at` / `started_at` / `ended_at`: Timestamps.
* **🧹 Auto 24h Cleanup**: Automatically removes rooms created over 24 hours ago and finished matches over 1 hour old (via `ON DELETE CASCADE`), freeing custom room codes without affecting permanent `users` or `match_history` tables.

### 3. Room Players Table (`room_players`)
* `id` (SERIAL, PK): Primary key.
* `room_id` (VARCHAR, FK): Foreign key referencing `rooms.id` (`ON DELETE CASCADE`).
* `username` (VARCHAR): Player username.
* `is_host` (BOOLEAN): Host flag.
* `joined_at` / `left_at`: Join/leave timestamps.

### 4. Game States Table (`game_states`)
* `room_id` (VARCHAR, PK, FK): Foreign key referencing `rooms.id`.
* `current_turn_username` (VARCHAR): Current active turn player.
* `game_data` (JSONB): Global game data JSON (cards, deck, guesses, logs).

---

## 🔒 Core Logic Modules & Key Implementations

1. **🔑 Mandatory Registration, bcrypt Authentication & Gatekeeper**:
   - Enforces user login validation prior to room creation or entry. Passwords must be at least 7 characters and are stored with bcrypt hashing, with legacy Base64 records upgraded on login. Both frontend and backend verify account existence in PostgreSQL.
2. **👑 System Admin Account (`admin`) & Exclusive Management Dashboard (`/admin`)**:
   - Database setup script pre-seeds the web admin account using `ADMIN_PASSWORD`; Docker PostgreSQL uses the fixed `root` / `brandon_pgdb` connection credentials.
   - Dedicated `/admin` dashboard accessible exclusively by `admin`; public leaderboard GET `/api/stats` filters out `admin` user.
   - Permission Isolation: `admin` is blocked from creating or joining rooms on both frontend and backend.
3. **🃏 Black & White Wildcard Joker (`-`) System & Free Insertion Placement**:
   - Deck size expanded from 24 to **26 cards** (including 1 Black Wildcard Joker `-` and 1 White Wildcard Joker `-`).
   - Standard cards (0-11) auto-sort in ascending order. Wildcards (`-`) can be **freely inserted into any slot index** (far left, between cards, or far right) when drawn or during turn via interactive "`⇄ Reposition`" controls.
   - Guessing dialog includes a dedicated `- (Wildcard Joker)` decision button.
3. **🎉 Game Over Settlement Modal without Auto-Redirect**:
   - Discloses all players' final hand card values and wildcards upon game completion.
   - Requires explicit player click on `[Return to Waiting Room (Prepare Next Round)]` to transition to the room waiting lobby.
4. **Automated Stats Settlement & Leaderboard (`/stats`)**:
   - Automatically inserts match outcome records into `match_history` and updates user win/loss counters upon game end.
   - The `/stats` page displays personal battle logs and global leaderboard (rank #1 highlighted in gold 🥇).
5. **🟢 Global Real-Time Online Counter & 15s Heartbeat Detection**:
   - Footer component sends a silent heartbeat every 4 seconds. The online count API checks active heartbeats within 15 seconds; closing tabs automatically deducts offline users within 15 seconds.
6. **⚠️ 20-Second Room Player Offline Auto-Cleanup & Dynamic Event Logs**:
   - Room polling checks player heartbeat timestamps and automatically kicks users who are inactive for >20s (e.g. tab closed), freeing room slots and transferring host status automatically.
   - Waiting room lobby displays a **`📢 Room Event Log`** stream tracking player joins (`📢`), leaves (`🚪`), and offline cleanups (`⚠️`).
7. **🔑 Room Host Password Bypass for Self-Created Rooms**:
   - Room hosts returning to their own password-protected rooms bypass the password modal on frontend and backend.
8. **30-Second Multiples Inaction Reminder**:
   - Triggers an active timer during the player's turn. Inaction exceeding 30s, 60s, 90s... prompts an animated warning toast.
9. **Containerization & Automatic DB Setup (`Dockerfile` & `entrypoint.sh`)**:
   - Docker Compose runs Next.js as a non-root `node` process and PostgreSQL in its official separate service. Data persistence is ensured via the host directory mount configured by `PG_DATA_DIR`.

---

## 🎨 Visual & Engineering Guidelines (Better-UI & Responsive)

* **Scale on Press**: All controls, cards, and number buttons feature `active:scale-[0.96] transition-transform duration-100`.
* **Concentric Radii & Soft Shadows**: Applied across modern translucent panels.
* **Dual Theme Modes (Light/Dark)**: Managed via custom `useTheme` hook and Tailwind CSS `.dark` class.
* **Mobile Layout Safety**: Uses `whitespace-nowrap` and `shrink-0` to guarantee text headers and game cards never wrap vertically on mobile screens (iPhone/Android).
