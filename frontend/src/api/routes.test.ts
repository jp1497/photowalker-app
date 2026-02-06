/** Unit tests for routes API. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './client';
import { createRoute } from './routes';
import type { RouteCreatePayload } from '../types/route';

vi.mock('./client', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

describe('routes API', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('createRoute sends POST /v1/routes with correct payload', async () => {
    const payload: RouteCreatePayload = {
      title: 'Test Route',
      description: 'A test',
      route_geometry: {
        type: 'LineString',
        coordinates: [
          [-122.4, 37.8],
          [-122.41, 37.81],
        ],
      },
      tags: ['urban'],
      is_public: true,
    };
    const route = {
      id: 'id-1',
      user_id: 'user-1',
      slug: 'test-route-abc',
      title: payload.title,
      description: payload.description,
      route_geometry: payload.route_geometry,
      distance_meters: 1000,
      is_public: true,
      created_at: '',
      updated_at: '',
      tags: ['urban'],
    };
    vi.mocked(apiClient.post).mockResolvedValue({ data: { route } });

    const result = await createRoute(payload);

    expect(apiClient.post).toHaveBeenCalledWith('/v1/routes', payload);
    expect(result.route).toEqual(route);
  });
});
