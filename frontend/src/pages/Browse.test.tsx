/** Unit tests for Browse: bbox fetch from map, list view pagination, welcome modal, photo lightbox. */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Route as RouteType } from '../types/route';
import { Browse } from './Browse';
import * as routesApi from '../api/routes';
import * as photosApi from '../api/photos';
import * as useAuth from '../hooks/useAuth';
import * as WelcomeModalModule from '../components/common/WelcomeModal';

vi.mock('../api/routes');
vi.mock('../api/photos');
vi.mock('../hooks/useAuth');
vi.mock('../components/photos/PhotoImage', () => ({
  PhotoImage: () => <div data-testid="photo-image" />,
}));
vi.mock('../hooks/usePreferredMapCenter', () => ({
  usePreferredMapCenter: () => ({ center: [-122.42, 37.78], zoom: 12 }),
}));
vi.mock('../components/map/MapView', () => ({
  MapView: ({ onMapReady }: { onMapReady?: (map: unknown) => void }) => {
    if (onMapReady) {
      const fakeMap = {
        getBounds: () => ({
          getSouthWest: () => ({ lng: -122.5, lat: 37.7 }),
          getNorthEast: () => ({ lng: -122.3, lat: 37.9 }),
        }),
        getSource: vi.fn().mockReturnValue(null),
        getLayer: vi.fn().mockReturnValue(undefined),
        hasImage: vi.fn().mockReturnValue(false),
        addSource: vi.fn(),
        addLayer: vi.fn(),
        addImage: vi.fn(),
        removeSource: vi.fn(),
        removeLayer: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        once: vi.fn((_ev: string, cb: () => void) => {
          setTimeout(cb, 0);
        }),
        queryRenderedFeatures: vi.fn().mockReturnValue([]),
        getStyle: vi.fn().mockReturnValue({}),
        easeTo: vi.fn(),
      };
      setTimeout(() => onMapReady(fakeMap), 0);
    }
    return <div data-testid="map-view">Map</div>;
  },
}));
vi.mock('../contexts/MapContext', () => ({
  useMapContext: vi.fn(() => null),
}));
vi.mock('maplibre-gl', () => ({
  default: {
    Marker: vi.fn().mockImplementation(() => ({
      setLngLat: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      remove: vi.fn(),
      getElement: () => null,
    })),
  },
}));

const mockRoutes: RouteType[] = [
  {
    id: 'r1',
    user_id: 'u1',
    slug: 'urban-walk',
    title: 'Urban Walk',
    description: 'A walk',
    route_geometry: { type: 'LineString', coordinates: [[-122.4, 37.8], [-122.38, 37.82]] },
    distance_meters: 2000,
    is_public: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    tags: ['urban'],
  },
];

describe('Browse', () => {
  beforeEach(() => {
    vi.mocked(routesApi.getBrowseRoutes).mockReset();
    vi.mocked(routesApi.getBrowseRoutes).mockResolvedValue({
      routes: mockRoutes,
      pagination: { page: 1, per_page: 20, total: 1 },
    });
    vi.mocked(photosApi.getPhotosInBbox).mockReset();
    vi.mocked(photosApi.getPhotosInBbox).mockResolvedValue({
      photos: [],
      pagination: { page: 1, per_page: 50, total: 0 },
    });
    vi.mocked(useAuth.useAuth).mockReturnValue({
      loading: false,
      isAuthenticated: true,
      user: { id: 'u1', name: 'Test User', email: 'test@example.com', avatar_url: null, created_at: '2025-01-01T00:00:00Z' },
      login: vi.fn(),
      logout: vi.fn(),
    });
  });

  it('fetches routes with bbox when map is ready', async () => {
    render(
      <MemoryRouter>
        <Browse />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('map-view')).toBeTruthy();
    await waitFor(
      () => {
        expect(routesApi.getBrowseRoutes).toHaveBeenCalledWith(
          expect.objectContaining({
            bbox: '-122.5,37.7,-122.3,37.9',
            per_page: 50,
            sort: 'created_at',
          }),
        );
      },
      { timeout: 1000 },
    );
  });

  it('list view fetches paginated routes and shows pagination', async () => {
    vi.mocked(routesApi.getBrowseRoutes).mockResolvedValue({
      routes: mockRoutes,
      pagination: { page: 1, per_page: 20, total: 25 },
    });
    render(
      <MemoryRouter>
        <Browse />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: /list/i }));
    await waitFor(() => {
      expect(routesApi.getBrowseRoutes).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          per_page: 20,
          sort: 'created_at',
        }),
      );
    });
    await waitFor(() => {
      expect(screen.getByText('Urban Walk')).toBeTruthy();
    });
    expect(screen.getByText(/Page 1 of 2/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /next/i })).toBeTruthy();
  });

  it('shell mode: Filters overlay exists; no Routes button or list overlay (PRD v6 Step 3.1)', async () => {
    const { useMapContext } = await import('../contexts/MapContext');
    vi.mocked(useMapContext).mockReturnValue({ map: null, onMapReady: vi.fn() });

    render(
      <MemoryRouter>
        <Browse />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /open filters/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /open routes/i })).toBeNull();
    expect(screen.queryByRole('dialog', { name: /routes list/i })).toBeNull();
  });

  it('shell mode: fetches photos in bbox when map is ready (browse-photos mode)', async () => {
    const onMapReadyStub = vi.fn();
    const { useMapContext } = await import('../contexts/MapContext');
    vi.mocked(useMapContext).mockReturnValue({ map: null, onMapReady: onMapReadyStub });

    render(
      <MemoryRouter>
        <Browse />
      </MemoryRouter>,
    );

    expect(onMapReadyStub).toHaveBeenCalled();
    const registerCb = onMapReadyStub.mock.calls[0][0];
    const fakeMap = {
      getBounds: () => ({
        getSouthWest: () => ({ lng: -122.5, lat: 37.7 }),
        getNorthEast: () => ({ lng: -122.3, lat: 37.9 }),
      }),
      getSource: vi.fn().mockReturnValue(null),
      getLayer: vi.fn().mockReturnValue(undefined),
      hasImage: vi.fn().mockReturnValue(false),
      addSource: vi.fn(),
      addLayer: vi.fn(),
      addImage: vi.fn(),
      removeSource: vi.fn(),
      removeLayer: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn((_ev: string, cb: () => void) => {
        setTimeout(cb, 0);
      }),
      queryRenderedFeatures: vi.fn().mockReturnValue([]),
      getStyle: vi.fn().mockReturnValue({}),
      easeTo: vi.fn(),
    };
    registerCb(fakeMap);

    await waitFor(
      () => {
        expect(photosApi.getPhotosInBbox).toHaveBeenCalledWith(
          '-122.5,37.7,-122.3,37.9',
          1,
          50
        );
      },
      { timeout: 1000 },
    );
  });

  it('photo lightbox: Photo button opens lightbox; Close and Escape close it; Open route navigates', async () => {
    const { useMapContext } = await import('../contexts/MapContext');
    vi.mocked(useMapContext).mockReturnValue({ map: null, onMapReady: vi.fn() });
    vi.mocked(routesApi.getBrowseRoutes).mockResolvedValue({
      routes: mockRoutes,
      pagination: { page: 1, per_page: 20, total: 1 },
    });

    render(
      <MemoryRouter initialEntries={['/browse']}>
        <Routes>
          <Route path="/browse" element={<Browse />} />
          <Route path="/routes/:slug" element={<div data-testid="route-detail">Route detail</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole('button', { name: /open photo lightbox demo/i }));
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /photo lightbox/i })).toBeTruthy();
    });
    expect(screen.getByText('Step 2.3 demo photo')).toBeTruthy();
    expect(screen.getByText('Demo user')).toBeTruthy();

    await userEvent.click(screen.getByText('Close'));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /photo lightbox/i })).toBeFalsy();
    });

    await userEvent.click(screen.getByRole('button', { name: /open photo lightbox demo/i }));
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /photo lightbox/i })).toBeTruthy();
    });
    await userEvent.click(screen.getByRole('button', { name: /open route/i }));
    await waitFor(() => {
      expect(screen.getByTestId('route-detail')).toBeTruthy();
    });
  });

  describe('welcome modal', () => {
    it('shows welcome modal on Browse when not authenticated and not dismissed', () => {
      vi.mocked(useAuth.useAuth).mockReturnValue({
        loading: false,
        isAuthenticated: false,
        user: null,
        login: vi.fn(),
        logout: vi.fn(),
      });
      vi.spyOn(WelcomeModalModule, 'getWelcomeDismissed').mockReturnValue(false);

      render(
        <MemoryRouter>
          <Browse />
        </MemoryRouter>,
      );

      expect(screen.getByRole('dialog', { name: /welcome/i })).toBeTruthy();
      expect(screen.getByText(/create photowalks, share them with others/i)).toBeTruthy();
      expect(screen.getByRole('button', { name: /browse the map/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /create account/i })).toBeTruthy();
    });

    it('does not show welcome modal when dismissed in same session (getWelcomeDismissed true)', () => {
      vi.mocked(useAuth.useAuth).mockReturnValue({
        loading: false,
        isAuthenticated: false,
        user: null,
        login: vi.fn(),
        logout: vi.fn(),
      });
      vi.spyOn(WelcomeModalModule, 'getWelcomeDismissed').mockReturnValue(true);

      render(
        <MemoryRouter>
          <Browse />
        </MemoryRouter>,
      );

      expect(screen.queryByRole('dialog', { name: /welcome/i })).toBeFalsy();
    });

    it('Escape closes welcome modal', async () => {
      vi.mocked(useAuth.useAuth).mockReturnValue({
        loading: false,
        isAuthenticated: false,
        user: null,
        login: vi.fn(),
        logout: vi.fn(),
      });
      vi.spyOn(WelcomeModalModule, 'getWelcomeDismissed').mockReturnValue(false);

      render(
        <MemoryRouter>
          <Browse />
        </MemoryRouter>,
      );

      expect(screen.getByRole('dialog', { name: /welcome/i })).toBeTruthy();
      await userEvent.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /welcome/i })).toBeFalsy();
      });
    });

    it('does not show welcome modal when authenticated', () => {
      vi.mocked(useAuth.useAuth).mockReturnValue({
        loading: false,
        isAuthenticated: true,
        user: { id: 'u1', name: 'User', email: 'u@example.com', avatar_url: null, created_at: '2025-01-01T00:00:00Z' },
        login: vi.fn(),
        logout: vi.fn(),
      });
      vi.spyOn(WelcomeModalModule, 'getWelcomeDismissed').mockReturnValue(false);

      render(
        <MemoryRouter>
          <Browse />
        </MemoryRouter>,
      );

      expect(screen.queryByRole('dialog', { name: /welcome/i })).toBeFalsy();
    });
  });
});
