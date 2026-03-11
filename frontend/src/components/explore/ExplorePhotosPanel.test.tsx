/** Unit tests for ExplorePhotosPanel: photo list, upload button, close. */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExplorePhotosPanel } from './ExplorePhotosPanel';
import * as photosApi from '../../api/photos';
import { useAuth } from '../../hooks/useAuth';
import { useMapContext } from '../../contexts/MapContext';

vi.mock('../../api/photos');
vi.mock('../../hooks/useAuth');
vi.mock('../../contexts/MapContext');

describe('ExplorePhotosPanel', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'u1', email: 'a@b.co', name: 'User', avatar_url: null, created_at: '' },
      isAuthenticated: true,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(useMapContext).mockReturnValue({
      map: {
        getBounds: () => ({ getWest: () => -122.5, getSouth: () => 37.5, getEast: () => -122.0, getNorth: () => 38.0 }),
        on: vi.fn(),
        off: vi.fn(),
      } as any,
      onMapReady: vi.fn(),
    });
    vi.mocked(photosApi.getMyPhotosInBbox).mockResolvedValue({
      photos: [],
      pagination: { page: 1, per_page: 20, total: 0 },
    });
    vi.mocked(photosApi.fetchPhotoImageBlob).mockResolvedValue(new Blob());
  });

  it('does not render when open is false', () => {
    render(<ExplorePhotosPanel open={false} onClose={() => {}} onUpload={() => {}} />);
    expect(screen.queryByRole('complementary')).toBeFalsy();
  });

  it('renders panel with header, empty state, and Upload photos button when open', async () => {
    render(<ExplorePhotosPanel open onClose={() => {}} onUpload={() => {}} />);
    await waitFor(() => {
      expect(screen.getByRole('complementary', { name: /photos/i })).toBeTruthy();
    });
    expect(screen.getByText('Photos')).toBeTruthy();
    expect(screen.getByRole('button', { name: /upload photos/i })).toBeTruthy();
    expect(screen.getByText(/no photos/i)).toBeTruthy();
  });

  it('calls getMyPhotosInBbox on open', async () => {
    render(<ExplorePhotosPanel open onClose={() => {}} onUpload={() => {}} />);
    await waitFor(() => {
      expect(vi.mocked(photosApi.getMyPhotosInBbox)).toHaveBeenCalled();
    });
  });

  it('renders a photo list item for each photo returned', async () => {
    vi.mocked(photosApi.getMyPhotosInBbox).mockResolvedValue({
      photos: [
        {
          id: 'p1', caption: 'Sunset', user: { id: 'u1', name: 'User' },
          route_ids: [], image_url: '/v1/photos/p1/image',
          location: { type: 'Point', coordinates: [-122, 37] },
        },
      ],
      pagination: { page: 1, per_page: 20, total: 1 },
    });
    render(<ExplorePhotosPanel open onClose={() => {}} onUpload={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Sunset')).toBeTruthy();
    });
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    render(<ExplorePhotosPanel open onClose={onClose} onUpload={() => {}} />);
    await waitFor(() => screen.getByRole('complementary', { name: /photos/i }));
    await userEvent.click(screen.getByRole('button', { name: /^close$/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onUpload when Upload photos button is clicked', async () => {
    const onUpload = vi.fn();
    render(<ExplorePhotosPanel open onClose={() => {}} onUpload={onUpload} />);
    await waitFor(() => screen.getByRole('button', { name: /upload photos/i }));
    await userEvent.click(screen.getByRole('button', { name: /upload photos/i }));
    expect(onUpload).toHaveBeenCalled();
  });
});
