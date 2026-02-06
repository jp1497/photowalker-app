/** MapLibre GL map wrapper. */
import { useEffect, useRef, type CSSProperties } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const DEFAULT_CENTER: [number, number] = [-122.42, 37.78];
const DEFAULT_ZOOM = 12;

export interface MapViewProps {
  center?: [number, number];
  zoom?: number;
  style?: CSSProperties;
  onMapReady?: (map: maplibregl.Map) => void;
}

export function MapView({ center = DEFAULT_CENTER, zoom = DEFAULT_ZOOM, style, onMapReady }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'osm-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center,
      zoom,
    });
    mapRef.current = map;
    map.on('load', () => {
      onMapReady?.(map);
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- map created once; center/zoom are initial only
  }, []);

  return <div ref={containerRef} className="map-container" style={{ width: '100%', height: '100%', ...style }} />;
}
