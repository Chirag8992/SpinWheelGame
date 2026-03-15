# 🎡 SpinWheel Game System

A real-time multiplayer spin wheel game where users pay entry fees to join, compete for a prize pool, and the last player standing wins everything.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js v18+ (ES2022) |
| Framework | Express.js |
| Database | Microsoft SQL Server (MSSQL) |
| DB Driver | mssql (native, no ORM) |
| Real-Time | Socket.io |
| Queue | Bull (Redis-backed) |
| Cache/Locks | Redis |
| Auth | JWT + bcryptjs |
| Security | helmet + express-rate-limit |
| Frontend | React + Vite + Socket.io-client |

---

## Prerequisites

- Node.js v18+
- Microsoft SQL Server (local or remote)
- Redis (local or Docker: `docker run -d -p 6379:6379 redis`)

---

## Setup

### 1. Clone and install

```bash
git clone <your-repo-url>
cd SpinWheel_Backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=3000
DB_SERVER=localhost
DB_NAME=spinwheel
DB_USER=sa
DB_PASSWORD=YourPassword
DB_PORT=1433
DB_ENCRYPT=false
JWT_SECRET=change_this_to_a_long_random_string_min_32_chars
JWT_EXPIRES_IN=7d
ADMIN_SECRET=change_this_secret_to_create_admins
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
CORS_ORIGIN=http://localhost:5173
WELCOME_COINS=1000
NODE_ENV=development
```

### 3. Run database migrations

Open SQL Server Management Studio (SSMS) and run in order:

```
migrations/script.sql              ← tables + stored procedures
migrations/001_create_system_settings.sql  ← game settings table
migrations/002_indexes_and_constraints.sql ← performance indexes + DB constraints
```

Then seed the initial config (run after first admin registration):

```sql
-- Replace 1 with your admin user's ID
INSERT INTO coin_distribution_config (winner_percent, admin_percent, app_percent, is_active, created_by)
VALUES (60.00, 30.00, 10.00, 1, 1);
```

### 4. Start

```bash
npm run dev   # development with auto-restart
npm start     # production
```

### 5. Verify

```
GET http://localhost:3000/health
→ { "success": true, "message": "SpinWheel API is running 🎡" }
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Client (Browser)                    │
│              React + Vite + Socket.io-client            │
└──────────────┬──────────────────────────┬───────────────┘
               │  HTTP (REST API)          │  WebSocket
               ▼                          ▼
┌─────────────────────────────────────────────────────────┐
│                   Express.js Server                     │
│  helmet │ rate-limit │ CORS │ JWT auth middleware       │
│                                                         │
│  /api/auth  /api/coins  /api/wheel  /api/admin          │
│       ↓           ↓          ↓           ↓             │
│              Service Layer                              │
│    (validation → business logic → DB queries)           │
└──────────┬───────────────────────────┬─────────────────┘
           │                           │
           ▼                           ▼
┌──────────────────┐        ┌─────────────────────────────┐
│  Microsoft SQL   │        │     Redis                   │
│  Server (MSSQL)  │        │                             │
│                  │        │  Bull Queues:               │
│  Tables:         │        │  • auto-start-queue         │
│  • users         │        │  • elimination-queue        │
│  • spin_wheels   │        │                             │
│  • participants  │        │  Distributed Locks:         │
│  • transactions  │        │  • lock:join:wheel:X:user:Y │
│  • elim_log      │        │  • lock:start:wheel:X       │
│  • winners       │        │  • lock:elim:X:order:Y      │
│                  │        └─────────────────────────────┘
│  Stored Procs:   │
│  • sp_join       │        Socket.io rooms: wheel_{id}
│  • sp_payout     │        Real-time events broadcast to
│  • sp_abort      │        all clients in the wheel room
└──────────────────┘
```

---

## Game Flow

```
1. Admin creates wheel (entry fee set, 3-minute countdown starts in Bull queue)
2. Users join by paying entry fee coins
   → entry fee split atomically: winner_pool / admin_pool / app_pool
3. Wheel auto-starts at 3 min OR admin starts manually
   → if < 3 players: auto-abort + full refund via sp_abort_and_refund
4. Every 7 seconds → one random player eliminated (live Socket.io event)
5. Last player standing wins the accumulated winner_pool
6. sp_payout_winner atomically credits winner + admin, marks wheel finished
7. game_over event broadcast to all clients
```

---

## API Reference

### Auth

| Method | URL | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | None | Register user (gets 1000 welcome coins) |
| POST | `/api/auth/register-admin` | adminSecret in body | Register admin |
| POST | `/api/auth/login` | None | Login, returns JWT |
| GET | `/api/auth/me` | JWT | Get my profile |

### Coins

| Method | URL | Auth | Description |
|---|---|---|---|
| GET | `/api/coins/balance` | User | My balance |
| GET | `/api/coins/balance/:userId` | Admin | Any user's balance |
| POST | `/api/coins/credit` | Admin | Credit coins |
| POST | `/api/coins/debit` | Admin | Debit coins |
| GET | `/api/coins/transactions` | User | My transaction history |
| GET | `/api/coins/transactions/:userId` | Admin | Any user's transactions |

### Wheel

| Method | URL | Auth | Description |
|---|---|---|---|
| POST | `/api/wheel/create` | Admin | Create new wheel |
| POST | `/api/wheel/join` | User | Join (pays entry fee) |
| POST | `/api/wheel/start` | Admin | Manually start |
| POST | `/api/wheel/abort` | Admin | Abort + refund all |
| GET | `/api/wheel/active` | User | Current active wheel |
| GET | `/api/wheel/history` | User | Past wheels |
| GET | `/api/wheel/:wheelId` | User | Wheel details |

### Admin

| Method | URL | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/dashboard` | Admin | Full stats |
| GET/PUT | `/api/admin/config` | Admin | Coin distribution % |
| GET/PUT | `/api/admin/settings` | Admin | Game settings |
| GET | `/api/admin/users` | Admin | All users |
| PATCH | `/api/admin/users/:id/toggle` | Admin | Enable/disable user |
| GET | `/api/admin/analytics?days=7` | Admin | Analytics |

---

## Socket.io Events

### Connection

```js
const socket = io('http://localhost:3000', {
  auth: { token: 'your_jwt_token' }
});
socket.emit('join_room', { wheelId: 42 });
```

### Server → Client

| Event | When | Payload |
|---|---|---|
| `connected` | On connect | `{ socketId, connectedAs }` |
| `game_state_sync` | On `join_room` | Full snapshot: `{ wheel, participants, eliminations, winner }` |
| `wheel_created` | Admin creates wheel | `{ wheelId, entryFee, autoStartAt }` |
| `player_joined` | User joins | `{ username, totalPlayers, winnerPool }` |
| `wheel_started` | Game begins | `{ wheelId, participantCount }` |
| `player_eliminated` | Every 7s | `{ eliminatedUsername, eliminationOrder, remainingPlayers }` |
| `game_over` | Last player wins | `{ winnerUsername, amountWon }` |
| `game_aborted` | Admin aborts / < 3 players | `{ wheelId, message }` |

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `join_room` | `{ wheelId }` | Subscribe + receive `game_state_sync` |
| `leave_room` | `{ wheelId }` | Unsubscribe |
| `ping` | none | Heartbeat |
| `get_online_count` | `{ wheelId? }` | Get watcher count |

---

## Edge Cases Handled

| # | Edge Case | Solution |
|---|---|---|
| 1 | Two users join simultaneously | Redis distributed lock per `user+wheel` combination |
| 2 | User joins same wheel twice | DB UNIQUE constraint on `(spin_wheel_id, user_id)` + pre-check |
| 3 | User joins with insufficient coins | `sp_join_spin_wheel` uses `UPDLOCK` — rejects if balance < entry fee |
| 4 | Two admins create wheels simultaneously | Filtered unique index: `UX_spin_wheels_one_active` on `status IN ('waiting','active')` |
| 5 | Admin clicks Start at same time as auto-start fires | Redis lock `lock:start:wheel:X` — only one proceeds, other gets "already in progress" |
| 6 | < 3 players after 3-minute countdown | Bull auto-start job calls `sp_abort_and_refund` atomically |
| 7 | Admin manually starts with < 3 players | Validated in `startWheel()` before proceeding |
| 8 | Server crash mid-game | Bull queue persists in Redis — elimination jobs resume automatically on restart |
| 9 | Duplicate elimination job fires | Redis lock `lock:elim:wheelId:order` per elimination slot |
| 10 | Partial payout (server crash mid-payout) | `sp_payout_winner` uses `SET XACT_ABORT ON` — auto-rollback on any failure |
| 11 | Winner disconnects before payout | Payout is 100% server-side — no client action required |
| 12 | Disabled user tries to join | `is_active` checked on login AND on join |
| 13 | Page refresh / reconnect mid-game | `game_state_sync` sent on `join_room` with full current snapshot |
| 14 | Negative coin balance | DB `CHECK` constraint + service-level validation |

---

## Performance Decisions

### Why Bull + Redis for elimination queuing?
- Bull persists jobs to Redis — survives server crashes and restarts
- Each elimination is a separate delayed job (`delay: N * 7000ms`)
- Named job IDs (`elim:wheelId:order`) prevent duplicates
- Bull's retry mechanism handles transient DB failures automatically

### Why stored procedures for coin operations?
- `sp_join_spin_wheel`, `sp_payout_winner`, `sp_abort_and_refund` run atomically inside SQL transactions
- `SET XACT_ABORT ON` ensures automatic rollback on any error — no partial credits
- `UPDLOCK` + `ROWLOCK` hints prevent concurrent balance reads from both seeing the same balance

### Why Redis distributed locks?
- Node.js is single-threaded but async — two requests can interleave between a check and an update
- Redis `SET NX PX` (atomic set-if-not-exists with TTL) is the standard solution
- Lock TTLs (5-15s) ensure locks are always released even if the process crashes

### DB indexes added (migration 002)
- `IX_participants_wheel_status` — covers every elimination status query
- `IX_transactions_user_created` — covers every wallet history page load
- `IX_transactions_type_user` — covers leaderboard aggregation query
- `IX_wheels_status_active` — covers `getActiveWheel()` called on every join/create

### Connection pooling
- MSSQL connection pool: min 2, max 10 connections
- Avoids connection overhead on every query
- Idle connections closed after 30 seconds

---

## Running Tests

```bash
npm test

# Expected output:
# PASS  tests/wheel.test.js
#   buildEliminationSequence (6 tests)
#   calcPoolAmounts (6 tests)
#   entry fee validation (5 tests)
#   formatCoins (5 tests)
#   game state transition validation (6 tests)
```

---

## Assumptions

- One spin wheel active at a time (by design — enforced at DB and app level)
- Entry fee is fixed when wheel is created and cannot change after players join
- Coin distribution config is locked to the config active at wheel creation time
- App pool coins are tracked in DB but not credited to any user (platform revenue)
- Redis is required — no fallback mode without Redis
- Welcome coins (1000 by default) are credited atomically on registration