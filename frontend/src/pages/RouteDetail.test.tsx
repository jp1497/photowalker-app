/** Unit tests for RouteDetail: 404 and error handling. */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RouteDetail } from './RouteDetail';
import * as routesApi from '../api/routes';

vi.mock('../components/routes/RouteView', () => ({ RouteView: ({ route }: { route: { title: string } }) => <div data-testid="route-view">{route.title}</div> }));
vi.mock('../components/map/MapPicker', () => ({ MapPicker: () => null }));
vi.mock('../api/routes');

describe('RouteDetail', () => {
  beforeEach(() => {
    vi.mocked(routesApi.getRouteBySlug).mockReset();
  });

  it('handles 404', async () => {
    vi.mocked(routesApi.getRouteBySlug).mockRejectedValue({ response: { status: 404 } });

    render(
      <MemoryRouter initialEntries={['/routes/not-found-slug']}>
        <Routes>
          <Route path="/routes/:slug" element={<RouteDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /route not found/i })).toBeTruthy();
    });
    expect(screen.getByRole('link', { name: /home/i })).toBeTruthy();
  });

  it('handles 403 for private route', async () => {
    vi.mocked(routesApi.getRouteBySlug).mockRejectedValue({
      response: { status: 403, data: { error: { message: 'Route is private' } } },
    });

    render(
      <MemoryRouter initialEntries={['/routes/private-route']}>
        <Routes>
          <Route path="/routes/:slug" element={<RouteDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /private route/i })).toBeTruthy();
    });
    expect(screen.getByRole('link', { name: /home/i })).toBeTruthy();
  });

  it('shows loading then route when fetch succeeds', async () => {
    const mockData = {
      route: {
        id: 'r1',
        user_id: 'u1',
        slug: 'my-route',
        title: 'My Route',
        description: 'Desc',
        route_geometry: { type: 'LineString' as const, coordinates: [[0, 0], [1, 1]] },
        distance_meters: 1000,
        is_public: true,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        tags: [],
      },
      photos: [],
    };
    vi.mocked(routesApi.getRouteBySlug).mockResolvedValue(mockData);

    render(
      <MemoryRouter initialEntries={['/routes/my-route']}>
        <Routes>
          <Route path="/routes/:slug" element={<RouteDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/loading route/i)).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByTestId('route-view').textContent).toBe('My Route');
    });
    expect(screen.getByText(/no photos yet/i)).toBeTruthy();
  });
});
