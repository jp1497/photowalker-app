/** Unit tests for photos API. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './client';
import { uploadPhoto, getPhotoImageUrl, getRoutePhotos } from './photos';

vi.mock('./client', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

describe('photos API', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('uploadPhoto sends multipart with file, caption, route_ids', async () => {
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    const routeIds = ['route-1', 'route-2'];
    const caption = 'My caption';
    const response = { photo: { id: 'p1', caption, user_id: 'u1', location: {}, s3_key_original: '', s3_key_thumbnail: null, file_size_bytes: 1, captured_at: null, created_at: '', updated_at: '' } };
    vi.mocked(apiClient.post).mockResolvedValue({ data: response });

    const result = await uploadPhoto(file, routeIds, caption);

    expect(result.photo.id).toBe('p1');
    expect(apiClient.post).toHaveBeenCalledWith(
      '/v1/photos',
      expect.any(FormData),
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60_000 }
    );
    const formData = vi.mocked(apiClient.post).mock.calls[0][1] as FormData;
    expect(formData.get('file')).toBe(file);
    expect(formData.get('route_ids')).toBe(JSON.stringify(routeIds));
    expect(formData.get('caption')).toBe(caption);
  });

  it('uploadPhoto omits caption when null', async () => {
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { photo: { id: 'p1', caption: null, user_id: 'u1', location: {}, s3_key_original: '', s3_key_thumbnail: null, file_size_bytes: 1, captured_at: null, created_at: '', updated_at: '' } },
    });

    await uploadPhoto(file, ['r1'], null);

    const formData = vi.mocked(apiClient.post).mock.calls[0][1] as FormData;
    expect(formData.has('caption')).toBe(false);
  });

  it('getPhotoImageUrl returns thumbnail URL by default', () => {
    expect(getPhotoImageUrl('pid-1')).toContain('/v1/photos/pid-1/image?size=thumbnail');
  });

  it('getRoutePhotos calls GET with order param', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { photos: [] } });

    await getRoutePhotos('route-id', 'captured_at');

    expect(apiClient.get).toHaveBeenCalledWith(
      '/v1/routes/route-id/photos',
      { params: { order: 'captured_at' } }
    );
  });
});
