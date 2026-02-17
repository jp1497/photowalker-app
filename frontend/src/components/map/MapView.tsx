/** MapLibre GL map wrapper. */
import { useEffect, useRef, type CSSProperties } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getProtomapsStyle } from '../../map/protomapsStyle';

const DEFAULT_CENTER: [number, number] = [-122.42, 37.78];
const DEFAULT_ZOOM = 12;

/** Fallback when VITE_PROTOMAPS_API_KEY is not set; map still loads, vector tiles do not. */
const FALLBACK_STYLE: maplibregl.StyleSpecification = {
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
};

export interface MapViewProps {
  center?: [number, number];
  zoom?: number;
  style?: CSSProperties;
  onMapReady?: (map: maplibregl.Map) => void;
}

export function MapView({ center = DEFAULT_CENTER, zoom = DEFAULT_ZOOM, style, onMapReady }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const initialCenterRef = useRef(center);
  const initialZoomRef = useRef(zoom);
  const onMapReadyRef = useRef(onMapReady);
  useEffect(() => {
    onMapReadyRef.current = onMapReady;
  }, [onMapReady]);

  useEffect(() => {
    if (!containerRef.current) return;
    let mapStyle: maplibregl.StyleSpecification;
    try {
      mapStyle = getProtomapsStyle();
    } catch {
      console.warn(
        'Map: Protomaps API key not set. Using fallback raster basemap. Set VITE_PROTOMAPS_API_KEY in .env.local (https://protomaps.com/account, free for non-commercial use).'
      );
      mapStyle = FALLBACK_STYLE;
    }
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle,
      center: initialCenterRef.current,
      zoom: initialZoomRef.current,
    });
    mapRef.current = map;
    map.on('load', () => {
      onMapReadyRef.current?.(map);
    });
    return () => {
      try {
        map.remove();
      } catch {
        /* defensive teardown */
      }
      mapRef.current = null;
    };
  }, []);

  const centerLng = center[0];
  const centerLat = center[1];
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getCenter) return;
    map.jumpTo({ center: [centerLng, centerLat], zoom });
  }, [centerLng, centerLat, zoom]);

  return <div ref={containerRef} className="map-container" style={{ width: '100%', height: '100%', ...style }} />;
}
