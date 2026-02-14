/** Route detail view: map with route polyline and photo pins, metadata. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { fetchPhotoImageBlob } from '../../api/photos';
import { MapPanel } from '../map/MapPanel';
import { MapView } from '../map/MapView';
import {
  createDefaultPinImageData,
  imageToPinImageData,
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
}

const ROUTE_SOURCE_ID = 'route-line';
const ROUTE_LAYER_ID = 'route-line-layer';
const PHOTOS_SOURCE_ID = 'route-photos';
const CLUSTER_LAYER_ID = 'route-photos-clusters';
const UNCLUSTERED_LAYER_ID = 'route-photos-unclustered';
const UNCLUSTERED_SELECTED_LAYER_ID = 'route-photos-unclustered-selected';
const CLUSTER_MAX_ZOOM = 14;
const CLUSTER_RADIUS = 50;
const CLUSTER_STACK_SIZE = 44;
const CLUSTER_STACK_OFFSET = 5;
const CLUSTER_STACK_MAX_IMAGES = 5;

function pointCoordinates(geom: GeoJSON.Geometry): [number, number] | null {
  if (geom.type === 'Point' && geom.coordinates && geom.coordinates.length >= 2) {
    return [geom.coordinates[0], geom.coordinates[1]];
  }
  return null;
}

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

/** Create a stacked-pins DOM element for a cluster. First photoId is on top (closest to center). */
function createClusterStackElement(
  photoIds: string[],
  thumbnailUrls: Record<string, string>,
  onClick: () => void
): HTMLElement {
  const size = CLUSTER_STACK_SIZE;
  const container = document.createElement('div');
  container.className = 'cluster-stack-pins';
  container.setAttribute('aria-hidden', 'true');
  container.style.cssText = [
    `position: relative; width: ${size + (CLUSTER_STACK_MAX_IMAGES - 1) * CLUSTER_STACK_OFFSET}px;`,
    `height: ${size + (CLUSTER_STACK_MAX_IMAGES - 1) * CLUSTER_STACK_OFFSET}px;`,
    'cursor: pointer;',
  ].join(' ');
  container.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });

  const ids = photoIds.slice(0, CLUSTER_STACK_MAX_IMAGES);
  ids.forEach((photoId, i) => {
    const el = document.createElement('div');
    el.style.cssText = [
      'position: absolute;',
      `left: ${i * CLUSTER_STACK_OFFSET}px; top: ${i * CLUSTER_STACK_OFFSET}px;`,
      `width: ${size}px; height: ${size}px;`,
      'border: 2px solid #fff; border-radius: 50%;',
      'box-shadow: 0 1px 3px rgba(0,0,0,0.3);',
      'overflow: hidden;',
      `z-index: ${ids.length - i};`,
    ].join(' ');
    const url = thumbnailUrls[photoId];
    if (url) {
      const img = document.createElement('img');
      img.alt = '';
      img.src = url;
      img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
      el.appendChild(img);
    } else {
      el.style.background = '#2563eb';
    }
    container.appendChild(el);
  });

  return container;
}

export function RouteView({ route, photos, selectedPhotoId, onSelectPhoto }: RouteViewProps) {
  const mapRef = useRef<MapLibreMap | null>(null);
  const clusterMarkersRef = useRef<maplibregl.Marker[]>([]);
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
    if (photosWithLocation.length === 0) return;
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
  }, [photosWithLocation]);

  const addImagesToMap = useCallback((map: MapLibreMap) => {
    const defaultPin = createDefaultPinImageData();
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
            const pinData = imageToPinImageData(img);
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

  const updateClusterMarkers = useCallback((map: MapLibreMap) => {
    clusterMarkersRef.current.forEach((m) => {
      try {
        m.remove();
      } catch {
        /* ignore */
      }
    });
    clusterMarkersRef.current = [];

    if (!map.getSource(PHOTOS_SOURCE_ID) || !map.getLayer(CLUSTER_LAYER_ID)) return;

    const source = map.getSource(PHOTOS_SOURCE_ID) as maplibregl.GeoJSONSource;
    const getLeaves =
      source && typeof source.getClusterLeaves === 'function'
        ? (clusterId: number) => source.getClusterLeaves(clusterId, 100, 0)
        : () => Promise.resolve<GeoJSON.Feature<GeoJSON.Point>[]>([]);

    const clusterFeatures = map.queryRenderedFeatures({ layers: [CLUSTER_LAYER_ID] });
    const dist2 = (a: [number, number], b: [number, number]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

    clusterFeatures.forEach((feature) => {
      const clusterId = feature.properties?.cluster_id as number | undefined;
      const center = pointCoordinates(feature.geometry as GeoJSON.Point);
      if (clusterId == null || !center) return;

      getLeaves(clusterId).then((leaves) => {
        if (!map.getSource(PHOTOS_SOURCE_ID)) return;
        const withCoords = leaves
          .map((f) => {
            const c = pointCoordinates(f.geometry as GeoJSON.Point);
            const id = (f.properties as { photoId?: string })?.photoId;
            return c && id ? { photoId: id, coords: c } : null;
          })
          .filter((x): x is { photoId: string; coords: [number, number] } => x !== null);
        withCoords.sort((a, b) => dist2(a.coords, center) - dist2(b.coords, center));
        const photoIds = withCoords.map((x) => x.photoId);

        const el = createClusterStackElement(photoIds, thumbnailUrlsRef.current, () => {
          onSelectPhoto?.(null);
          if (map.getLayer(UNCLUSTERED_SELECTED_LAYER_ID)) {
            map.setFilter(UNCLUSTERED_SELECTED_LAYER_ID, ['literal', false]);
          }
          Promise.resolve(source.getClusterExpansionZoom(clusterId)).then((zoom) => {
            map.easeTo({ center, zoom, duration: 300 });
          });
        });
        const marker = new maplibregl.Marker({ element: el }).setLngLat(center).addTo(map);
        clusterMarkersRef.current.push(marker);
      });
    });
  }, [onSelectPhoto]);

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
        cluster: true,
        clusterMaxZoom: CLUSTER_MAX_ZOOM,
        clusterRadius: CLUSTER_RADIUS,
      });

      const defaultPin = createDefaultPinImageData();
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

      map.addLayer({
        id: CLUSTER_LAYER_ID,
        type: 'circle',
        source: PHOTOS_SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          'circle-radius': 32,
          'circle-opacity': 0,
          'circle-color': '#2563eb',
        },
      });
      map.addLayer({
        id: UNCLUSTERED_LAYER_ID,
        type: 'symbol',
        source: PHOTOS_SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': ['get', 'photoId'],
          'icon-size': 1,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });
      map.addLayer({
        id: UNCLUSTERED_SELECTED_LAYER_ID,
        type: 'circle',
        source: PHOTOS_SOURCE_ID,
        filter: selectedPhotoId
          ? ['all', ['!', ['has', 'point_count']], ['==', ['get', 'photoId'], selectedPhotoId]]
          : ['literal', false],
        paint: {
          'circle-radius': PIN_ICON_SIZE / 2,
          'circle-color': 'transparent',
          'circle-stroke-width': PIN_BORDER_WIDTH,
          'circle-stroke-color': '#1d4ed8',
        },
      });
      map.on('click', CLUSTER_LAYER_ID, (e) => {
        const feature = e.features?.[0];
        if (!feature?.properties?.cluster_id) return;
        const source = map.getSource(PHOTOS_SOURCE_ID) as maplibregl.GeoJSONSource;
        if (!source?.getClusterExpansionZoom) return;
        onSelectPhoto?.(null);
        if (map.getLayer(UNCLUSTERED_SELECTED_LAYER_ID)) {
          map.setFilter(UNCLUSTERED_SELECTED_LAYER_ID, ['literal', false]);
        }
        const clusterId = feature.properties.cluster_id;
        Promise.resolve(source.getClusterExpansionZoom(clusterId)).then((zoom) => {
          const geometry = feature.geometry as GeoJSON.Point;
          const center = pointCoordinates(geometry);
          if (center) map.easeTo({ center, zoom, duration: 300 });
        });
      });

      map.on('click', UNCLUSTERED_LAYER_ID, (e) => {
        const feature = e.features?.[0];
        const photoId = feature?.properties?.photoId as string | undefined;
        if (photoId) onSelectPhoto?.(photoId);
      });
      map.on('click', UNCLUSTERED_SELECTED_LAYER_ID, (e) => {
        const feature = e.features?.[0];
        const photoId = feature?.properties?.photoId as string | undefined;
        if (photoId) onSelectPhoto?.(photoId);
      });

      const bounds = getBoundsFromCoords(coordinates);
      map.fitBounds(bounds, { padding: 40, maxZoom: 14, duration: 0 });

      addImagesToMap(map as MapLibreMap);
      updateClusterMarkers(map as MapLibreMap);

      const onMoveEnd = () => updateClusterMarkers(map as MapLibreMap);
      map.on('idle', onMoveEnd);
      map.on('moveend', onMoveEnd);
    },
    [hasRoute, coordinates, photos, photosWithLocation, onSelectPhoto, addImagesToMap, updateClusterMarkers, selectedPhotoId]
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    addImagesToMap(map);
    updateClusterMarkers(map);
  }, [thumbnailUrls, addImagesToMap, updateClusterMarkers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer(UNCLUSTERED_SELECTED_LAYER_ID)) return;
    if (selectedPhotoId) {
      map.setFilter(UNCLUSTERED_SELECTED_LAYER_ID, [
        'all',
        ['!', ['has', 'point_count']],
        ['==', ['get', 'photoId'], selectedPhotoId],
      ]);
    } else {
      map.setFilter(UNCLUSTERED_SELECTED_LAYER_ID, ['literal', false]);
    }
  }, [selectedPhotoId]);

  useEffect(() => {
    return () => {
      clusterMarkersRef.current.forEach((m) => {
        try {
          m.remove();
        } catch {
          /* ignore */
        }
      });
      clusterMarkersRef.current = [];
      Object.values(thumbnailUrlsRef.current).forEach((u) => {
        if (u) URL.revokeObjectURL(u);
      });
      thumbnailUrlsRef.current = {};
      mapRef.current = null;
    };
  }, []);

  const pointCount = coordinates.length;
  const distanceKm = (route.distance_meters / 1000).toFixed(2);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <MapPanel>
        <MapView onMapReady={handleMapReady} style={{ width: '100%', height: '100%' }} />
      </MapPanel>
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
