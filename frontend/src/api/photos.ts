/** Photo API calls. */
import { apiClient } from './client';
import type { Photo, RoutePhotosResponse, UploadPhotoResponse } from '../types/photo';

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
