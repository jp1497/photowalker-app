/** Map that reports [lon, lat] when user clicks. Used for picking photo location. */
import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { MapView } from './MapView';
import type { CSSProperties } from 'react';

const DEFAULT_CENTER: [number, number] = [-122.42, 37.78];
const DEFAULT_ZOOM = 12;

export interface MapPickerProps {
  /** Initial map center when no selection yet. */
  initialCenter?: [number, number];
  /** Called with [longitude, latitude] when user clicks the map. */
  onSelect: (coords: [number, number]) => void;
  style?: CSSProperties;
}

export function MapPicker({ initialCenter = DEFAULT_CENTER, onSelect, style }: MapPickerProps) {
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const handleMapReady = (map: maplibregl.Map) => {
    map.getContainer().style.cursor = 'crosshair';

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      const { lng, lat } = e.lngLat;
      const coords: [number, number] = [lng, lat];

      if (markerRef.current) {
        markerRef.current.setLngLat(coords);
      } else {
        const el = document.createElement('div');
        el.style.width = '16px';
        el.style.height = '16px';
        el.style.borderRadius = '50%';
        el.style.background = '#2563eb';
        el.style.border = '2px solid #fff';
        el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';
        const marker = new maplibregl.Marker({ element: el }).setLngLat(coords).addTo(map);
        markerRef.current = marker;
      }

      onSelectRef.current(coords);
    };

    map.on('click', handleClick);
  };

  useEffect(() => {
    return () => {
      if (markerRef.current) {
        try {
          markerRef.current.remove();
        } catch {
          /* defensive teardown */
        }
        markerRef.current = null;
      }
    };
  }, []);

  return (
    <div data-testid="map-picker" style={{ width: '100%', height: '100%', position: 'relative', ...style }}>
      <MapView
        center={initialCenter}
        zoom={DEFAULT_ZOOM}
        style={{ width: '100%', height: '100%' }}
        onMapReady={handleMapReady}
      />
      <p
        style={{
          position: 'absolute',
          bottom: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          margin: 0,
          padding: '4px 8px',
          background: 'rgba(255,255,255,0.9)',
          borderRadius: 4,
          fontSize: '0.75rem',
          color: '#374151',
          pointerEvents: 'none',
        }}
      >
        Click the map to set location
      </p>
    </div>
  );
}
