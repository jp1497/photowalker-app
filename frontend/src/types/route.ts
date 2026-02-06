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

/** Route from API (route detail and list) */
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
}

/** Photo as returned in route detail (same shape as Photo). */
export interface RouteDetailPhoto {
  id: string;
  user_id: string;
  caption: string | null;
  location: { type: string; coordinates: number[] };
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
