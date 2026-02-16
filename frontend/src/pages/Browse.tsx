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
import { useMapContext } from '../contexts/MapContext';
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
  const mapContext = useMapContext();
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
  const [filtersOverlayOpen, setFiltersOverlayOpen] = useState(false);
  const [listOverlayOpen, setListOverlayOpen] = useState(true);

  const routesWithPhoto = useMemo(
    () => routes.filter((r) => r.first_photo_id),
    [routes]
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
  }, [routesWithPhoto]);

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

  useEffect(() => {
    if (!mapContext || !listOverlayOpen) return;
    listPage.current = 1;
    const id = setTimeout(() => fetchList(), 0);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch on mount when list open; fetchList would cause refetch on every tags change
  }, [mapContext, listOverlayOpen]);


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
  }, [routesWithPhoto]);

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
  }, []);

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
    if (!mapContext) return;
    mapContext.onMapReady(handleMapReady);
  }, [mapContext, handleMapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const hasMapApi = map && typeof (map as MapLibreMap).getSource === 'function';
    if (viewMode !== 'map' || !hasMapApi) {
      if (hasMapApi && (map as MapLibreMap).getSource(ROUTES_SOURCE_ID)) {
        clusterMarkersRef.current.forEach((m) => {
          try { m.remove(); } catch { /* ignore */ }
        });
        clusterMarkersRef.current = [];
        (map as MapLibreMap).removeLayer(UNCLUSTERED_LAYER_ID);
        (map as MapLibreMap).removeLayer(CLUSTER_LAYER_ID);
        (map as MapLibreMap).removeSource(ROUTES_SOURCE_ID);
      }
      return;
    }
    if (routes.length === 0) {
      if ((map as MapLibreMap).getSource(ROUTES_SOURCE_ID)) {
        clusterMarkersRef.current.forEach((m) => {
          try { m.remove(); } catch { /* ignore */ }
        });
        clusterMarkersRef.current = [];
        (map as MapLibreMap).removeLayer(UNCLUSTERED_LAYER_ID);
        (map as MapLibreMap).removeLayer(CLUSTER_LAYER_ID);
        (map as MapLibreMap).removeSource(ROUTES_SOURCE_ID);
      }
      return;
    }

    const mapApi = map as MapLibreMap;
    const geojson = buildRoutesGeoJSON(routes);
    if (!mapApi.getSource(ROUTES_SOURCE_ID)) {
      mapApi.addSource(ROUTES_SOURCE_ID, {
        type: 'geojson',
        data: geojson,
        cluster: true,
        clusterMaxZoom: CLUSTER_MAX_ZOOM,
        clusterRadius: CLUSTER_RADIUS,
      });
      const defaultPin = createDefaultPinImageData();
      if (!mapApi.hasImage('default-pin')) {
        mapApi.addImage('default-pin', defaultPin);
      }
      routesWithPhoto.forEach((r) => {
        const id = r.first_photo_id as string;
        if (mapApi.hasImage(id)) return;
        try {
          mapApi.addImage(id, defaultPin);
        } catch {
          /* ignore */
        }
      });
      mapApi.addLayer({
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
      mapApi.addLayer({
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
      mapApi.on('click', CLUSTER_LAYER_ID, (e) => {
        const feature = e.features?.[0];
        if (!feature?.properties?.cluster_id) return;
        const src = mapApi.getSource(ROUTES_SOURCE_ID) as maplibregl.GeoJSONSource;
        if (!src?.getClusterExpansionZoom) return;
        const clusterId = feature.properties.cluster_id;
        Promise.resolve(src.getClusterExpansionZoom(clusterId)).then((zoom) => {
          const center = pointCoordinates(feature.geometry as GeoJSON.Point);
          if (center) mapApi.easeTo({ center, zoom, duration: 300 });
        });
      });
      mapApi.on('click', UNCLUSTERED_LAYER_ID, (e) => {
        const feature = e.features?.[0];
        const slug = (feature?.properties as { slug?: string })?.slug;
        if (slug) navigate(`/routes/${slug}`);
      });
    } else {
      (mapApi.getSource(ROUTES_SOURCE_ID) as maplibregl.GeoJSONSource).setData(geojson);
    }

    addImagesToMap(mapApi);
    updateClusterMarkers(mapApi);

    const onIdle = () => updateClusterMarkers(mapApi);
    mapApi.on('idle', onIdle);
    mapApi.on('moveend', onIdle);

    return () => {
      mapApi.off('idle', onIdle);
      mapApi.off('moveend', onIdle);
      clusterMarkersRef.current.forEach((m) => {
        try { m.remove(); } catch { /* ignore */ }
      });
      clusterMarkersRef.current = [];
      try {
        if (mapApi.getLayer(UNCLUSTERED_LAYER_ID)) mapApi.removeLayer(UNCLUSTERED_LAYER_ID);
        if (mapApi.getLayer(CLUSTER_LAYER_ID)) mapApi.removeLayer(CLUSTER_LAYER_ID);
        if (mapApi.getSource(ROUTES_SOURCE_ID)) mapApi.removeSource(ROUTES_SOURCE_ID);
      } catch {
        /* defensive teardown */
      }
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
    if (mapRef.current && mapBbox) fetchMap(mapBbox);
    if (viewMode === 'list' || listOverlayOpen) fetchList();
  }, [viewMode, listOverlayOpen, fetchList, mapBbox, fetchMap]);

  const isShellMap = !!mapContext;
  const overlayMessage =
    (loading || bboxTooLarge)
      ? loading
        ? 'Loading routes…'
        : 'Zoom in to see routes in this area'
      : undefined;

  useEffect(() => {
    if (!isShellMap) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFiltersOverlayOpen(false);
        setListOverlayOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isShellMap]);

  const handleListRouteClick = useCallback((slug: string) => {
    setListOverlayOpen(false);
    navigate(`/routes/${slug}`);
  }, [navigate]);

  const floatingButtonStyle = {
    position: 'absolute' as const,
    zIndex: 100,
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    background: 'rgba(255,255,255,0.95)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    cursor: 'pointer' as const,
    pointerEvents: 'auto' as const,
  };

  return (
    <div
      style={
        isShellMap
          ? { position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }
          : { padding: '1rem', display: 'flex', flexDirection: 'column' }
      }
    >
      {isShellMap ? (
        <>
          <div style={{ position: 'absolute', top: '3.5rem', left: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem', pointerEvents: 'auto', zIndex: 500 }}>
            <button
              type="button"
              onClick={() => setFiltersOverlayOpen(true)}
              style={{ ...floatingButtonStyle, flexShrink: 0 }}
              aria-label="Open filters"
            >
              Filters
            </button>
            <button
              type="button"
              onClick={() => {
                listPage.current = 1;
                fetchList();
                setListOverlayOpen(true);
              }}
              style={{ ...floatingButtonStyle, flexShrink: 0 }}
              aria-label="Open routes"
            >
              Routes
            </button>
          </div>

          {filtersOverlayOpen && (
            <>
              <div
                role="presentation"
                aria-hidden="true"
                style={{ position: 'absolute', inset: 0, zIndex: 301, background: 'rgba(0,0,0,0.3)', pointerEvents: 'auto' }}
                onClick={() => setFiltersOverlayOpen(false)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Filter by tags"
                style={{
                  position: 'absolute',
                  top: '5rem',
                  left: '0.75rem',
                  zIndex: 302,
                  minWidth: 260,
                  padding: '1rem',
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  pointerEvents: 'auto',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>Filters</h3>
                  <button type="button" onClick={() => setFiltersOverlayOpen(false)} aria-label="Close">×</button>
                </div>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.875rem' }}>Tags</span>
                  <input
                    type="text"
                    value={tagsFilter}
                    onChange={(e) => setTagsFilter(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (handleApplyTags(), setFiltersOverlayOpen(false))}
                    placeholder="e.g. urban, night"
                    style={{ padding: '0.35rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }}
                  />
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setFiltersOverlayOpen(false)}>Cancel</button>
                  <button
                    type="button"
                    onClick={() => { handleApplyTags(); setFiltersOverlayOpen(false); }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </>
          )}

          {listOverlayOpen && (
            <>
              <div
                role="presentation"
                aria-hidden="true"
                style={{ position: 'absolute', inset: 0, zIndex: 201, background: 'rgba(0,0,0,0.3)', pointerEvents: 'auto' }}
                onClick={() => setListOverlayOpen(false)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Routes list"
                style={{
                  position: 'absolute',
                  top: '3.5rem',
                  left: '0.75rem',
                  right: '0.75rem',
                  bottom: '0.75rem',
                  maxWidth: 400,
                  maxHeight: 'calc(100vh - 5rem)',
                  display: 'flex',
                  flexDirection: 'column',
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  pointerEvents: 'auto',
                  zIndex: 202,
                  overflow: 'hidden',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb', gap: '0.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>Routes</h3>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button
                      type="button"
                      onClick={() => setFiltersOverlayOpen(true)}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
                    >
                      Filters
                    </button>
                    <button type="button" onClick={() => setListOverlayOpen(false)} aria-label="Close">×</button>
                  </div>
                </div>
                <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                  <RouteList
                    routes={routes}
                    pagination={pagination}
                    loading={loading}
                    onPageChange={handleListPageChange}
                    onRouteClick={handleListRouteClick}
                  />
                </div>
              </div>
            </>
          )}

          {overlayMessage && (
            <div
              style={{
                position: 'absolute',
                top: '5rem',
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '0.25rem 0.5rem',
                background: 'rgba(255,255,255,0.9)',
                borderRadius: 4,
                fontSize: '0.875rem',
                pointerEvents: 'auto',
                zIndex: 100,
              }}
            >
              {overlayMessage}
            </div>
          )}
        </>
      ) : (
        <>
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
              <button type="button" onClick={handleApplyTags} style={{ padding: '0.35rem 0.5rem' }}>Apply</button>
            </label>
          </div>

          {viewMode === 'map' && (
            <MapPanel overlay={overlayMessage}>
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
        </>
      )}
    </div>
  );
}
