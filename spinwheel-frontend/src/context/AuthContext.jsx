import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { authApi } from '../api/auth.api';
import { disconnectSocket, getSocket } from '../socket/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // ── On mount: restore session from localStorage ────────────
  useEffect(() => {
    const init = async () => {
      const savedToken = localStorage.getItem('token');
      if (!savedToken) { setLoading(false); return; }

      try {
        const res = await authApi.getMe();
        setUser(res.data.data.user);
        // Connect socket with token
        getSocket(savedToken);
      } catch {
        // Token invalid — clear everything
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // ── Login ──────────────────────────────────────────────────
  const login = useCallback(async (username, password) => {
    const res   = await authApi.login({ username, password });
    const { user: userData, token: newToken } = res.data.data;

    localStorage.setItem('token', newToken);
    localStorage.setItem('user',  JSON.stringify(userData));

    setToken(newToken);
    setUser(userData);

    // Connect socket after login
    getSocket(newToken);

    toast.success(`Welcome back, ${userData.username}! 🎡`);
    return userData;
  }, []);

  // ── Register ───────────────────────────────────────────────
  const register = useCallback(async (username, email, password) => {
    const res   = await authApi.register({ username, email, password });
    const { user: userData, token: newToken } = res.data.data;

    localStorage.setItem('token', newToken);
    localStorage.setItem('user',  JSON.stringify(userData));

    setToken(newToken);
    setUser(userData);
    getSocket(newToken);

    toast.success(`Account created! Welcome, ${userData.username}! 🎉`);
    return userData;
  }, []);

  // ── Logout ─────────────────────────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    disconnectSocket();
    toast('Logged out. See you soon! 👋');
  }, []);

  // ── Refresh user data ──────────────────────────────────────
  const refreshUser = useCallback(async () => {
    try {
      const res = await authApi.getMe();
      setUser(res.data.data.user);
    } catch { /* silent */ }
  }, []);

  const isAdmin = user?.role === 'admin';
  const isAuth  = !!user && !!token;

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      isAuth, isAdmin,
      login, register, logout, refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
