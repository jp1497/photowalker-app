/** Route API calls. */
import { apiClient } from './client';
import type { Route, RouteCreatePayload, RouteDetailResponse } from '../types/route';

export async function createRoute(payload: RouteCreatePayload): Promise<{ route: Route }> {
  const { data } = await apiClient.post<{ route: Route }>('/v1/routes', payload);
  return data;
}

export async function getRouteBySlug(slug: string): Promise<RouteDetailResponse> {
  const { data } = await apiClient.get<RouteDetailResponse>(`/v1/routes/${encodeURIComponent(slug)}`);
  return data;
}
