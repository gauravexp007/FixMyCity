import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { signInWithGoogleAccount, signOutOfFirebase } from '../services/firebase';

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

function startSession(data) {
  localStorage.setItem('ct_token', data.token);
  localStorage.setItem('ct_user', JSON.stringify(data.user));
  return data.user;
}

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
    } catch {
      localStorage.removeItem('ct_token'); localStorage.removeItem('ct_user'); setUser(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    return startSession(data);
  };

  /** Google popup → Firebase Authentication → Firestore user record → session. */
  const loginWithGoogle = async () => {
    const googleUser = await signInWithGoogleAccount();
    try {
      const { data } = await api.post('/auth/google', {
        uid: googleUser.uid,
        email: googleUser.email,
        name: googleUser.displayName,
        avatar: googleUser.photoURL,
      });
      return startSession(data);
    } catch (error) {
      // The Google session exists but the app session could not be created.
      await signOutOfFirebase().catch(() => {});
      throw error;
    }
  };

  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    return startSession(data);
  };

  const logout = () => {
    api.signOut?.();
    signOutOfFirebase().catch(() => {});
    localStorage.removeItem('ct_token'); localStorage.removeItem('ct_user');
    setUser(null);
  };

  const updateUser = (u) => { setUser(u); localStorage.setItem('ct_user', JSON.stringify(u)); };

  return <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, register, logout, refresh, updateUser }}>{children}</AuthContext.Provider>;
}
