/** Route detail view: map with route polyline and photo pins, metadata. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { fetchPhotoImageBlob } from '../../api/photos';
import { useMapContext } from '../../contexts/MapContext';
import { MapPanel } from '../map/MapPanel';
import { MapView } from '../map/MapView';
import {
  browsePinIconSizeAtZoom,
  createDefaultPinImageData,
  imageToPinImageData,
  MAP_PIN_RASTER_SIZE,
  PIN_BORDER_WIDTH,
  PIN_ICON_SIZE,
} from '../map/pinImageUtils';
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
const PHOTOS_SOURCE_ID = 'route-photos';
const PHOTOS_LAYER_ID = 'route-photos-layer';
const PHOTOS_SELECTED_LAYER_ID = 'route-photos-selected';

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

function buildPhotosGeoJSON(photos: RoutePhoto[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const photo of photos) {
    const coords = photo.location?.coordinates;
    if (!coords || coords.length < 2) continue;
    features.push({
      type: 'Feature',
      properties: { photoId: photo.id },
      geometry: { type: 'Point', coordinates: [coords[0], coords[1]] },
    });
  }
  return { type: 'FeatureCollection', features };
}

export function RouteView({ route, photos, selectedPhotoId, onSelectPhoto, preserveViewport, mapOnly, contentOnly }: RouteViewProps) {
  const mapRef = useRef<MapLibreMap | null>(null);
  const zoomHandlerRef = useRef<(() => void) | null>(null);
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

  /** Pin images at MAP_PIN_RASTER_SIZE to match browse map (thumbnail sizing). */
  const addImagesToMap = useCallback((map: MapLibreMap) => {
    const defaultPin = createDefaultPinImageData(MAP_PIN_RASTER_SIZE);
    if (!map.getStyle()) return;
    if (!map.hasImage('default-pin')) {
      map.addImage('default-pin', defaultPin);
    }
    photosWithLocation.forEach((p) => {
      const url = thumbnailUrlsRef.current[p.id];
      if (url) {
        const img = new Image();
        img.onload = () => {
          if (!map.getStyle()) return;
          try {
            if (map.hasImage(p.id)) map.removeImage(p.id);
            const pinData = imageToPinImageData(img, MAP_PIN_RASTER_SIZE);
            map.addImage(p.id, pinData);
          } catch {
            /* layer/source may be gone */
          }
        };
        img.src = url;
      } else {
        try {
          if (!map.hasImage(p.id)) map.addImage(p.id, defaultPin);
        } catch {
          /* ignore */
        }
      }
    });
  }, [photosWithLocation]);

  const handleMapReady = useCallback(
    (map: maplibregl.Map) => {
      mapRef.current = map as MapLibreMap;
      if (!hasRoute) return;

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

      const photosGeojson = buildPhotosGeoJSON(photos);
      map.addSource(PHOTOS_SOURCE_ID, {
        type: 'geojson',
        data: photosGeojson,
      });

      const defaultPin = createDefaultPinImageData(MAP_PIN_RASTER_SIZE);
      if (!map.hasImage('default-pin')) {
        map.addImage('default-pin', defaultPin);
      }
      photosWithLocation.forEach((p) => {
        if (map.hasImage(p.id)) return;
        try {
          map.addImage(p.id, defaultPin);
        } catch {
          /* ignore */
        }
      });

      const iconSizeScale = (PIN_ICON_SIZE / MAP_PIN_RASTER_SIZE) * browsePinIconSizeAtZoom(map.getZoom());
      map.addLayer({
        id: PHOTOS_LAYER_ID,
        type: 'symbol',
        source: PHOTOS_SOURCE_ID,
        layout: {
          'icon-image': ['coalesce', ['get', 'photoId'], 'default-pin'],
          'icon-size': iconSizeScale,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });
      const zoomHandler = () => {
        try {
          const zoom = map.getZoom();
          const scale = (PIN_ICON_SIZE / MAP_PIN_RASTER_SIZE) * browsePinIconSizeAtZoom(zoom);
          if (map.getLayer(PHOTOS_LAYER_ID)) {
            map.setLayoutProperty(PHOTOS_LAYER_ID, 'icon-size', scale);
          }
          if (map.getLayer(PHOTOS_SELECTED_LAYER_ID)) {
            map.setPaintProperty(PHOTOS_SELECTED_LAYER_ID, 'circle-radius', (PIN_ICON_SIZE / 2) * scale);
          }
        } catch {
          /* layer/source may be gone */
        }
      };
      zoomHandlerRef.current = zoomHandler;
      map.on('zoom', zoomHandler);

      map.addLayer({
        id: PHOTOS_SELECTED_LAYER_ID,
        type: 'circle',
        source: PHOTOS_SOURCE_ID,
        filter: selectedPhotoId ? ['==', ['get', 'photoId'], selectedPhotoId] : ['literal', false],
        paint: {
          'circle-radius': (PIN_ICON_SIZE / 2) * iconSizeScale,
          'circle-color': 'transparent',
          'circle-stroke-width': PIN_BORDER_WIDTH,
          'circle-stroke-color': '#1d4ed8',
        },
      });

      map.on('click', PHOTOS_LAYER_ID, (e) => {
        const feature = e.features?.[0];
        const photoId = feature?.properties?.photoId as string | undefined;
        if (photoId) onSelectPhoto?.(photoId);
      });
      map.on('click', PHOTOS_SELECTED_LAYER_ID, (e) => {
        const feature = e.features?.[0];
        const photoId = feature?.properties?.photoId as string | undefined;
        if (photoId) onSelectPhoto?.(photoId);
      });

      if (!preserveViewport) {
        const bounds = getBoundsFromCoords(coordinates);
        map.fitBounds(bounds, { padding: 40, maxZoom: 14, duration: 0 });
      }

      addImagesToMap(map as MapLibreMap);
    },
    [hasRoute, coordinates, photos, photosWithLocation, onSelectPhoto, addImagesToMap, selectedPhotoId, preserveViewport]
  );

  useEffect(() => {
    if (contentOnly) return;
    const map = mapRef.current;
    if (!map) return;
    addImagesToMap(map);
  }, [thumbnailUrls, addImagesToMap, contentOnly]);

  useEffect(() => {
    if (contentOnly) return;
    const map = mapRef.current;
    if (!map || !map.getLayer(PHOTOS_SELECTED_LAYER_ID)) return;
    if (selectedPhotoId) {
      map.setFilter(PHOTOS_SELECTED_LAYER_ID, ['==', ['get', 'photoId'], selectedPhotoId]);
    } else {
      map.setFilter(PHOTOS_SELECTED_LAYER_ID, ['literal', false]);
    }
  }, [selectedPhotoId, contentOnly]);

  const mapContext = useMapContext();

  useEffect(() => {
    if (contentOnly || !mapContext) return;
    mapContext.onMapReady(handleMapReady);
  }, [mapContext, handleMapReady, contentOnly]);
  useEffect(() => {
    if (contentOnly) return;
    return () => {
      const map = mapRef.current;
      if (zoomHandlerRef.current && map) {
        try {
          map.off('zoom', zoomHandlerRef.current);
        } catch {
          /* ignore */
        }
        zoomHandlerRef.current = null;
      }
      Object.values(thumbnailUrlsRef.current).forEach((u) => {
        if (u) URL.revokeObjectURL(u);
      });
      thumbnailUrlsRef.current = {};
      if (map) {
        try {
          if (map.getLayer(PHOTOS_SELECTED_LAYER_ID)) map.removeLayer(PHOTOS_SELECTED_LAYER_ID);
          if (map.getLayer(PHOTOS_LAYER_ID)) map.removeLayer(PHOTOS_LAYER_ID);
          if (map.getLayer(ROUTE_LAYER_ID)) map.removeLayer(ROUTE_LAYER_ID);
          if (map.getSource(PHOTOS_SOURCE_ID)) map.removeSource(PHOTOS_SOURCE_ID);
          if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
        } catch {
          /* defensive teardown */
        }
      }
      mapRef.current = null;
    };
  }, []);

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
