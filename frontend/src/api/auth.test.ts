/** Unit tests for auth API. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './client';
import { getMe, loginWithCode, logout, refresh } from './auth';

vi.mock('./client', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

describe('auth API', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loginWithCode calls POST /v1/auth/google with code', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { access_token: 'token', user: { id: '1', email: 'a@b.com', name: 'A', avatar_url: null, created_at: '' } },
    });
    await loginWithCode('test-code');
    expect(apiClient.post).toHaveBeenCalledWith('/v1/auth/google', { code: 'test-code' });
  });

  it('refresh calls POST /v1/auth/refresh', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { access_token: 'new-token' } });
    await refresh();
    expect(apiClient.post).toHaveBeenCalledWith('/v1/auth/refresh');
  });

  it('logout calls POST /v1/auth/logout', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await logout();
    expect(apiClient.post).toHaveBeenCalledWith('/v1/auth/logout');
  });

  it('getMe calls GET /v1/auth/me and returns user', async () => {
    const user = { id: '1', email: 'a@b.com', name: 'A', avatar_url: null, created_at: '' };
    vi.mocked(apiClient.get).mockResolvedValue({ data: { user } });
    const result = await getMe();
    expect(apiClient.get).toHaveBeenCalledWith('/v1/auth/me');
    expect(result).toEqual(user);
  });
});
