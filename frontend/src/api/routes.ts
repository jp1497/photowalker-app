/** Route API calls. */
import { apiClient } from './client';
import type {
  BrowseParams,
  BrowseResponse,
  Route,
  RouteCreatePayload,
  RouteDetailResponse,
  RouteFromPhotosPayload,
} from '../types/route';

export async function createRoute(payload: RouteCreatePayload): Promise<{ route: Route }> {
  const { data } = await apiClient.post<{ route: Route }>('/v1/routes', payload);
  return data;
}

/** Create route from ordered photo IDs. PRD v3 - POST /v1/routes/from-photos. */
export async function createRouteFromPhotos(payload: RouteFromPhotosPayload): Promise<{ route: Route }> {
  const { data } = await apiClient.post<{ route: Route }>('/v1/routes/from-photos', payload);
  return data;
}

export async function getRouteBySlug(slug: string): Promise<RouteDetailResponse> {
  const { data } = await apiClient.get<RouteDetailResponse>(`/v1/routes/${encodeURIComponent(slug)}`);
  return data;
}

/** GET /v1/routes (browse public routes). No auth. */
export async function getBrowseRoutes(params: BrowseParams = {}): Promise<BrowseResponse> {
  const { data } = await apiClient.get<BrowseResponse>('/v1/routes', { params });
  return data;
}
