/** Axios instance: base URL, credentials, Bearer token, 401 interceptor. */
import axios, { type InternalAxiosRequestConfig } from 'axios';
import { authStore } from '../store/authStore';
import { toastStore } from '../store/toastStore';
import { refresh } from './auth';

// In dev, use relative URL so Vite proxy forwards to backend (same-origin = cookies work).
// In prod, use VITE_API_URL.
const baseURL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? 'http://localhost:8000');

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
  const e2eSecret = import.meta.env.VITE_E2E_SECRET;
  if (import.meta.env.VITE_E2E_MODE === 'true' && typeof e2eSecret === 'string' && e2eSecret.length > 0) {
    config.headers['X-E2E-Secret'] = e2eSecret;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean; _skipToast?: boolean } | undefined;

    if (originalRequest && error.response?.status === 401 && !originalRequest._retry) {
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

    const status = error.response?.status;
    const is5xx = status >= 500;
    const isNetworkError = error.code === 'ERR_NETWORK' || error.message === 'Network Error';
    if ((is5xx || isNetworkError) && !originalRequest?._skipToast) {
      const msg = isNetworkError
        ? 'Network error. Check your connection and try again.'
        : 'Server error. Please try again.';
      toastStore.getState().add(msg, 'error');
    }
    return Promise.reject(error);
  }
);
