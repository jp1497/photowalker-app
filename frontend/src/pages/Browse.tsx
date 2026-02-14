/** Browse public routes: map view (bbox fetch) + list view (paginated), filter by tags. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Map as MapLibreMap } from 'maplibre-gl';
import maplibregl from 'maplibre-gl';
import { getBrowseRoutes } from '../api/routes';
import { MapView } from '../components/map/MapView';
import { RouteList } from '../components/routes/RouteList';
import { createPhotoMarkerElement } from '../components/map/PhotoMarker';
import { usePreferredMapCenter } from '../hooks/usePreferredMapCenter';
import type { Route } from '../types/route';

type ViewMode = 'map' | 'list';

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
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const listPage = useRef(1);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on view/bbox change
    fetchMap(debouncedMapBbox);
  }, [viewMode, debouncedMapBbox, fetchMap]);

  useEffect(() => {
    if (viewMode === 'list') {
      listPage.current = 1;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch list on view change
      fetchList();
    }
  }, [viewMode, fetchList]);

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
    if (viewMode !== 'map' || !map || !routes.length) {
      markersRef.current.forEach((m) => {
        try { m.remove(); } catch { /* defensive teardown */ }
      });
      markersRef.current = [];
      return;
    }
    markersRef.current.forEach((m) => {
      try { m.remove(); } catch { /* defensive teardown */ }
    });
    markersRef.current = [];
    routes.forEach((route) => {
      const coords = route.route_geometry?.coordinates;
      if (!coords || coords.length === 0) return;
      const [lng, lat] = coords[0];
      const el = createPhotoMarkerElement(() => navigate(`/routes/${route.slug}`));
      const marker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
      markersRef.current.push(marker);
    });
    return () => {
      markersRef.current.forEach((m) => {
        try { m.remove(); } catch { /* defensive teardown */ }
      });
      markersRef.current = [];
    };
  }, [viewMode, routes, navigate]);

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
        <div style={{ height: 480, position: 'relative' }}>
          <MapView
            center={mapCenter}
            zoom={mapZoom}
            style={{ width: '100%', height: '100%' }}
            onMapReady={handleMapReady}
          />
          {(loading || bboxTooLarge) && (
            <div
              style={{
                position: 'absolute',
                top: '0.5rem',
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '0.25rem 0.5rem',
                background: 'rgba(255,255,255,0.9)',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
            >
              {loading ? 'Loading routes…' : 'Zoom in to see routes in this area'}
            </div>
          )}
        </div>
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
