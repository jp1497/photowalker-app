/** MapLibre GL map wrapper. */
import { useEffect, useRef, type CSSProperties } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getCustomizedStyle, getMapStyleUrl } from '../../map/mapStyles';

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
  const initialCenterRef = useRef(center);
  const initialZoomRef = useRef(zoom);
  const onMapReadyRef = useRef(onMapReady);
  useEffect(() => {
    onMapReadyRef.current = onMapReady;
  }, [onMapReady]);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    async function initMap() {
      if (!containerRef.current || cancelled) return;

      let mapStyle: maplibregl.StyleSpecification | string;
      try {
        mapStyle = await getCustomizedStyle();
      } catch (err) {
        console.warn('Failed to load customized style, falling back to default:', err);
        mapStyle = getMapStyleUrl();
      }

      if (cancelled || !containerRef.current) return;

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
    }

    initMap();

    return () => {
      cancelled = true;
      try {
        mapRef.current?.remove();
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
