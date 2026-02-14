/** Browse public routes: map view (bbox fetch) + list view (paginated), filter by tags. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Map as MapLibreMap } from 'maplibre-gl';
import maplibregl from 'maplibre-gl';
import { getBrowseRoutes } from '../api/routes';
import { fetchPhotoImageBlob } from '../api/photos';
import { MapPanel } from '../components/map/MapPanel';
import { MapView } from '../components/map/MapView';
import { RouteList } from '../components/routes/RouteList';
import {
  createDefaultPinImageData,
  imageToPinImageData,
} from '../components/map/pinImageUtils';
import { usePreferredMapCenter } from '../hooks/usePreferredMapCenter';
import type { Route } from '../types/route';

type ViewMode = 'map' | 'list';

const ROUTES_SOURCE_ID = 'browse-routes';
const CLUSTER_LAYER_ID = 'browse-routes-clusters';
const UNCLUSTERED_LAYER_ID = 'browse-routes-unclustered';
const CLUSTER_MAX_ZOOM = 14;
/** Smaller radius than photo clustering so routes only group when very close. */
const CLUSTER_RADIUS = 28;
const CLUSTER_STACK_SIZE = 44;
const CLUSTER_STACK_OFFSET = 5;
const CLUSTER_STACK_MAX_IMAGES = 5;

function boundsToBbox(bounds: maplibregl.LngLatBounds): string {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return [sw.lng, sw.lat, ne.lng, ne.lat].join(',');
}

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function pointCoordinates(geom: GeoJSON.Geometry): [number, number] | null {
  if (geom.type === 'Point' && geom.coordinates && geom.coordinates.length >= 2) {
    return [geom.coordinates[0], geom.coordinates[1]];
  }
  return null;
}

function buildRoutesGeoJSON(routes: Route[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const route of routes) {
    const coords = route.route_geometry?.coordinates;
    if (!coords || coords.length === 0) continue;
    const [lng, lat] = coords[0];
    features.push({
      type: 'Feature',
      properties: {
        routeId: route.id,
        slug: route.slug,
        firstPhotoId: route.first_photo_id ?? null,
      },
      geometry: { type: 'Point', coordinates: [lng, lat] },
    });
  }
  return { type: 'FeatureCollection', features };
}

/** Stacked thumbnails for a route cluster; first route on top. */
function createRouteClusterStackElement(
  entries: { slug: string; firstPhotoId: string | null }[],
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
  const list = entries.slice(0, CLUSTER_STACK_MAX_IMAGES);
  list.forEach((entry, i) => {
    const el = document.createElement('div');
    el.style.cssText = [
      'position: absolute;',
      `left: ${i * CLUSTER_STACK_OFFSET}px; top: ${i * CLUSTER_STACK_OFFSET}px;`,
      `width: ${size}px; height: ${size}px;`,
      'border: 2px solid #fff; border-radius: 50%;',
      'box-shadow: 0 1px 3px rgba(0,0,0,0.3);',
      'overflow: hidden;',
      `z-index: ${list.length - i};`,
    ].join(' ');
    const url = entry.firstPhotoId ? thumbnailUrls[entry.firstPhotoId] : null;
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

export function Browse() {
  const navigate = useNavigate();
  const { center: mapCenter, zoom: mapZoom } = usePreferredMapCenter();
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [routes, setRoutes] = useState<Route[]>([]);
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0 });
  const [loading, setLoading] = useState(false);
  const [tagsFilter, setTagsFilter] = useState('');
  const [mapBbox, setMapBbox] = useState<string | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const clusterMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const thumbnailUrlsRef = useRef<Record<string, string>>({});
  const listPage = useRef(1);

  const routesWithPhoto = useMemo(
    () => routes.filter((r) => r.first_photo_id),
    [routes]
  );
  const firstPhotoIdsKey = useMemo(
    () => routesWithPhoto.map((r) => r.first_photo_id as string).join(','),
    [routesWithPhoto]
  );

  useEffect(() => {
    if (routesWithPhoto.length === 0) return;
    let cancelled = false;
    const seen = new Set<string>();
    routesWithPhoto.forEach((r) => {
      const id = r.first_photo_id as string;
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
  }, [firstPhotoIdsKey]);

  const fetchList = useCallback(() => {
    setLoading(true);
    getBrowseRoutes({
      page: listPage.current,
      per_page: 20,
      sort: 'created_at',
      tags: tagsFilter.trim() || undefined,
    })
      .then((res) => {
        setRoutes(res.routes);
        setPagination(res.pagination);
      })
      .catch(() => {
        setRoutes([]);
        setPagination((p) => ({ ...p, total: 0 }));
      })
      .finally(() => setLoading(false));
  }, [tagsFilter]);

  const [bboxTooLarge, setBboxTooLarge] = useState(false);

  const fetchMap = useCallback((bbox: string) => {
    setLoading(true);
    setBboxTooLarge(false);
    getBrowseRoutes({
      bbox,
      per_page: 50,
      sort: 'created_at',
      tags: tagsFilter.trim() || undefined,
    })
      .then((res) => {
        setRoutes(res.routes);
        setPagination(res.pagination);
      })
      .catch((err: unknown) => {
        const msg =
          err &&
          typeof err === 'object' &&
          'response' in err &&
          (err as { response?: { data?: { error?: { message?: string }; detail?: { message?: string } } } }).response?.data?.error?.message;
        const isBboxTooLarge =
          (err as { response?: { status?: number } })?.response?.status === 400 &&
          (typeof msg === 'string' && msg.toLowerCase().includes('bounding box'));
        if (isBboxTooLarge) {
          setBboxTooLarge(true);
          // keep previous routes so markers stay visible
        } else {
          setRoutes([]);
          setPagination((p) => ({ ...p, total: 0 }));
        }
      })
      .finally(() => setLoading(false));
  }, [tagsFilter]);

  const debouncedMapBbox = useDebounce(mapBbox, 400);

  useEffect(() => {
    if (viewMode !== 'map' || !debouncedMapBbox) return;
    fetchMap(debouncedMapBbox);
  }, [viewMode, debouncedMapBbox, fetchMap]);

  useEffect(() => {
    if (viewMode === 'list') {
      listPage.current = 1;
      fetchList();
    }
  }, [viewMode, fetchList]);

  const addImagesToMap = useCallback((map: MapLibreMap) => {
    const defaultPin = createDefaultPinImageData();
    if (!map.getStyle()) return;
    if (!map.hasImage('default-pin')) {
      map.addImage('default-pin', defaultPin);
    }
    routesWithPhoto.forEach((r) => {
      const id = r.first_photo_id as string;
      const url = thumbnailUrlsRef.current[id];
      if (url) {
        const img = new Image();
        img.onload = () => {
          if (!map.getStyle()) return;
          try {
            if (map.hasImage(id)) map.removeImage(id);
            const pinData = imageToPinImageData(img);
            map.addImage(id, pinData);
          } catch {
            /* layer/source may be gone */
          }
        };
        img.src = url;
      } else {
        try {
          if (!map.hasImage(id)) map.addImage(id, defaultPin);
        } catch {
          /* ignore */
        }
      }
    });
  }, [firstPhotoIdsKey]);

  const updateClusterMarkers = useCallback((map: MapLibreMap) => {
    clusterMarkersRef.current.forEach((m) => {
      try {
        m.remove();
      } catch {
        /* ignore */
      }
    });
    clusterMarkersRef.current = [];

    if (!map.getSource(ROUTES_SOURCE_ID) || !map.getLayer(CLUSTER_LAYER_ID)) return;

    const source = map.getSource(ROUTES_SOURCE_ID) as maplibregl.GeoJSONSource;
    const getLeaves =
      source && typeof source.getClusterLeaves === 'function'
        ? (clusterId: number) => source.getClusterLeaves(clusterId, 100, 0)
        : () => Promise.resolve<GeoJSON.Feature<GeoJSON.Point>[]>([]);

    const clusterFeatures = map.queryRenderedFeatures({ layers: [CLUSTER_LAYER_ID] });
    const dist2 = (a: [number, number], b: [number, number]) =>
      (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

    clusterFeatures.forEach((feature) => {
      const clusterId = feature.properties?.cluster_id as number | undefined;
      const center = pointCoordinates(feature.geometry as GeoJSON.Point);
      if (clusterId == null || !center) return;

      getLeaves(clusterId).then((leaves) => {
        if (!map.getSource(ROUTES_SOURCE_ID)) return;
        const withCoords = leaves
          .map((f) => {
            const c = pointCoordinates(f.geometry as GeoJSON.Point);
            const props = f.properties as { slug?: string; firstPhotoId?: string | null };
            return c && props ? { slug: props.slug ?? '', firstPhotoId: props.firstPhotoId ?? null, coords: c } : null;
          })
          .filter((x): x is { slug: string; firstPhotoId: string | null; coords: [number, number] } => x !== null);
        withCoords.sort((a, b) => dist2(a.coords, center) - dist2(b.coords, center));
        const entries = withCoords.map((x) => ({ slug: x.slug, firstPhotoId: x.firstPhotoId }));

        const el = createRouteClusterStackElement(entries, thumbnailUrlsRef.current, () => {
          Promise.resolve(source.getClusterExpansionZoom(clusterId)).then((zoom) => {
            map.easeTo({ center, zoom, duration: 300 });
          });
        });
        const marker = new maplibregl.Marker({ element: el }).setLngLat(center).addTo(map);
        clusterMarkersRef.current.push(marker);
      });
    });
  }, [navigate]);

  const handleMapReady = useCallback((map: MapLibreMap) => {
    mapRef.current = map;
    const onMoveEnd = () => {
      const bounds = map.getBounds();
      setMapBbox(boundsToBbox(bounds));
    };
    map.on('moveend', onMoveEnd);
    map.once('load', () => {
      const bounds = map.getBounds();
      setMapBbox(boundsToBbox(bounds));
    });
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (viewMode !== 'map' || !map) {
      if (map && map.getSource(ROUTES_SOURCE_ID)) {
        clusterMarkersRef.current.forEach((m) => {
          try { m.remove(); } catch { /* ignore */ }
        });
        clusterMarkersRef.current = [];
        map.removeLayer(UNCLUSTERED_LAYER_ID);
        map.removeLayer(CLUSTER_LAYER_ID);
        map.removeSource(ROUTES_SOURCE_ID);
      }
      return;
    }
    if (routes.length === 0) {
      if (map.getSource(ROUTES_SOURCE_ID)) {
        clusterMarkersRef.current.forEach((m) => {
          try { m.remove(); } catch { /* ignore */ }
        });
        clusterMarkersRef.current = [];
        map.removeLayer(UNCLUSTERED_LAYER_ID);
        map.removeLayer(CLUSTER_LAYER_ID);
        map.removeSource(ROUTES_SOURCE_ID);
      }
      return;
    }

    const geojson = buildRoutesGeoJSON(routes);
    if (!map.getSource(ROUTES_SOURCE_ID)) {
      map.addSource(ROUTES_SOURCE_ID, {
        type: 'geojson',
        data: geojson,
        cluster: true,
        clusterMaxZoom: CLUSTER_MAX_ZOOM,
        clusterRadius: CLUSTER_RADIUS,
      });
      const defaultPin = createDefaultPinImageData();
      if (!map.hasImage('default-pin')) {
        map.addImage('default-pin', defaultPin);
      }
      routesWithPhoto.forEach((r) => {
        const id = r.first_photo_id as string;
        if (map.hasImage(id)) return;
        try {
          map.addImage(id, defaultPin);
        } catch {
          /* ignore */
        }
      });
      map.addLayer({
        id: CLUSTER_LAYER_ID,
        type: 'circle',
        source: ROUTES_SOURCE_ID,
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
        source: ROUTES_SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': ['coalesce', ['get', 'firstPhotoId'], 'default-pin'],
          'icon-size': 1,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });
      map.on('click', CLUSTER_LAYER_ID, (e) => {
        const feature = e.features?.[0];
        if (!feature?.properties?.cluster_id) return;
        const src = map.getSource(ROUTES_SOURCE_ID) as maplibregl.GeoJSONSource;
        if (!src?.getClusterExpansionZoom) return;
        const clusterId = feature.properties.cluster_id;
        Promise.resolve(src.getClusterExpansionZoom(clusterId)).then((zoom) => {
          const center = pointCoordinates(feature.geometry as GeoJSON.Point);
          if (center) map.easeTo({ center, zoom, duration: 300 });
        });
      });
      map.on('click', UNCLUSTERED_LAYER_ID, (e) => {
        const feature = e.features?.[0];
        const slug = (feature?.properties as { slug?: string })?.slug;
        if (slug) navigate(`/routes/${slug}`);
      });
    } else {
      (map.getSource(ROUTES_SOURCE_ID) as maplibregl.GeoJSONSource).setData(geojson);
    }

    addImagesToMap(map);
    updateClusterMarkers(map);

    const onIdle = () => updateClusterMarkers(map);
    map.on('idle', onIdle);
    map.on('moveend', onIdle);

    return () => {
      map.off('idle', onIdle);
      map.off('moveend', onIdle);
      clusterMarkersRef.current.forEach((m) => {
        try { m.remove(); } catch { /* ignore */ }
      });
      clusterMarkersRef.current = [];
    };
  }, [viewMode, routes, routesWithPhoto, navigate, addImagesToMap, updateClusterMarkers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource(ROUTES_SOURCE_ID)) return;
    addImagesToMap(map);
    updateClusterMarkers(map);
  }, [thumbnailUrls, addImagesToMap, updateClusterMarkers]);

  const handleListPageChange = useCallback((page: number) => {
    listPage.current = page;
    setLoading(true);
    getBrowseRoutes({
      page,
      per_page: 20,
      sort: 'created_at',
      tags: tagsFilter.trim() || undefined,
    })
      .then((res) => {
        setRoutes(res.routes);
        setPagination(res.pagination);
      })
      .finally(() => setLoading(false));
  }, [tagsFilter]);

  const handleApplyTags = useCallback(() => {
    if (viewMode === 'list') fetchList();
    else if (mapRef.current && mapBbox) fetchMap(mapBbox);
  }, [viewMode, fetchList, mapBbox, fetchMap]);

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button
            type="button"
            onClick={() => setViewMode('map')}
            style={{
              padding: '0.5rem 0.75rem',
              fontWeight: viewMode === 'map' ? 'bold' : 'normal',
              background: viewMode === 'map' ? '#e5e7eb' : 'transparent',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
            }}
          >
            Map
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            style={{
              padding: '0.5rem 0.75rem',
              fontWeight: viewMode === 'list' ? 'bold' : 'normal',
              background: viewMode === 'list' ? '#e5e7eb' : 'transparent',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
            }}
          >
            List
          </button>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.875rem' }}>Tags:</span>
          <input
            type="text"
            value={tagsFilter}
            onChange={(e) => setTagsFilter(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleApplyTags()}
            placeholder="e.g. urban, night"
            style={{ padding: '0.35rem 0.5rem', width: '160px', border: '1px solid #d1d5db', borderRadius: '4px' }}
          />
          <button type="button" onClick={handleApplyTags} style={{ padding: '0.35rem 0.5rem' }}>
            Apply
          </button>
        </label>
      </div>

      {viewMode === 'map' && (
        <MapPanel
          overlay={
            loading || bboxTooLarge
              ? loading
                ? 'Loading routes…'
                : 'Zoom in to see routes in this area'
              : undefined
          }
        >
          <MapView
            center={mapCenter}
            zoom={mapZoom}
            style={{ width: '100%', height: '100%' }}
            onMapReady={handleMapReady}
          />
        </MapPanel>
      )}

      {viewMode === 'list' && (
        <div style={{ flex: 1, minHeight: 200, overflow: 'hidden' }}>
          <RouteList
            routes={routes}
            pagination={pagination}
            loading={loading}
            onPageChange={handleListPageChange}
          />
        </div>
      )}
    </div>
  );
}
