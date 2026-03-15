const jwt          = require('jsonwebtoken');
const { getPool, sql } = require('../config/db');

/**
 * Socket.io event handler
 *
 * Server → Client events:
 *   connected         → on connect confirmation
 *   room_joined       → joined room confirmation
 *   game_state_sync   → FULL current game state (sent on join_room so late-joiners / refreshers get caught up)
 *   wheel_created     → new wheel available
 *   player_joined     → someone joined + pool update
 *   wheel_started     → game is beginning
 *   player_eliminated → who got knocked out + how many left
 *   game_over         → winner announced
 *   game_aborted      → game cancelled + refunds issued
 *   error             → something went wrong
 *
 * Client → Server events:
 *   join_room         → subscribe to a wheel's updates
 *   leave_room        → unsubscribe
 *   ping              → heartbeat check
 *   get_online_count  → how many in a room
 */
module.exports = function (io) {

  // ── Auth middleware ────────────────────────────────────────
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) { socket.user = null; return next(); }
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      socket.user = null;
      next();
    }
  });

  const connectedUsers = new Map();

  io.on('connection', (socket) => {
    const userInfo = socket.user
      ? `${socket.user.username} (id:${socket.user.id})`
      : 'anonymous';

    console.log(`🔌 Connected: ${socket.id} — ${userInfo}`);
    connectedUsers.set(socket.id, {
      userId:   socket.user?.id   || null,
      username: socket.user?.username || 'anonymous',
      rooms:    []
    });

    // ── JOIN ROOM ──────────────────────────────────────────
    // FIX: After joining, emit full game state so any
    // reconnecting client / page-refresh gets caught up instantly.
    socket.on('join_room', async (data) => {
      try {
        const wheelId = typeof data === 'object' ? data.wheelId : data;
        if (!wheelId) return socket.emit('error', { message: 'wheelId required' });

        const room = `wheel_${wheelId}`;
        socket.join(room);

        const conn = connectedUsers.get(socket.id);
        if (conn && !conn.rooms.includes(room)) conn.rooms.push(room);
        console.log(`📺 ${userInfo} joined room: ${room}`);

        socket.emit('room_joined', {
          wheelId,
          room,
          message:     `You are now watching wheel #${wheelId}`,
          connectedAs: socket.user?.username || 'spectator'
        });

        // ── RECONNECT RESYNC ─────────────────────────────
        // Query current state and send snapshot to THIS client only.
        // Handles: page refresh mid-game, late joiners, reconnects.
        try {
          const pool = await getPool();

          const [wheelRes, participantsRes, elimRes] = await Promise.all([
            // Current wheel state
            pool.request()
              .input('id', sql.Int, wheelId)
              .query(`
                SELECT
                  sw.id, sw.status, sw.entry_fee,
                  sw.winner_pool, sw.admin_pool, sw.app_pool,
                  sw.auto_start_at, sw.started_at, sw.finished_at,
                  sw.created_at,
                  u.username AS created_by_username,
                  w.username AS winner_username,
                  cdc.winner_percent, cdc.admin_percent, cdc.app_percent
                FROM spin_wheels sw
                INNER JOIN users u   ON u.id  = sw.created_by
                LEFT  JOIN users w   ON w.id  = sw.winner_user_id
                INNER JOIN coin_distribution_config cdc ON cdc.id = sw.config_id
                WHERE sw.id = @id
              `),

            // All participants with their current status
            pool.request()
              .input('wheel_id', sql.Int, wheelId)
              .query(`
                SELECT
                  p.id, p.status, p.entry_fee_paid,
                  p.elimination_order, p.eliminated_at, p.joined_at,
                  u.id AS user_id, u.username
                FROM spin_wheel_participants p
                INNER JOIN users u ON u.id = p.user_id
                WHERE p.spin_wheel_id = @wheel_id
                ORDER BY p.joined_at ASC
              `),

            // Elimination history in order
            pool.request()
              .input('wheel_id', sql.Int, wheelId)
              .query(`
                SELECT
                  el.elimination_order,
                  el.remaining_players,
                  u.username AS eliminatedUsername,
                  u.id       AS eliminatedUserId
                FROM elimination_log el
                INNER JOIN users u ON u.id = el.eliminated_user_id
                WHERE el.spin_wheel_id = @wheel_id
                ORDER BY el.elimination_order ASC
              `)
          ]);

          const wheel = wheelRes.recordset[0];
          if (!wheel) {
            // Wheel doesn't exist (wrong ID) — don't send sync
            return;
          }

          // Build winner data if game is finished
          let winnerData = null;
          if (wheel.status === 'finished' && wheel.winner_username) {
            winnerData = {
              winnerUsername: wheel.winner_username,
              amountWon:      parseFloat(wheel.winner_pool)
            };
          }

          socket.emit('game_state_sync', {
            wheel,
            participants: participantsRes.recordset,
            eliminations: elimRes.recordset.reverse(), // newest first
            winner:       winnerData
          });

          console.log(`📡 Sent game_state_sync to ${userInfo} for wheel #${wheelId} (${participantsRes.recordset.length} players, ${elimRes.recordset.length} eliminations)`);

        } catch (syncErr) {
          // Non-fatal — client will work with events going forward
          console.error('game_state_sync error:', syncErr.message);
        }

        const sockets = await io.in(room).fetchSockets();
        socket.to(room).emit('spectator_joined', { wheelId, watcherCount: sockets.length });

      } catch (err) {
        console.error('join_room error:', err.message);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // ── LEAVE ROOM ─────────────────────────────────────────
    socket.on('leave_room', (data) => {
      const wheelId = typeof data === 'object' ? data.wheelId : data;
      if (!wheelId) return;
      const room = `wheel_${wheelId}`;
      socket.leave(room);
      const conn = connectedUsers.get(socket.id);
      if (conn) conn.rooms = conn.rooms.filter(r => r !== room);
      socket.emit('room_left', { wheelId, room });
    });

    // ── PING ───────────────────────────────────────────────
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });

    // ── ONLINE COUNT ───────────────────────────────────────
    socket.on('get_online_count', async (data) => {
      const wheelId = typeof data === 'object' ? data.wheelId : data;
      if (wheelId) {
        const sockets = await io.in(`wheel_${wheelId}`).fetchSockets();
        socket.emit('online_count', { wheelId, count: sockets.length });
      } else {
        socket.emit('online_count', { count: connectedUsers.size });
      }
    });

    // ── DISCONNECT ─────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      connectedUsers.delete(socket.id);
      console.log(`🔌 Disconnected: ${socket.id} — ${userInfo} (${reason})`);
    });

    socket.emit('connected', {
      message:     'Connected to SpinWheel real-time server 🎡',
      socketId:    socket.id,
      connectedAs: socket.user?.username || 'spectator',
      timestamp:   new Date().toISOString()
    });
  });

  io.getConnectedCount = () => connectedUsers.size;
};