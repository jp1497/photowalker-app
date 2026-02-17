/** Unit tests for routes API. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './client';
import { createRoute, createRouteFromPhotos, getBrowseRoutes } from './routes';
import type { Route, RouteCreatePayload, RouteFromPhotosPayload } from '../types/route';

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

  it('createRouteFromPhotos sends POST /v1/routes/from-photos with photo_ids in order', async () => {
    const payload: RouteFromPhotosPayload = {
      title: 'From Photos',
      description: null,
      tags: [],
      is_public: false,
      photo_ids: ['photo-a', 'photo-b', 'photo-c'],
    };
    const route: Route = {
      id: 'route-1',
      user_id: 'user-1',
      slug: 'from-photos-xyz',
      title: payload.title,
      description: payload.description ?? null,
      route_geometry: { type: 'LineString', coordinates: [] },
      distance_meters: 500,
      is_public: false,
      created_at: '',
      updated_at: '',
      tags: [],
    };
    vi.mocked(apiClient.post).mockResolvedValue({ data: { route } });

    const result = await createRouteFromPhotos(payload);

    expect(apiClient.post).toHaveBeenCalledWith('/v1/routes/from-photos', payload);
    expect((result.route as Route & { photo_ids?: unknown }).photo_ids).toBeUndefined();
    expect(result.route.slug).toBe('from-photos-xyz');
  });

  it('getBrowseRoutes sends GET /v1/routes with params', async () => {
    const routes: Route[] = [];
    const pagination = { page: 1, per_page: 20, total: 0 };
    vi.mocked(apiClient.get).mockResolvedValue({ data: { routes, pagination } });

    await getBrowseRoutes({ bbox: '-122.5,37.7,-122.3,37.9', page: 1, per_page: 20 });

    expect(apiClient.get).toHaveBeenCalledWith('/v1/routes', {
      params: { bbox: '-122.5,37.7,-122.3,37.9', page: 1, per_page: 20 },
    });
    const result = await getBrowseRoutes({ tags: 'urban', sort: 'created_at' });
    expect(result.routes).toEqual(routes);
    expect(result.pagination).toEqual(pagination);
  });
});
