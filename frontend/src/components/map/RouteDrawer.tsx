/** Mapbox GL Draw integration for polyline. */
import { useEffect, useRef } from 'react';
import maplibregl, { type Map } from 'maplibre-gl';
import type { Feature, FeatureCollection } from 'geojson';
import type { LineStringCoords } from '../../types/route';

import 'maplibre-gl-draw/dist/mapbox-gl-draw.css';

type DrawControl = {
  getAll: () => FeatureCollection;
  onAdd: (map: Map) => HTMLElement;
  onRemove: (map: Map) => void;
};

export interface RouteDrawerProps {
  map: Map | null;
  onLineChange: (coordinates: LineStringCoords | null) => void;
}

export function RouteDrawer({ map, onLineChange }: RouteDrawerProps) {
  const drawRef = useRef<DrawControl | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    void import('maplibre-gl-draw').then((m) => {
      const DrawCtor = m.default;
      if (cancelled) return;
      const draw = new DrawCtor({ defaultMode: 'draw_line_string' }) as unknown as DrawControl;
      map.addControl(draw as unknown as maplibregl.IControl, 'top-left');
      drawRef.current = draw;

      const onDrawChange = () => {
        const data: FeatureCollection = draw.getAll();
        const features = data?.features ?? [];
        const line = features.find((f: Feature) => f.geometry?.type === 'LineString');
        if (line && line.geometry.type === 'LineString') {
          onLineChange(line.geometry.coordinates as LineStringCoords);
        } else {
          onLineChange(null);
        }
      };

      map.on('draw.create', onDrawChange);
      map.on('draw.update', onDrawChange);
      map.on('draw.delete', onDrawChange);

      const cleanup = () => {
        try {
          map.off('draw.create', onDrawChange);
          map.off('draw.update', onDrawChange);
          map.off('draw.delete', onDrawChange);
          map.removeControl(draw as unknown as maplibregl.IControl);
        } catch {
          // Map may already be destroyed (e.g. MapView unmounted first); ignore.
        }
        drawRef.current = null;
        cleanupRef.current = null;
      };
      cleanupRef.current = cleanup;
    });

    return () => {
      cancelled = true;
      cleanupRef.current?.();
    };
  }, [map, onLineChange]);

  return null;
}
