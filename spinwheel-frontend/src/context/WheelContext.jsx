import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { wheelApi } from '../api/wheel.api';
import { getSocket } from '../socket/socket';
import { useAuth } from './AuthContext';

const WheelContext = createContext(null);

export function WheelProvider({ children }) {
  const { isAuth, token } = useAuth();

  const [activeWheel,  setActiveWheel]  = useState(null);
  const [participants, setParticipants] = useState([]);
  const [eliminations, setEliminations] = useState([]);  // newest first
  const [winner,       setWinner]       = useState(null);
  const [gameStatus,   setGameStatus]   = useState('idle');
  const [loading,      setLoading]      = useState(false);

  // ── Fetch active wheel on mount ───────────────────────────
  const fetchActive = useCallback(async () => {
    setLoading(true);
    try {
      const res = await wheelApi.getActive();
      if (res.data.data) {
        setActiveWheel(res.data.data.wheel);
        setParticipants(res.data.data.participants || []);
        setGameStatus(res.data.data.wheel.status);
        setEliminations([]);
        setWinner(null);
      } else {
        setActiveWheel(null);
        setParticipants([]);
        setGameStatus('idle');
        setEliminations([]);
        setWinner(null);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (isAuth) fetchActive();
  }, [isAuth, fetchActive]);

  // ── Socket listeners ──────────────────────────────────────
  useEffect(() => {
    if (!isAuth) return;
    const socket = getSocket(token);

    // New wheel created by admin
    socket.on('wheel_created', (data) => {
      setParticipants([]);
      setEliminations([]);
      setWinner(null);
      setGameStatus('waiting');
      toast(`🎡 New wheel created! Entry: ${data.entryFee} coins`);
      // Fetch full wheel data so IDs/fields match what the UI expects.
      fetchActive();
    });

    // Someone joined
    socket.on('player_joined', (data) => {
      setParticipants(prev => {
        const exists = prev.find(p => p.username === data.username);
        if (exists) return prev;
        return [...prev, {
          username:       data.username,
          status:         'active',
          entry_fee_paid: data.entryFee || 0
        }];
      });
      // Update prize pools on wheel
      setActiveWheel(prev => prev ? {
        ...prev,
        winner_pool: data.winnerPool,
        admin_pool:  data.adminPool
      } : prev);
    });

    // Wheel started
    socket.on('wheel_started', (data) => {
      setGameStatus('active');
      toast('🚀 Wheel started! Eliminations begin!', { duration: 3000 });
    });

    // ── ELIMINATION — core event ──────────────────────────
    socket.on('player_eliminated', (data) => {
      // data = { wheelId, eliminatedUserId, eliminatedUsername, eliminationOrder, remainingPlayers }

      // Mark player as eliminated in participant list
      setParticipants(prev =>
        prev.map(p =>
          p.username === data.eliminatedUsername
            ? { ...p, status: 'eliminated' }
            : p
        )
      );

      // Add to front of eliminations list (newest first)
      setEliminations(prev => [data, ...prev]);

      toast(`💀 ${data.eliminatedUsername} eliminated! ${data.remainingPlayers} left`, {
        style: { background:'#1a0a0f', border:'1px solid #ff2d55', color:'#fff' },
        duration: 3000,
      });
    });

    // ── GAME OVER ─────────────────────────────────────────
    socket.on('game_over', (data) => {
      // data = { wheelId, winnerUserId, winnerUsername, amountWon, message }
      setGameStatus('finished');
      setWinner(data);

      // Mark winner in participants
      setParticipants(prev =>
        prev.map(p =>
          p.username === data.winnerUsername
            ? { ...p, status: 'winner' }
            : p
        )
      );
    });

    // Game aborted
    socket.on('game_aborted', (data) => {
      setGameStatus('aborted');
      toast.error(`❌ Game aborted. ${data.message}`);
      // Reset after a few seconds
      setTimeout(() => {
        setActiveWheel(null);
        setParticipants([]);
        setEliminations([]);
        setWinner(null);
        setGameStatus('idle');
      }, 4000);
    });

    return () => {
      socket.off('wheel_created');
      socket.off('player_joined');
      socket.off('wheel_started');
      socket.off('player_eliminated');
      socket.off('game_over');
      socket.off('game_aborted');
    };
  }, [isAuth, token, fetchActive]);

  // ── Auto join socket room when wheel is known ─────────────
  useEffect(() => {
    if (!activeWheel?.id || !isAuth) return;
    const socket = getSocket(token);
    const join = () => socket.emit('join_room', { wheelId: activeWheel.id });
    join();
    socket.on('connect', join);
    return () => socket.off('connect', join);
  }, [activeWheel?.id, isAuth, token]);

  const resetWheel = useCallback(() => {
    setActiveWheel(null);
    setParticipants([]);
    setEliminations([]);
    setWinner(null);
    setGameStatus('idle');
  }, []);

  return (
    <WheelContext.Provider value={{
      activeWheel, participants, eliminations,
      winner, gameStatus, loading,
      fetchActive, resetWheel
    }}>
      {children}
    </WheelContext.Provider>
  );
}

export function useWheel() {
  const ctx = useContext(WheelContext);
  if (!ctx) throw new Error('useWheel must be used within WheelProvider');
  return ctx;
}