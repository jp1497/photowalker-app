/** Route API calls. */
import { apiClient } from './client';
import type { Route, RouteCreatePayload, RouteDetailResponse } from '../types/route';

/** Response from GET /v1/routes/me */
export interface MyRoutesResponse {
  routes: Route[];
}

export async function getMyRoutes(): Promise<MyRoutesResponse> {
  const { data } = await apiClient.get<MyRoutesResponse>('/v1/routes/me');
  return data;
}

export async function createRoute(payload: RouteCreatePayload): Promise<{ route: Route }> {
  const { data } = await apiClient.post<{ route: Route }>('/v1/routes', payload);
  return data;
}

export async function getRouteBySlug(slug: string): Promise<RouteDetailResponse> {
  const { data } = await apiClient.get<RouteDetailResponse>(`/v1/routes/${encodeURIComponent(slug)}`);
  return data;
}
