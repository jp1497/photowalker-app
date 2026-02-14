/** Route TypeScript types. API request/response shapes. */

/** GeoJSON LineString: [lon, lat][] */
export type LineStringCoords = [number, number][];

export interface RouteGeometry {
  type: 'LineString';
  coordinates: LineStringCoords;
}

/** Payload for POST /v1/routes */
export interface RouteCreatePayload {
  title: string;
  description?: string | null;
  route_geometry: RouteGeometry;
  slug?: string | null;
  tags: string[];
  is_public: boolean;
}

/** Route from API (route detail and list). first_photo_id set on browse response only. */
export interface Route {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  description: string | null;
  route_geometry: RouteGeometry;
  distance_meters: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  tags: string[];
  /** First photo id (display order) for list/map thumbnails. Present from browse API. */
  first_photo_id?: string | null;
}

/** Photo as returned in route detail (same shape as Photo). */
export interface RouteDetailPhoto {
  id: string;
  user_id: string;
  caption: string | null;
  location: { type: string; coordinates: number[] } | null;
  s3_key_original: string;
  s3_key_thumbnail: string | null;
  file_size_bytes: number;
  captured_at: string | null;
  created_at: string;
  updated_at: string;
}

/** GET /v1/routes/{slug} response */
export interface RouteDetailResponse {
  route: Route;
  photos: RouteDetailPhoto[];
}

/** GET /v1/routes (browse) query params */
export interface BrowseParams {
  bbox?: string;
  tags?: string;
  author_id?: string;
  page?: number;
  per_page?: number;
  sort?: 'created_at' | 'distance';
}

/** GET /v1/routes (browse) response */
export interface BrowseResponse {
  routes: Route[];
  pagination: { page: number; per_page: number; total: number };
}
