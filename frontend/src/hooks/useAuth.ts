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
          fetch('http://127.0.0.1:7242/ingest/e7ab6a1d-b94e-4608-8339-27a255fff356', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'useAuth.ts:initSession', message: 'refresh success', data: { hypothesisId: 'D', runId: 'post-fix' }, timestamp: Date.now(), sessionId: 'debug-session' }) }).catch(() => {});
        } catch (e) {
          fetch('http://127.0.0.1:7242/ingest/e7ab6a1d-b94e-4608-8339-27a255fff356', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'useAuth.ts:catch', message: 'refresh failed', data: { err: String(e), hypothesisId: 'D', runId: 'post-fix' }, timestamp: Date.now(), sessionId: 'debug-session' }) }).catch(() => {});
          clearUser();
        } finally {
          setLoading(false);
          // Keep initPromise set so concurrent/re-run effects await it instead of starting new refresh
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
