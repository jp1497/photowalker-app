/** Unit tests for auth store. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { authStore } from './authStore';

const mockUser = {
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
  avatar_url: 'https://example.com/avatar.jpg',
  created_at: '2026-01-01T00:00:00Z',
};

describe('authStore', () => {
  beforeEach(() => {
    authStore.getState().clearUser();
  });

  afterEach(() => {
    authStore.getState().clearUser();
  });

  it('setUser sets user', () => {
    authStore.getState().setUser(mockUser);
    expect(authStore.getState().user).toEqual(mockUser);
  });

  it('setAccessToken sets access token', () => {
    authStore.getState().setAccessToken('token-123');
    expect(authStore.getState().accessToken).toBe('token-123');
  });

  it('clearUser clears user and access token', () => {
    authStore.getState().setUser(mockUser);
    authStore.getState().setAccessToken('token');
    authStore.getState().clearUser();
    expect(authStore.getState().user).toBeNull();
    expect(authStore.getState().accessToken).toBeNull();
  });

  it('logout clears user (via clearUser)', () => {
    authStore.getState().setUser(mockUser);
    authStore.getState().clearUser();
    expect(authStore.getState().user).toBeNull();
  });
});
