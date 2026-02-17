/** Unit tests for CreateRouteFromPhotos: submit order, validation. */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CreateRouteFromPhotos } from './CreateRouteFromPhotos';
import * as routesApi from '../api/routes';
import * as photosApi from '../api/photos';
import type { UploadPhotoResponse } from '../types/photo';

vi.mock('maplibre-gl', () => ({
  default: {
    Map: vi.fn(),
    Marker: vi.fn(function (this: unknown) {
      return { setLngLat: vi.fn().mockReturnThis(), addTo: vi.fn().mockReturnThis(), remove: vi.fn() };
    }),
    setWorkerUrl: vi.fn(),
  },
}));
vi.mock('../hooks/usePreferredMapCenter', () => ({
  usePreferredMapCenter: () => ({ center: [-122.4, 37.8] as [number, number] }),
}));
vi.mock('../components/map/MapView', () => ({ MapView: () => <div data-testid="map-view" /> }));
vi.mock('../components/map/MapPicker', () => ({ MapPicker: () => null }));
vi.mock('../api/routes');
vi.mock('../api/photos');

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const orig = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...orig,
    useNavigate: () => mockNavigate,
  };
});

describe('CreateRouteFromPhotos', () => {
  beforeEach(() => {
    vi.mocked(routesApi.createRouteFromPhotos).mockReset();
    vi.mocked(photosApi.uploadPhoto).mockReset();
    mockNavigate.mockClear();
  });

  it('renders title and upload section', () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<CreateRouteFromPhotos />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('create-route-from-photos-title')).toBeTruthy();
    expect(screen.getByTestId('create-route-from-photos-upload')).toBeTruthy();
  });

  it('submit sends photo_ids in correct order', async () => {
    const photo1 = {
      id: 'p1',
      user_id: 'u1',
      caption: null,
      location: { type: 'Point' as const, coordinates: [-122.4, 37.8] },
      s3_key_original: 'k1',
      s3_key_thumbnail: null,
      file_size_bytes: 1000,
      captured_at: null,
      created_at: '',
      updated_at: '',
    };
    const photo2 = {
      id: 'p2',
      user_id: 'u1',
      caption: null,
      location: { type: 'Point' as const, coordinates: [-122.41, 37.81] },
      s3_key_original: 'k2',
      s3_key_thumbnail: null,
      file_size_bytes: 1000,
      captured_at: null,
      created_at: '',
      updated_at: '',
    };
    vi.mocked(photosApi.uploadPhoto)
      .mockResolvedValueOnce({ photo: photo1 })
      .mockResolvedValueOnce({ photo: photo2 });
    vi.mocked(routesApi.createRouteFromPhotos).mockResolvedValue({
      route: {
        id: 'r1',
        user_id: 'u1',
        slug: 'my-route',
        title: 'My Route',
        description: null,
        route_geometry: { type: 'LineString', coordinates: [] },
        distance_meters: 100,
        is_public: false,
        created_at: '',
        updated_at: '',
        tags: [],
      },
    });

    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<CreateRouteFromPhotos />} />
        </Routes>
      </MemoryRouter>,
    );

    const fileInput = screen.getByTestId('create-route-from-photos-upload');
    const file1 = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    const file2 = new File(['y'], 'b.jpg', { type: 'image/jpeg' });
    await userEvent.upload(fileInput, [file1, file2]);

    await waitFor(() => {
      const list = screen.getByTestId('create-route-from-photos-list');
      expect(list.children.length).toBe(2);
    });

    await userEvent.type(screen.getByTestId('create-route-from-photos-title-input'), 'My Route');
    const submit = screen.getByTestId('create-route-from-photos-submit');
    await userEvent.click(submit);

    await waitFor(() => {
      expect(routesApi.createRouteFromPhotos).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'My Route',
          photo_ids: ['p1', 'p2'],
        }),
      );
    });
    expect(mockNavigate).toHaveBeenCalledWith('/routes/my-route', { replace: true });
  });

  it('validation: submit disabled when fewer than 2 photos', async () => {
    vi.mocked(photosApi.uploadPhoto).mockResolvedValue({
      photo: {
        id: 'p1',
        user_id: 'u1',
        caption: null,
        location: { type: 'Point', coordinates: [-122.4, 37.8] },
        s3_key_original: 'k1',
        s3_key_thumbnail: null,
        file_size_bytes: 1000,
        captured_at: null,
        created_at: '',
        updated_at: '',
      },
    });

    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<CreateRouteFromPhotos />} />
        </Routes>
      </MemoryRouter>,
    );

    const fileInput = screen.getByTestId('create-route-from-photos-upload');
    await userEvent.upload(fileInput, [new File(['x'], 'a.jpg', { type: 'image/jpeg' })]);

    await waitFor(() => {
      expect(screen.getByTestId('create-route-from-photos-submit')).toBeTruthy();
    });

    const submit = screen.getByTestId('create-route-from-photos-submit');
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    expect(routesApi.createRouteFromPhotos).not.toHaveBeenCalled();
  });

  it('validation: shows error when submitting with missing title', async () => {
    vi.mocked(photosApi.uploadPhoto)
      .mockResolvedValueOnce({
        photo: {
          id: 'p1',
          user_id: 'u1',
          caption: null,
          location: { type: 'Point', coordinates: [-122.4, 37.8] },
          s3_key_original: 'k1',
          s3_key_thumbnail: null,
          file_size_bytes: 1000,
          captured_at: null,
          created_at: '',
          updated_at: '',
        },
      } as UploadPhotoResponse)
      .mockResolvedValueOnce({
        photo: {
          id: 'p2',
          user_id: 'u1',
          caption: null,
          location: { type: 'Point', coordinates: [-122.41, 37.81] },
          s3_key_original: 'k2',
          s3_key_thumbnail: null,
          file_size_bytes: 1000,
          captured_at: null,
          created_at: '',
          updated_at: '',
        },
      } as UploadPhotoResponse);

    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<CreateRouteFromPhotos />} />
        </Routes>
      </MemoryRouter>,
    );

    const fileInput = screen.getByTestId('create-route-from-photos-upload');
    await userEvent.upload(fileInput, [
      new File(['x'], 'a.jpg', { type: 'image/jpeg' }),
      new File(['y'], 'b.jpg', { type: 'image/jpeg' }),
    ]);

    await waitFor(() => {
      expect(screen.getByTestId('create-route-from-photos-submit')).toBeTruthy();
    });

    const submit = screen.getByTestId('create-route-from-photos-submit');
    await userEvent.click(submit);

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert.textContent).toMatch(/title is required/i);
    });
    expect(routesApi.createRouteFromPhotos).not.toHaveBeenCalled();
  });
});
