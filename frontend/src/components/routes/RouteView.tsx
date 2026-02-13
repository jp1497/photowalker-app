/** Route detail view: map with route polyline and photo pins, metadata. */
import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { fetchPhotoImageBlob } from '../../api/photos';
import { MapView } from '../map/MapView';
import { createPhotoMarkerElement, setMarkerThumbnail } from '../map/PhotoMarker';
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
  /** Called when a photo pin is clicked. */
  onSelectPhoto?: (photoId: string) => void;
}

const ROUTE_SOURCE_ID = 'route-line';
const ROUTE_LAYER_ID = 'route-line-layer';

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

export function RouteView({ route, photos, selectedPhotoId, onSelectPhoto }: RouteViewProps) {
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const photoIdsRef = useRef<string[]>([]);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const thumbnailUrlsRef = useRef<Record<string, string>>({});

  const coordinates = route.route_geometry?.coordinates ?? [];
  const hasRoute = coordinates.length >= 2;

  const photoIdsWithLocation = useMemo(
    () => photos.filter((p) => (p.location?.coordinates?.length ?? 0) >= 2).map((p) => p.id),
    [photos]
  );
  const photoIdsKey = useMemo(() => photoIdsWithLocation.join(','), [photoIdsWithLocation]);

  useEffect(() => {
    if (photoIdsWithLocation.length === 0) return;
    let cancelled = false;
    const seen = new Set<string>();
    photoIdsWithLocation.forEach((id) => {
      if (seen.has(id)) return;
      seen.add(id);
      fetchPhotoImageBlob(id, 'thumbnail')
        .then((blob) => {
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          setThumbnailUrls((prev) => {
            const next = { ...prev, [id]: url };
            thumbnailUrlsRef.current = next;
            return next;
          });
        })
        .catch(() => {
          if (cancelled) return;
          setThumbnailUrls((prev) => ({ ...prev, [id]: '' }));
        });
    });
    return () => {
      cancelled = true;
      Object.values(thumbnailUrlsRef.current).forEach((u) => {
        if (u) URL.revokeObjectURL(u);
      });
      thumbnailUrlsRef.current = {};
    };
  }, [photoIdsKey]);

  const applyThumbnailsToMarkers = () => {
    const urls = thumbnailUrlsRef.current;
    const ids = photoIdsRef.current;
    markersRef.current.forEach((marker, i) => {
      const photoId = ids[i];
      const url = photoId ? urls[photoId] : undefined;
      if (url) {
        const el = marker.getElement();
        if (el) setMarkerThumbnail(el, url);
      }
    });
  };

  const handleMapReady = (map: maplibregl.Map) => {
    photoIdsRef.current = [];
    markersRef.current = [];
    if (!hasRoute) return;

    const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates,
      },
    };

    map.addSource(ROUTE_SOURCE_ID, {
      type: 'geojson',
      data: geojson,
    });
    map.addLayer({
      id: ROUTE_LAYER_ID,
      type: 'line',
      source: ROUTE_SOURCE_ID,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#2563eb',
        'line-width': 4,
      },
    });

    const bounds = getBoundsFromCoords(coordinates);
    map.fitBounds(bounds, { padding: 40, maxZoom: 14, duration: 0 });

    for (const photo of photos) {
      const coords = photo.location?.coordinates;
      if (!coords || coords.length < 2) continue;
      const [lng, lat] = coords;
      const el = createPhotoMarkerElement(() => onSelectPhoto?.(photo.id));
      const marker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
      markersRef.current.push(marker);
      photoIdsRef.current.push(photo.id);
    }
    applyThumbnailsToMarkers();
  };

  useEffect(() => {
    applyThumbnailsToMarkers();
  }, [thumbnailUrls]);

  useEffect(() => {
    const ids = photoIdsRef.current;
    markersRef.current.forEach((marker, i) => {
      const el = marker.getElement();
      if (!el) return;
      const isSelected = ids[i] === selectedPhotoId;
      const dot = el.querySelector('.photo-marker-pin-dot') as HTMLElement | null;
      const target = dot ?? el;
      target.style.background = isSelected ? '#1d4ed8' : '#2563eb';
      el.style.transform = isSelected ? 'scale(1.2)' : 'none';
    });
  }, [selectedPhotoId]);

  useEffect(() => {
    return () => {
      markersRef.current = [];
      photoIdsRef.current = [];
      Object.values(thumbnailUrlsRef.current).forEach((u) => {
        if (u) URL.revokeObjectURL(u);
      });
      thumbnailUrlsRef.current = {};
    };
  }, []);

  const pointCount = coordinates.length;
  const distanceKm = (route.distance_meters / 1000).toFixed(2);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ height: 320, border: '1px solid #ccc', borderRadius: 4, overflow: 'hidden' }}>
        <MapView onMapReady={handleMapReady} style={{ width: '100%', height: '100%' }} />
      </div>
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
