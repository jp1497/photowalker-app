/** Unit tests for RouteView: renders route metadata. */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RouteView } from './RouteView';

vi.mock('maplibre-gl', () => ({ default: {} }));
vi.mock('../map/MapView', () => ({ MapView: () => <div data-testid="map-view" /> }));

const mockRoute = {
  id: 'route-1',
  user_id: 'user-1',
  slug: 'test-route',
  title: 'Test Route',
  description: 'A test description',
  route_geometry: {
    type: 'LineString' as const,
    coordinates: [
      [-122.4, 37.78],
      [-122.41, 37.79],
    ],
  },
  distance_meters: 1500,
  is_public: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  tags: ['urban', 'sunset'],
};

describe('RouteView', () => {
  it('renders route metadata', () => {
    render(<RouteView route={mockRoute} photos={[]} />);
    expect(screen.getByRole('heading', { name: 'Test Route' })).toBeTruthy();
    expect(screen.getByText('A test description')).toBeTruthy();
    expect(screen.getByText('1.50 km')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('urban, sunset')).toBeTruthy();
  });

  it('renders map', () => {
    render(<RouteView route={mockRoute} photos={[]} />);
    expect(screen.getByTestId('map-view')).toBeTruthy();
  });

  it('renders without description when null', () => {
    const routeNoDesc = { ...mockRoute, description: null };
    render(<RouteView route={routeNoDesc} photos={[]} />);
    expect(screen.queryByText('A test description')).toBeFalsy();
  });

  it('renders without tags section when tags empty', () => {
    const routeNoTags = { ...mockRoute, tags: [] };
    render(<RouteView route={routeNoTags} photos={[]} />);
    expect(screen.getByRole('heading', { name: 'Test Route' })).toBeTruthy();
    expect(screen.getByText('1.50 km')).toBeTruthy();
  });
});
