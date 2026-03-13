import { useEffect } from 'react';
import { getSocket } from '../socket/socket';
import { useAuth } from '../context/AuthContext';

/**
 * Subscribe to a socket event and auto-clean up on unmount.
 * Usage: useSocket('player_eliminated', (data) => { ... })
 */
export function useSocket(event, handler) {
  const { token } = useAuth();
  useEffect(() => {
    const socket = getSocket(token);
    socket.on(event, handler);
    return () => socket.off(event, handler);
  }, [event, handler, token]);
}
