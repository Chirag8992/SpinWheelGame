import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

let socket = null;

/**
 * Get or create the singleton socket connection.
 * Pass token to authenticate as a logged-in user.
 */
export function getSocket(token = null) {
  // If already connected with same token, reuse it
  if (socket && socket.connected) return socket;

  // Disconnect old socket if token changed
  if (socket) socket.disconnect();

  socket = io(SOCKET_URL, {
    auth:              { token },
    transports:        ['websocket', 'polling'],
    reconnection:      true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
  });

  socket.on('connect',            () => console.log('🔌 Socket connected:', socket.id));
  socket.on('disconnect', (reason) => console.log('🔌 Socket disconnected:', reason));
  socket.on('connect_error', (err) => console.warn('⚠️  Socket error:', err.message));

  return socket;
}

/**
 * Disconnect and clear the singleton.
 * Call this on logout.
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export { socket };
