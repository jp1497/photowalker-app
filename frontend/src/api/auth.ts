/** Auth API: login (redirect to Google), callback (exchange code), refresh, logout, getMe. */
import type { AuthGoogleResponse, AuthMeResponse, AuthRefreshResponse, User } from '../types/api';
import { apiClient } from './client';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_SCOPES = 'openid email profile';

/**
 * Build Google OAuth authorization URL. User is redirected here to sign in.
 */
export function buildGoogleAuthUrl(): string {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('VITE_GOOGLE_CLIENT_ID is not configured');
  }
  const redirectUri = `${window.location.origin}/auth/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Redirect user to Google OAuth consent screen.
 */
export function login(): void {
  window.location.href = buildGoogleAuthUrl();
}

/**
 * Exchange authorization code for tokens and user. Call from /auth/callback.
 */
export async function loginWithCode(code: string): Promise<AuthGoogleResponse> {
  const { data } = await apiClient.post<AuthGoogleResponse>('/v1/auth/google', { code });
  return data;
}

/**
 * Refresh access token using HTTP-only cookie.
 */
export async function refresh(): Promise<AuthRefreshResponse> {
  const { data } = await apiClient.post<AuthRefreshResponse>('/v1/auth/refresh');
  return data;
}

/**
 * Log out and clear refresh cookie.
 */
export async function logout(): Promise<void> {
  await apiClient.post('/v1/auth/logout');
}

/**
 * Fetch current user. Requires valid access token.
 */
export async function getMe(): Promise<User> {
  const { data } = await apiClient.get<AuthMeResponse>('/v1/auth/me');
  return data.user;
}

/** Body for PATCH /v1/auth/me (update profile). */
export interface UpdateMePayload {
  default_map_lat?: number;
  default_map_lon?: number;
}

/**
 * Update current user profile (e.g. default map location). Requires valid access token.
 */
export async function updateMe(payload: UpdateMePayload): Promise<User> {
  const { data } = await apiClient.patch<AuthMeResponse>('/v1/auth/me', payload);
  return data.user;
}
