/** Unit tests for MapPicker: calls onSelect with [lon, lat] when map clicked. */
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MapPicker } from './MapPicker';

type ClickHandler = (e: { lngLat: { lng: number; lat: number } }) => void;
let clickHandler: ClickHandler | null = null;

vi.mock('maplibre-gl', () => {
  const MockMarker = vi.fn().mockImplementation(() => ({
    setLngLat: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
  }));
  return { default: { Marker: MockMarker } };
});

vi.mock('./MapView', () => ({
  MapView: ({ onMapReady }: { onMapReady?: (map: unknown) => void }) => {
    useEffect(() => {
      if (!onMapReady) return;
      const fakeMap = {
        getContainer: () => ({ style: { cursor: '' } }),
        on: (event: string, handler: ClickHandler) => {
          if (event === 'click') clickHandler = handler;
        },
      };
      onMapReady(fakeMap);
    }, [onMapReady]);
    return <div data-testid="map-view">Map</div>;
  },
}));

describe('MapPicker', () => {
  it('renders map and hint text', () => {
    render(<MapPicker onSelect={vi.fn()} />);
    expect(screen.getByTestId('map-picker')).toBeTruthy();
    expect(screen.getByText(/click the map to set location/i)).toBeTruthy();
  });

  it('calls onSelect with [lon, lat] when map is clicked', async () => {
    const onSelect = vi.fn();
    render(<MapPicker onSelect={onSelect} />);
    await waitFor(() => {
      expect(clickHandler).toBeTruthy();
    });
    clickHandler!({ lngLat: { lng: -122.42, lat: 37.78 } });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith([-122.42, 37.78]);
  });
});
