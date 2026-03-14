import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

let socket = null;
let currentToken = null;

export function getSocket(token = null) {
  // Return existing socket if same token and still connected
  if (socket && socket.connected && token === currentToken) {
    return socket;
  }

  // Disconnect old socket cleanly
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  currentToken = token;

  socket = io(SOCKET_URL, {
    auth:                 { token },
    transports:           ['websocket', 'polling'],
    reconnection:         true,
    reconnectionDelay:    1000,
    reconnectionAttempts: 10,
  });

  socket.on('connect',       () => console.log('🔌 Socket connected:', socket.id));
  socket.on('disconnect', (r) => console.log('🔌 Socket disconnected:', r));
  socket.on('connect_error', (e) => console.warn('⚠️ Socket error:', e.message));

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    currentToken = null;
  }
}

export { socket };