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
