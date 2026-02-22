/** Photo types. API response shapes. */

export interface Photo {
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

/** POST /v1/photos response */
export interface UploadPhotoResponse {
  photo: Photo;
}

/** GET /v1/routes/{route_id}/photos response */
export interface RoutePhotosResponse {
  photos: Photo[];
}

/** User summary in GET /v1/photos (photos-in-bbox). PRD v6. */
export interface PhotoBrowseUser {
  id: string;
  name: string;
}

/** Photo item from GET /v1/photos?bbox= for map pins and lightbox. PRD v6 Step 0.1. */
export interface PhotoBrowseItem {
  id: string;
  caption: string | null;
  user: PhotoBrowseUser;
  route_ids: string[];
  image_url: string;
  location: { type: 'Point'; coordinates: [number, number] } | null;
}

/** GET /v1/photos?bbox= response. */
export interface PhotosBrowseResponse {
  photos: PhotoBrowseItem[];
  pagination: { page: number; per_page: number; total: number };
}
