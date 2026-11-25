import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ct_user')); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem('ct_token');
    if (!token) { setUser(null); setLoading(false); return; }
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user);
      localStorage.setItem('ct_user', JSON.stringify(data.user));
      connectSocket(data.user._id || data.user.id);
    } catch {
      localStorage.removeItem('ct_token'); localStorage.removeItem('ct_user'); setUser(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('ct_token', data.token);
    localStorage.setItem('ct_user', JSON.stringify(data.user));
    setUser(data.user);
    connectSocket(data.user._id || data.user.id);
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    localStorage.setItem('ct_token', data.token);
    localStorage.setItem('ct_user', JSON.stringify(data.user));
    setUser(data.user);
    connectSocket(data.user._id || data.user.id);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('ct_token'); localStorage.removeItem('ct_user');
    disconnectSocket(); setUser(null);
  };

  const updateUser = (u) => { setUser(u); localStorage.setItem('ct_user', JSON.stringify(u)); };

  return <AuthContext.Provider value={{ user, loading, login, register, logout, refresh, updateUser }}>{children}</AuthContext.Provider>;
}
