const jwt = require('jsonwebtoken');

/**
 * Full Socket.io event handler
 *
 * Events emitted BY SERVER → clients:
 *   wheel_created       → new wheel available
 *   player_joined       → someone joined + pool update
 *   wheel_started       → game is beginning
 *   player_eliminated   → who got knocked out + how many left
 *   game_over           → winner announced
 *   game_aborted        → game cancelled + refunds issued
 *   error               → something went wrong
 *
 * Events listened FROM clients → server:
 *   join_room           → subscribe to a wheel's updates
 *   leave_room          → unsubscribe
 *   ping                → heartbeat check
 */
module.exports = function (io) {

  // ── Auth middleware for socket connections ─────────────────
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        socket.user = null;
        return next();
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      socket.user = null;
      next();
    }
  });

  // ── Track connected users ──────────────────────────────────
  const connectedUsers = new Map();

  io.on('connection', (socket) => {
    const userInfo = socket.user
      ? `${socket.user.username} (id:${socket.user.id})`
      : 'anonymous';

    console.log(`🔌 Connected: ${socket.id} — ${userInfo}`);

    connectedUsers.set(socket.id, {
      userId:   socket.user?.id || null,
      username: socket.user?.username || 'anonymous',
      rooms:    []
    });

    // ── JOIN ROOM ──────────────────────────────────────────
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

        const sockets = await io.in(room).fetchSockets();
        socket.to(room).emit('spectator_joined', {
          wheelId,
          watcherCount: sockets.length
        });
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

    // ── Welcome message ────────────────────────────────────
    socket.emit('connected', {
      message:     'Connected to SpinWheel real-time server 🎡',
      socketId:    socket.id,
      connectedAs: socket.user?.username || 'spectator',
      timestamp:   new Date().toISOString()
    });
  });

  io.getConnectedCount = () => connectedUsers.size;
};
