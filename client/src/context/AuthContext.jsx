import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { signInWithGoogleAccount, signOutOfFirebase, watchAuthState } from '../services/firebase';

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

  /**
   * Firebase Authentication is the identity for Google accounts. The app then
   * reads (or creates) the matching profile in the Firestore `users` collection
   * and signs the person in with that stored record.
   */
  const syncGoogleUser = useCallback(async (googleUser) => {
    const { data } = await api.post('/auth/google', {
      uid: googleUser.uid,
      email: googleUser.email,
      name: googleUser.displayName,
      avatar: googleUser.photoURL,
    });
    return startSession(data);
  }, []);

  useEffect(() => {
    refresh();
    // A returning Google user is restored by Firebase Auth on page load; the
    // profile is fetched from the database rather than trusted from local state.
    const unsubscribe = watchAuthState((googleUser) => {
      if (!googleUser?.email) return;
      syncGoogleUser(googleUser).then(setUser).catch(() => {});
    });
    return unsubscribe;
  }, [refresh, syncGoogleUser]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    const signedIn = startSession(data);
    setUser(signedIn);
    return signedIn;
  };

  /** Google popup → Firebase Authentication → Firestore profile → app session. */
  const loginWithGoogle = async () => {
    const googleUser = await signInWithGoogleAccount();
    try {
      return await syncGoogleUser(googleUser);
    } catch (error) {
      await signOutOfFirebase().catch(() => {});
      throw error;
    }
  };

  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    const signedIn = startSession(data);
    setUser(signedIn);
    return signedIn;
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
