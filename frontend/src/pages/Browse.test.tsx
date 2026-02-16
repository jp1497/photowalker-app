/** Unit tests for Browse: bbox fetch from map, list view pagination. */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Route } from '../types/route';
import { Browse } from './Browse';
import * as routesApi from '../api/routes';

vi.mock('../api/routes');
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

const mockRoutes: Route[] = [
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
});
