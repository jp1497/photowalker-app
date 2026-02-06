/** Auth hook: wraps auth store, provides login/logout, initializes session on mount. */
import { useEffect } from 'react';
import { authStore } from '../store/authStore';
import { getMe, login as loginRedirect, logout as logoutApi } from '../api/auth';

let initPromise: Promise<void> | null = null;

export function useAuth() {
  const { user, loading, setUser, setAccessToken, setLoading, clearUser } = authStore();

  useEffect(() => {
    if (window.location.pathname === '/auth/callback') {
      setLoading(false);
      return;
    }
    if (window.location.pathname === '/login') {
      setLoading(false);
      return;
    }
    const initSession = async () => {
      if (initPromise) {
        await initPromise;
        return;
      }
      setLoading(true);
      initPromise = (async () => {
        try {
          const { refresh } = await import('../api/auth');
          const { access_token } = await refresh();
          setAccessToken(access_token);
          const userData = await getMe();
          setUser(userData);
        } catch {
          clearUser();
        } finally {
          setLoading(false);
        }
      })();
      await initPromise;
    };
    initSession();
  }, [setUser, setAccessToken, setLoading, clearUser]);

  const login = () => loginRedirect();

  const logout = async () => {
    try {
      await logoutApi();
    } finally {
      clearUser();
    }
  };

  return { user, loading, login, logout, isAuthenticated: !!user };
}
