# 🎡 SpinWheel Game System

A real-time multiplayer spin wheel game where users pay entry fees, compete for a prize pool, and the last player standing wins.

---

## Tech Stack

- **Runtime:** Node.js (JavaScript ES2022)
- **Framework:** Express.js
- **Database:** Microsoft SQL Server (MSSQL)
- **ORM:** mssql (native driver)
- **Real-Time:** Socket.io
- **Queue:** Bull (Redis-backed)
- **Cache/Locks:** Redis
- **Auth:** JWT (jsonwebtoken + bcryptjs)

---

## Prerequisites

- Node.js v18+
- Microsoft SQL Server (local or remote)
- Redis (local or remote)

---

## Setup

### 1. Clone and install
```bash
git clone <your-repo-url>
cd spinwheel-game
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Edit `.env` with your values:
```env
PORT=3000
DB_SERVER=localhost
DB_NAME=spinwheel
DB_USER=sa
DB_PASSWORD=YourPassword
DB_PORT=1433
JWT_SECRET=your_long_random_secret
ADMIN_SECRET=your_admin_creation_secret
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

### 3. Run the database schema
Open SQL Server Management Studio (SSMS) and run `spinwheel_schema.sql`.

Then seed the initial coin config (replace `1` with your admin user ID after first registration):
```sql
INSERT INTO coin_distribution_config (winner_percent, admin_percent, app_percent, is_active, created_by)
VALUES (60.00, 30.00, 10.00, 1, 1);
```

### 4. Start the server
```bash
# Development (auto-restart on changes)
npm run dev

# Production
npm start
```

### 5. Verify
```
GET http://localhost:3000/health
→ { "success": true, "message": "SpinWheel API is running 🎡" }
```

---

## API Endpoints

### Auth
| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| POST | `/api/auth/register` | None | Register new user |
| POST | `/api/auth/register-admin` | None + adminSecret | Register admin |
| POST | `/api/auth/login` | None | Login, get JWT |
| GET | `/api/auth/me` | User | Get my profile |

### Coins
| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/coins/balance` | User | My balance |
| GET | `/api/coins/balance/:userId` | Admin | Any user balance |
| POST | `/api/coins/credit` | Admin | Credit coins to user |
| POST | `/api/coins/debit` | Admin | Debit coins from user |
| GET | `/api/coins/transactions` | User | My transaction history |
| GET | `/api/coins/transactions/:userId` | Admin | Any user transactions |

### Wheel
| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| POST | `/api/wheel/create` | Admin | Create new wheel |
| POST | `/api/wheel/join` | User | Join wheel (pays entry fee) |
| POST | `/api/wheel/start` | Admin | Manually start wheel |
| POST | `/api/wheel/abort` | Admin | Abort + refund all |
| GET | `/api/wheel/active` | User | Current active wheel |
| GET | `/api/wheel/history` | User | Past wheels |
| GET | `/api/wheel/:wheelId` | User | Specific wheel details |

### Admin
| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/admin/dashboard` | Admin | Full stats overview |
| GET | `/api/admin/config` | Admin | Coin distribution config |
| PUT | `/api/admin/config` | Admin | Update distribution % |
| GET | `/api/admin/settings` | Admin | System settings |
| PUT | `/api/admin/settings` | Admin | Update settings |
| GET | `/api/admin/users` | Admin | List all users |
| PATCH | `/api/admin/users/:userId/toggle` | Admin | Enable/disable user |
| GET | `/api/admin/analytics?days=7` | Admin | Game analytics |

---

## Socket.io Events

### Connection
```js
const socket = io('http://localhost:3000', {
  auth: { token: 'your_jwt_token' }
});
```

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `join_room` | `{ wheelId }` | Subscribe to wheel events |
| `leave_room` | `{ wheelId }` | Unsubscribe |
| `ping` | none | Heartbeat |
| `get_online_count` | `{ wheelId? }` | Get watcher count |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `connected` | `{ socketId, connectedAs }` | On connect |
| `room_joined` | `{ wheelId, room }` | Joined a room |
| `wheel_created` | `{ wheelId, entryFee, autoStartAt }` | New wheel available |
| `player_joined` | `{ wheelId, username, totalPlayers }` | Someone joined |
| `wheel_started` | `{ wheelId, participantCount }` | Game beginning |
| `player_eliminated` | `{ eliminatedUsername, remainingPlayers }` | Elimination |
| `game_over` | `{ winnerUsername, amountWon }` | Game finished |
| `game_aborted` | `{ wheelId, message }` | Game cancelled + refunded |

---

## Game Flow

```
1. Admin creates wheel (entry fee set, 3-min countdown starts)
2. Users join by paying entry fee (coins split: winner/admin/app pool)
3. Wheel auto-starts at 3 min OR admin starts manually
4. If < 3 players at auto-start → abort + full refund
5. Every 7 seconds → one random player eliminated (live Socket.io event)
6. Last player standing wins the winner pool
7. Admin receives admin pool automatically
```

---

## Edge Cases Handled

| # | Edge Case | How Handled |
|---|-----------|-------------|
| 1 | Two users join simultaneously | Redis distributed lock per user+wheel |
| 2 | User joins with insufficient coins | Stored procedure validates balance with UPDLOCK |
| 3 | User joins same wheel twice | DB UNIQUE constraint + pre-check |
| 4 | Admin creates 2nd wheel while one active | Filtered unique index on status column |
| 5 | < 3 players after 3 minutes | Bull auto-start job calls sp_abort_and_refund |
| 6 | Admin manually starts with < 3 players | Validated before starting |
| 7 | Server crash mid-game | Bull queue persists in Redis, resumes on restart |
| 8 | Duplicate elimination job fires | Redis lock per elimination order |
| 9 | Negative coin balance | DB CHECK constraint + service-level check |
| 10 | Partial payout (server crash mid-payout) | SET XACT_ABORT ON auto-rollback |
| 11 | Winner disconnects before payout | Payout is server-side, client not needed |
| 12 | Disabled user tries to join | is_active check on login + join |

---

## Assumptions

- One spin wheel active at a time (by design)
- Entry fee is fixed when wheel is created
- Coin distribution config uses the config active at wheel creation time (not changed mid-game)
- App pool coins are tracked in DB but not credited to any user (platform revenue)
- Redis is required for job queuing and distributed locks

---

## Architecture

```
Client (HTTP + Socket.io)
        ↓
Express API (routes → controllers → services)
        ↓
MSSQL (data + atomic stored procedures)
        ↓
Bull Queue (Redis) ← elimination timers + auto-start
        ↓
Socket.io ← real-time broadcast to all clients
```
