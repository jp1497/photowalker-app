/** Route detail view: map with route polyline and photo pins, metadata. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { fetchPhotoImageBlob } from '../../api/photos';
import { useMapContext } from '../../contexts/MapContext';
import { MapPanel } from '../map/MapPanel';
import { MapView } from '../map/MapView';
import { createPhotoCalloutElement, setCalloutThumbnail } from '../map/PhotoMarker';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { Route } from '../../types/route';

export interface RoutePhoto {
  id: string;
  caption: string | null;
  location: { type: string; coordinates: number[] } | null;
  s3_key_original: string;
  s3_key_thumbnail: string | null;
  captured_at: string | null;
  created_at: string;
}

export interface RouteViewProps {
  route: Route;
  photos: RoutePhoto[];
  /** Highlight this photo pin on the map. */
  selectedPhotoId?: string | null;
  /** Called when a photo pin is clicked. Pass null to clear selection. */
  onSelectPhoto?: (photoId: string | null) => void;
  /** When true, do not fitBounds on load; keep current map center and zoom (seamless transition from browse). */
  preserveViewport?: boolean;
  /** When true, only add/remove map layers; render nothing. Keeps pins visible when drawer is closed. */
  mapOnly?: boolean;
  /** When true, only render metadata content; do not register with map. Use inside drawer. */
  contentOnly?: boolean;
}

const ROUTE_SOURCE_ID = 'route-line';
const ROUTE_LAYER_ID = 'route-line-layer';

const SELECTED_BUBBLE_STYLE = 'outline: 2px solid #1d4ed8; outline-offset: 2px;';

function getBoundsFromCoords(coords: [number, number][]): [[number, number], [number, number]] {
  if (coords.length === 0) return [[-122.42, 37.78], [-122.4, 37.8]];
  let minLng = coords[0][0];
  let maxLng = coords[0][0];
  let minLat = coords[0][1];
  let maxLat = coords[0][1];
  for (let i = 1; i < coords.length; i++) {
    const [lng, lat] = coords[i];
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  const pad = 0.002;
  return [[minLng - pad, minLat - pad], [maxLng + pad, maxLat + pad]];
}

export function RouteView({ route, photos, selectedPhotoId, onSelectPhoto, preserveViewport, mapOnly, contentOnly }: RouteViewProps) {
  const mapRef = useRef<MapLibreMap | null>(null);
  const photoMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const thumbnailUrlsRef = useRef<Record<string, string>>({});

  const coordinates = useMemo(
    () => route.route_geometry?.coordinates ?? [],
    [route.route_geometry]
  );
  const hasRoute = coordinates.length >= 2;
  const photosWithLocation = useMemo(
    () => photos.filter((p) => (p.location?.coordinates?.length ?? 0) >= 2),
    [photos]
  );

  useEffect(() => {
    if (contentOnly || photosWithLocation.length === 0) return;
    let cancelled = false;
    const seen = new Set<string>();
    photosWithLocation.forEach((p) => {
      if (seen.has(p.id)) return;
      seen.add(p.id);
      fetchPhotoImageBlob(p.id, 'thumbnail')
        .then((blob) => {
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          setThumbnailUrls((prev) => {
            const next = { ...prev, [p.id]: url };
            thumbnailUrlsRef.current = next;
            return next;
          });
        })
        .catch(() => {
          if (cancelled) return;
          setThumbnailUrls((prev) => ({ ...prev, [p.id]: '' }));
        });
    });
    return () => {
      cancelled = true;
      Object.values(thumbnailUrlsRef.current).forEach((u) => {
        if (u) URL.revokeObjectURL(u);
      });
      thumbnailUrlsRef.current = {};
    };
  }, [photosWithLocation, contentOnly]);

  const handleMapReady = useCallback(
    (map: maplibregl.Map) => {
      mapRef.current = map as MapLibreMap;
      if (hasRoute) {
        const lineGeojson: GeoJSON.Feature<GeoJSON.LineString> = {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates },
        };
        map.addSource(ROUTE_SOURCE_ID, { type: 'geojson', data: lineGeojson });
        map.addLayer({
          id: ROUTE_LAYER_ID,
          type: 'line',
          source: ROUTE_SOURCE_ID,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#2563eb', 'line-width': 4 },
        });
        if (!preserveViewport) {
          const bounds = getBoundsFromCoords(coordinates);
          map.fitBounds(bounds, { padding: 40, maxZoom: 14, duration: 0 });
        }
      }
      setMapReady(true);
    },
    [hasRoute, coordinates, preserveViewport]
  );

  /** Create/teardown callout markers when photos or map readiness changes. */
  useEffect(() => {
    if (contentOnly) return;
    const map = mapRef.current;
    photoMarkersRef.current.forEach((m) => { try { m.remove(); } catch { /* ignore */ } });
    photoMarkersRef.current = [];
    if (!mapReady || !map) return;
    photosWithLocation.forEach((photo) => {
      const coords = photo.location?.coordinates;
      if (!coords || coords.length < 2) return;
      const [lng, lat] = coords as [number, number];
      const el = createPhotoCalloutElement(() => onSelectPhoto?.(photo.id), thumbnailUrlsRef.current[photo.id] || undefined);
      el.dataset.photoId = photo.id;
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([lng, lat])
        .addTo(map);
      photoMarkersRef.current.push(marker);
    });
    return () => {
      photoMarkersRef.current.forEach((m) => { try { m.remove(); } catch { /* ignore */ } });
      photoMarkersRef.current = [];
    };
  }, [contentOnly, mapReady, photosWithLocation, onSelectPhoto]);

  /** Update callout images in-place as thumbnails arrive. */
  useEffect(() => {
    if (contentOnly) return;
    photoMarkersRef.current.forEach((marker) => {
      const photoId = marker.getElement().dataset.photoId;
      if (!photoId) return;
      const url = thumbnailUrls[photoId];
      if (url) setCalloutThumbnail(marker.getElement(), url);
    });
  }, [contentOnly, thumbnailUrls]);

  /** Apply/remove selection highlight on the active marker's bubble. */
  useEffect(() => {
    if (contentOnly) return;
    photoMarkersRef.current.forEach((marker) => {
      const photoId = marker.getElement().dataset.photoId;
      const bubble = marker.getElement().querySelector('.photo-callout-bubble') as HTMLElement | null;
      if (!bubble) return;
      bubble.style.cssText += photoId === selectedPhotoId ? SELECTED_BUBBLE_STYLE : '';
      if (photoId !== selectedPhotoId) bubble.style.outline = '';
    });
  }, [contentOnly, selectedPhotoId]);

  const mapContext = useMapContext();

  useEffect(() => {
    if (contentOnly || !mapContext) return;
    mapContext.onMapReady(handleMapReady);
  }, [mapContext, handleMapReady, contentOnly]);
  useEffect(() => {
    if (contentOnly) return;
    return () => {
      photoMarkersRef.current.forEach((m) => { try { m.remove(); } catch { /* ignore */ } });
      photoMarkersRef.current = [];
      Object.values(thumbnailUrlsRef.current).forEach((u) => {
        if (u) URL.revokeObjectURL(u);
      });
      thumbnailUrlsRef.current = {};
      const map = mapRef.current;
      if (map) {
        try {
          if (map.getLayer(ROUTE_LAYER_ID)) map.removeLayer(ROUTE_LAYER_ID);
          if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
        } catch {
          /* defensive teardown */
        }
      }
      mapRef.current = null;
    };
  }, [contentOnly]);

  const pointCount = coordinates.length;
  const distanceKm = (route.distance_meters / 1000).toFixed(2);
  const isShellMap = !!mapContext;

  if (mapOnly) return null;
  if (contentOnly) {
    return (
      <section data-testid="route-detail-content">
        <h1 data-testid="route-detail-title" style={{ margin: 0, fontSize: '1.75rem' }}>{route.title}</h1>
        {route.description && (
          <p style={{ color: '#444', marginTop: '0.5rem', marginBottom: 0 }}>{route.description}</p>
        )}
        <dl style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem 2rem', marginTop: '1rem', marginBottom: 0 }}>
          <div>
            <dt style={{ margin: 0, fontSize: '0.75rem', color: '#666', textTransform: 'uppercase' }}>Distance</dt>
            <dd style={{ margin: '0.25rem 0 0', fontWeight: 600 }}>{distanceKm} km</dd>
          </div>
          <div>
            <dt style={{ margin: 0, fontSize: '0.75rem', color: '#666', textTransform: 'uppercase' }}>Points</dt>
            <dd style={{ margin: '0.25rem 0 0', fontWeight: 600 }}>{pointCount}</dd>
          </div>
          {route.tags.length > 0 && (
            <div>
              <dt style={{ margin: 0, fontSize: '0.75rem', color: '#666', textTransform: 'uppercase' }}>Tags</dt>
              <dd style={{ margin: '0.25rem 0 0', fontWeight: 500 }}>{route.tags.join(', ')}</dd>
            </div>
          )}
        </dl>
      </section>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {!isShellMap && (
        <MapPanel>
          <MapView onMapReady={handleMapReady} style={{ width: '100%', height: '100%' }} />
        </MapPanel>
      )}
      <section data-testid="route-detail-content">
        <h1 data-testid="route-detail-title" style={{ margin: 0, fontSize: '1.75rem' }}>{route.title}</h1>
        {route.description && (
          <p style={{ color: '#444', marginTop: '0.5rem', marginBottom: 0 }}>{route.description}</p>
        )}
        <dl style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem 2rem', marginTop: '1rem', marginBottom: 0 }}>
          <div>
            <dt style={{ margin: 0, fontSize: '0.75rem', color: '#666', textTransform: 'uppercase' }}>Distance</dt>
            <dd style={{ margin: '0.25rem 0 0', fontWeight: 600 }}>{distanceKm} km</dd>
          </div>
          <div>
            <dt style={{ margin: 0, fontSize: '0.75rem', color: '#666', textTransform: 'uppercase' }}>Points</dt>
            <dd style={{ margin: '0.25rem 0 0', fontWeight: 600 }}>{pointCount}</dd>
          </div>
          {route.tags.length > 0 && (
            <div>
              <dt style={{ margin: 0, fontSize: '0.75rem', color: '#666', textTransform: 'uppercase' }}>Tags</dt>
              <dd style={{ margin: '0.25rem 0 0', fontWeight: 500 }}>{route.tags.join(', ')}</dd>
            </div>
          )}
        </dl>
      </section>
    </div>
  );
}
