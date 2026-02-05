/** Axios instance: base URL, credentials, Bearer token, 401 interceptor. */
import axios, { type InternalAxiosRequestConfig } from 'axios';
import { authStore } from '../store/authStore';
import { refresh } from './auth';

// In dev, use relative URL so Vite proxy forwards to backend (same-origin = cookies work).
// In prod, use VITE_API_URL.
const baseURL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? 'http://localhost:8000');
// #region agent log
const _log = (loc: string, msg: string, d: Record<string, unknown>) => { fetch('http://127.0.0.1:7242/ingest/e7ab6a1d-b94e-4608-8339-27a255fff356', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: loc, message: msg, data: d, timestamp: Date.now(), sessionId: 'debug-session' }) }).catch(() => {}); };
_log('client.ts:init', 'apiClient baseURL', { baseURL, isDev: import.meta.env.DEV });
// #endregion

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

function getAccessToken(): string | null {
  return authStore.getState().accessToken;
}

function setAccessToken(token: string | null): void {
  authStore.getState().setAccessToken(token);
}

function clearAuthAndRedirect(): void {
  authStore.getState().clearUser();
  window.location.href = '/login';
}

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // #region agent log
  if (config.url?.includes('refresh')) _log('client.ts:request', 'refresh request', { url: (config.baseURL || '') + config.url, hasCredentials: true });
  // #endregion
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      // #region agent log
      _log('client.ts:401', '401 response', { url: originalRequest?.url, status: 401, isRefresh: originalRequest?.url?.includes('/v1/auth/refresh'), hypothesisId: 'A,D' });
      // #endregion
      if (originalRequest.url?.includes('/v1/auth/refresh')) {
        return Promise.reject(error);
      }
      if (originalRequest.url?.includes('/v1/auth/logout')) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = (async () => {
          try {
            const { access_token } = await refresh();
            setAccessToken(access_token);
          } catch {
            clearAuthAndRedirect();
          } finally {
            isRefreshing = false;
          }
        })();
      }
      await refreshPromise;

      const newToken = getAccessToken();
      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      }
    }

    return Promise.reject(error);
  }
);
