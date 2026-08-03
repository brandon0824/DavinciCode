# DaVinci Code Online Multiplayer Board Game

This is a real-time online multiplayer implementation of the classic **DaVinci Code (Coda)** board game, built using **Next.js 14 App Router + Tailwind CSS + Framer Motion + PostgreSQL**. The system supports local development execution, Serverless deployment, and Docker containerized one-click deployment (with host directory volume persistence and embedded lightweight PostgreSQL 15 database).

Language Options:
- [English Documentation](README.md)
- [Chinese Documentation / 中文文档](README_zh.md)

---

## ✨ System Features & Highlights

* **🔑 Mandatory User Registration & Secure Authentication (Bcrypt)**:
  * **Login Gatekeeper**: Users must register or log in to a valid user account before creating or joining any room. Both frontend UI and backend PostgreSQL database strictly enforce user identity verification.
  * **Password Hashing**: Employs standard `bcryptjs` salted password hashing stored securely inside PostgreSQL. No plain text passwords are ever stored.
  * **Session Persistence**: User sessions automatically persist in browser `sessionStorage`, avoiding repeated logins on page refresh.

* **🃏 Black & White Wildcard Joker (`-`) Card Rules**:
  * **26-Card Full Deck**: Contains 12 Black cards (0-11) + 12 White cards (0-11) plus **1 Black Wildcard Joker (`-`)** and **1 White Wildcard Joker (`-`)**.
  * **Special Visuals & Decision Buttons**: Wildcard Jokers in hand feature golden `-` badges with a `Wildcard` indicator. The guessing dialog includes a dedicated `- (Wildcard Joker)` decision button.

* **🏆 Personal Battle History & Global Leaderboard (`/stats`)**:
  * Permanently records player statistics (`total_games`, `total_wins`, `total_losses`) in the `users` table and match details in `match_history`.
  * The `/stats` page showcases "Personal Match History" and "Global Win Rate Leaderboard" (with gold 🥇 styling for rank #1), perfectly responsive on mobile devices.

* **🎉 Settlement Modal with Manual Acknowledgment & Full Hand Disclosure**:
  * Displays a victory/game over modal revealing **all players' final hand card values and wildcards** upon game completion for full disclosure and review.
  * Auto-redirect is disabled; players return to the room lobby only when clicking `[Return to Waiting Room (Prepare Next Round)]`.

* **⏰ 30-Second Multiples Inaction Reminder**:
  * Triggers a timer during active turns. If inaction exceeds 30s, 60s, 90s..., an animated warning toast alerts the player.

* **🎨 Modern Better-UI Design & Dual Theme Modes**:
  * Built following `better-ui` engineering guidelines with tactile press feedback (`Scale on Press`), concentric radii, soft shadows, and Light/Dark mode toggling.
  * Fully optimized for mobile screens (iPhone/Android) with zero text wrapping or vertical misalignment.

* **🟢 Real-time Global Online Counter & 15s Heartbeat Window**:
  * Displays **`🟢 Active Online Players: X`** with a pulsing emerald status indicator at the footer of all pages.
  * Silent client heartbeat runs every 4 seconds. Closing browser tabs automatically deducts offline users within 15 seconds.

* **⚠️ 20-Second Room Disconnection Auto-Cleanup & Room Event Logs**:
  * Automatically removes inactive room players who close Chrome tabs or lose connection for over 20 seconds, freeing room slots.
  * Host status is seamlessly transferred to remaining room members if the host disconnects.
  * Waiting room lobby displays a **`📢 Room Event Log`** stream tracking player joins (`📢`), leaves (`🚪`), and offline cleanups (`⚠️`).

* **🔑 Room Host Password Bypass for Returning**:
  * Room hosts returning to their own password-protected room bypass the password prompt on frontend and backend.

* **🐳 Docker Deployment & Data Volume Persistence**:
  * Shell scripts provided: `docker-build.sh` (one-click deployment) and `cleanDBAndRestart.sh` (one-click database wipe & restart).
  * Host volume directory `/root/davinci_pgdata:/var/lib/postgresql` preserves all user accounts and battle history across container rebuilds.

* **🌐 Direct External Database Connection Support**:
  * Automatically exposes PostgreSQL port `5432` and enables `listen_addresses = '*'`, allowing direct external management via Navicat, DBeaver, DataGrip, or pgAdmin.

---

## 🛠️ Technology Stack

* **Core Framework**: Next.js 14 (App Router)
* **Frontend UI & Animations**: React 18, Tailwind CSS, Framer Motion, Lucide React
* **Backend API**: Next.js Route Handlers (RESTful APIs)
* **Encryption**: Bcryptjs (Salted password hashing)
* **Database**: PostgreSQL (with `pg` connection pool & JSONB data storage)
* **Containerization**: Docker (Embedded PostgreSQL 15 & automated shell deployment scripts)

---

## 🔌 External Database Connection Info (Navicat / DBeaver / DataGrip)

After allowing inbound TCP port `5432` in your server firewall / cloud security group:

- **Host**: Your Linux server's public IPv4 address
- **Port**: `5432`
- **Database**: `davinci`
- **Username**: `root`
- **Password**: `Shithappen0824`

---

## 🚀 Quick Start

Supports **Docker one-click deployment** or **Local Node.js environment**.

### Option 1: Docker One-Click Shell Script Deployment (Recommended, Port 60824 & Persistence at `/root/davinci_pgdata`)

Packaged with Node.js runtime and embedded PostgreSQL database:

1. **Run Deployment Script**:
   ```bash
   chmod +x docker-build.sh && ./docker-build.sh
   ```
2. **Reset/Wipe Database and Re-deploy Script** (Optional):
   ```bash
   chmod +x cleanDBAndRestart.sh && ./cleanDBAndRestart.sh
   ```
3. **Access Game**:
   Open browser at `http://<SERVER_IP>:60824` to play!

---

### Option 2: Local Node.js Development Environment

Requires [Node.js (22+)](https://nodejs.org) and [PostgreSQL (14+)](https://www.postgresql.org).

#### 1. Install Dependencies
```bash
npm install
```

#### 2. Configure Environment Variables
Create `.env.local` file in root directory:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=root
DB_PASSWORD=root
DB_NAME=davinci
```

#### 3. Run Database Setup Script
```bash
node scripts/setup-pg.js
```

#### 4. Start Development Server
```bash
npm run dev
```
Access at `http://localhost:3000` or `http://localhost:60824`.

#### 5. Production Build
```bash
npm run build
npm start
```

---

## 🎮 Game Rules & Gameplay Flow

1. **User Registration & Login**:
   * Players must register or log in on the homepage. Unauthenticated users cannot create or join rooms.
2. **Create or Join Room**:
   * Logged-in users can create custom rooms (with optional password protection) or join available rooms in the lobby list.
3. **Lobby Waiting & Game Start**:
   * When 2-4 players assemble, the host can click "Start Game" to launch the match.
4. **Turn Actions**:
   * **Draw Card**: Draw 1 card from the Black or White deck. Standard cards auto-sort in ascending order (Black left of White). Wildcard Jokers (`-`) are placed on the right.
   * **Guess Card**: Click an opponent's hidden card and guess its value (`0`-`11` or `- Wildcard Joker`).
     - **Correct**: Target card is revealed. Player can guess again or pass turn.
     - **Wrong**: As penalty, player's newly drawn card is forcibly revealed, ending the turn.
   * **Surrender & Elimination**: Players with all cards revealed are eliminated. The last survivor wins.
5. **Settlement & Review**:
   * All players' final hands are disclosed in the game over modal. Click `[Return to Waiting Room (Prepare Next Round)]` to return to the room lobby.
