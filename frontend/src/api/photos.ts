/** Photo API calls. */
import { apiClient } from './client';
import type { Photo, PhotosBrowseResponse, RoutePhotosResponse, UploadPhotoResponse } from '../types/photo';

/** GeoJSON Point for PATCH location. */
export interface PhotoLocationUpdate {
  type: 'Point';
  coordinates: [number, number];
}

/** Body for PATCH /v1/photos/{id} */
export interface PhotoUpdateBody {
  location?: PhotoLocationUpdate;
  caption?: string | null;
  route_ids?: string[] | null;
}

const baseURL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? 'http://localhost:8000');

/** Build URL for photo image (thumbnail or original). Browser will request with same-origin credentials. */
export function getPhotoImageUrl(photoId: string, size: 'thumbnail' | 'original' = 'thumbnail'): string {
  return `${baseURL}/v1/photos/${encodeURIComponent(photoId)}/image?size=${size}`;
}

/** Upload photo (multipart). Returns created photo. */
export async function uploadPhoto(
  file: File,
  routeIds: string[],
  caption?: string | null
): Promise<UploadPhotoResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('route_ids', JSON.stringify(routeIds));
  if (caption != null && caption !== '') {
    formData.append('caption', caption);
  }
  const { data } = await apiClient.post<UploadPhotoResponse>('/v1/photos', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60_000,
  });
  return data;
}

/** Browse photos in viewport (bbox) for map pins and lightbox. PRD v6 Step 0.1. No auth required. */
export async function getPhotosInBbox(
  bbox: string,
  page = 1,
  per_page = 50
): Promise<PhotosBrowseResponse> {
  const { data } = await apiClient.get<PhotosBrowseResponse>('/v1/photos', {
    params: { bbox, page, per_page },
  });
  return data;
}

/** Browse current user's own photos in viewport (bbox). Auth required. */
export async function getMyPhotosInBbox(
  bbox: string,
  page = 1,
  per_page = 50
): Promise<PhotosBrowseResponse> {
  const { data } = await apiClient.get<PhotosBrowseResponse>('/v1/photos/my', {
    params: { bbox, page, per_page },
  });
  return data;
}

/** Get photos for a route. */
export async function getRoutePhotos(
  routeId: string,
  order: 'display_order' | 'captured_at' = 'display_order'
): Promise<RoutePhotosResponse> {
  const { data } = await apiClient.get<RoutePhotosResponse>(
    `/v1/routes/${encodeURIComponent(routeId)}/photos`,
    { params: { order } }
  );
  return data;
}

/** Fetch photo image as blob for use in img (sends auth). Use when you need to pass Authorization. */
export async function fetchPhotoImageBlob(photoId: string, size: 'thumbnail' | 'original' = 'thumbnail'): Promise<Blob> {
  const url = getPhotoImageUrl(photoId, size);
  const response = await apiClient.get(url, { responseType: 'blob' });
  return response.data as Blob;
}

/** Update photo (PATCH). Returns updated photo. API response shape is { photo: Photo }. */
export async function updatePhoto(photoId: string, body: PhotoUpdateBody): Promise<Photo> {
  const { data } = await apiClient.patch<{ photo: Photo }>(
    `/v1/photos/${encodeURIComponent(photoId)}`,
    body
  );
  return data.photo;
}

/** Update display_order of photos for a route. Owner only. */
export async function reorderRoutePhotos(routeId: string, photoIds: string[]): Promise<void> {
  await apiClient.put(`/v1/routes/${encodeURIComponent(routeId)}/photos/order`, { photo_ids: photoIds });
}
