/** Full-viewport map shell: single MapView, owns lifecycle. Children use MapContext for layers. */
import { useCallback, useRef, useState, type ReactNode } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { MapView } from './MapView';
import { MapContextProvider } from '../../contexts/MapContext';
import { usePreferredMapCenter } from '../../hooks/usePreferredMapCenter';

export type MapShellMode = 'browse' | 'detail' | 'create' | 'home';

export interface MapShellProps {
  /** Current mode for future layer switching. */
  mode?: MapShellMode;
  /** Route slug when viewing a route (detail mode). */
  slug?: string | null;
  /** Route content and overlays. */
  children?: ReactNode;
}

export function MapShell({ children }: MapShellProps) {
  const { center, zoom, loading } = usePreferredMapCenter();
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const pendingCallbacksRef = useRef<Set<(m: MapLibreMap) => void>>(new Set());

  const handleMapReady = useCallback((m: MapLibreMap) => {
    setMap(m);
    pendingCallbacksRef.current.forEach((cb) => {
      try {
        cb(m);
      } catch {
        /* ignore */
      }
    });
    pendingCallbacksRef.current.clear();
  }, []);

  const onMapReady = useCallback(
    (cb: (map: MapLibreMap) => void) => {
      if (map) {
        try {
          cb(map);
        } catch {
          /* ignore */
        }
        return;
      }
      pendingCallbacksRef.current.add(cb);
    },
    [map]
  );

  const contextValue = { map, onMapReady };

  return (
    <MapContextProvider value={contextValue}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          width: '100vw',
          height: '100vh',
          minHeight: 0,
        }}
        data-testid="map-shell"
      >
        {!loading && (
          <MapView
            center={center}
            zoom={zoom}
            onMapReady={handleMapReady}
            style={{ width: '100%', height: '100%' }}
          />
        )}
        {children}
      </div>
    </MapContextProvider>
  );
}
