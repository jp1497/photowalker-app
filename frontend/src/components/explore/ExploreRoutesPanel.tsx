/**
 * Left Explore routes panel (PRD v6 FR-U3).
 * Step 4.1: Filters (All / My routes), paginated route list, Create route button.
 * Open state from parent (drawer menu). Bbox from map viewport or default.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { getBrowseRoutes } from '../../api/routes';
import { useMapContext } from '../../contexts/MapContext';
import { useAuth } from '../../hooks/useAuth';
import { RouteList } from '../routes/RouteList';
import { NAV_RAIL_WIDTH } from '../common/DrawerMenu';
import type { Route } from '../../types/route';

const PANEL_Z_INDEX = 999;
const PANEL_WIDTH = '30rem';
const PER_PAGE = 20;
/** Default bbox when map is not ready (SF area, within backend 200 km² limit). */
const DEFAULT_BBOX = '-122.44,37.77,-122.30,37.81';

export interface ExploreRoutesPanelProps {
  /** When true, the panel is visible. */
  open: boolean;
  /** Called when the panel should close (e.g. close button). */
  onClose: () => void;
  /** When provided, route card click opens the route (navigate to /routes/:slug and open drawer). */
  onRouteSelect?: (slug: string) => void;
  /** Optional; Phase 4.3: hover/select passes route slug to show highlighted-route layer on map. */
  onHighlightRoute?: (slug: string | null) => void;
}

function boundsToBbox(bounds: { getSouthWest(): { lng: number; lat: number }; getNorthEast(): { lng: number; lat: number } }): string {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return [sw.lng, sw.lat, ne.lng, ne.lat].join(',');
}

const closeButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: '0.25rem',
  cursor: 'pointer',
  fontSize: '1.25rem',
  color: '#374151',
  lineHeight: 1,
};

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: NAV_RAIL_WIDTH,
  bottom: 0,
  width: PANEL_WIDTH,
  maxWidth: 'min(320px, calc(100vw - 80px))',
  zIndex: PANEL_Z_INDEX,
  display: 'flex',
  flexDirection: 'column',
  background: '#fff',
  borderRight: '1px solid #e5e7eb',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.75rem 1rem',
  borderBottom: '1px solid #e5e7eb',
  flexShrink: 0,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.125rem',
  fontWeight: 600,
};

const filtersRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.5rem',
  padding: '0.75rem 1rem',
  borderBottom: '1px solid #e5e7eb',
  flexShrink: 0,
};

const filterButtonStyle = (active: boolean): React.CSSProperties => ({
  padding: '0.35rem 0.75rem',
  marginRight: '0.5rem',
  fontWeight: active ? 600 : 400,
  background: active ? '#e5e7eb' : 'transparent',
  border: '1px solid #d1d5db',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '0.875rem',
});

const listSlotStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
  padding: 0,
  borderBottom: 'none',
};

const createButtonStyle: React.CSSProperties = {
  padding: '0.35rem 0.75rem',
  fontWeight: 600,
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '0.875rem',
  flexShrink: 0,
};

export function ExploreRoutesPanel({
  open,
  onClose,
  onRouteSelect,
  onHighlightRoute,
}: ExploreRoutesPanelProps) {
  const navigate = useNavigate();
  const mapContext = useMapContext();
  const { user, isAuthenticated } = useAuth();

  const [filter, setFilter] = useState<'all' | 'my-routes'>('all');
  const [routes, setRoutes] = useState<Route[]>([]);
  const [pagination, setPagination] = useState({ page: 1, per_page: PER_PAGE, total: 0 });
  const [loading, setLoading] = useState(false);
  const [bbox, setBbox] = useState<string>(DEFAULT_BBOX);
  const [hoveredRouteSlug, setHoveredRouteSlug] = useState<string | null>(null);
  const [selectedRouteSlug, setSelectedRouteSlug] = useState<string | null>(null);
  const bboxRef = useRef(bbox);
  const mapRef = useRef<MapLibreMap | null>(null);
  const moveEndHandlerRef = useRef<(() => void) | null>(null);

  const effectiveHighlightSlug = hoveredRouteSlug ?? selectedRouteSlug;

  useEffect(() => {
    onHighlightRoute?.(effectiveHighlightSlug);
  }, [effectiveHighlightSlug, onHighlightRoute]);

  useEffect(() => {
    bboxRef.current = bbox;
  }, [bbox]);

  useEffect(() => {
    if (!open || !mapContext) return;
    const updateBbox = (map: MapLibreMap) => {
      setBbox(boundsToBbox(map.getBounds()));
    };
    const setup = (map: MapLibreMap) => {
      mapRef.current = map;
      const handler = () => updateBbox(map);
      moveEndHandlerRef.current = handler;
      map.on('moveend', handler);
      updateBbox(map);
    };
    const cleanup = () => {
      const map = mapRef.current;
      const handler = moveEndHandlerRef.current;
      if (map && handler) {
        map.off('moveend', handler);
      }
      mapRef.current = null;
      moveEndHandlerRef.current = null;
    };
    if (mapContext.map) {
      setup(mapContext.map);
      return cleanup;
    }
    mapContext.onMapReady(setup);
    return cleanup;
  }, [open, mapContext]);

  const fetchRoutes = useCallback((page: number) => {
    setLoading(true);
    const authorId = filter === 'my-routes' && user?.id ? user.id : undefined;
    getBrowseRoutes({
      bbox: bboxRef.current,
      page,
      per_page: PER_PAGE,
      sort: 'created_at',
      ...(authorId ? { author_id: authorId } : {}),
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
  }, [filter, user]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => fetchRoutes(1), 0);
    return () => clearTimeout(t);
  }, [open, bbox, fetchRoutes]);

  const handlePageChange = useCallback((page: number) => {
    fetchRoutes(page);
  }, [fetchRoutes]);

  const handleRouteClick = useCallback(
    (slug: string) => {
      if (onRouteSelect) {
        onRouteSelect(slug);
      } else {
        setSelectedRouteSlug((prev) => (prev === slug ? null : slug));
      }
    },
    [onRouteSelect]
  );

  const handleCreateRoute = useCallback(() => {
    if (isAuthenticated) {
      onClose();
      navigate('/routes/create', { state: { openDrawer: true, preserveViewport: true } });
    } else {
      navigate('/login?redirect=' + encodeURIComponent('/routes/create'));
    }
  }, [isAuthenticated, navigate, onClose]);

  if (!open) return null;

  return (
    <div
      role="complementary"
      aria-label="Explore routes"
      style={panelStyle}
    >
      <header style={headerStyle}>
        <h2 style={titleStyle}>Routes</h2>
        <button type="button" onClick={onClose} aria-label="Close" style={closeButtonStyle}>
          ×
        </button>
      </header>
      <div style={filtersRowStyle} data-slot="filters">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <button
            type="button"
            style={filterButtonStyle(filter === 'all')}
            onClick={() => setFilter('all')}
            aria-pressed={filter === 'all'}
          >
            All
          </button>
          {isAuthenticated && (
            <button
              type="button"
              style={filterButtonStyle(filter === 'my-routes')}
              onClick={() => setFilter('my-routes')}
              aria-pressed={filter === 'my-routes'}
            >
              My routes
            </button>
          )}
        </div>
        <button type="button" onClick={handleCreateRoute} style={createButtonStyle} data-slot="create-route">
          Create route
        </button>
      </div>
      <div style={listSlotStyle} data-slot="route-list">
        <RouteList
          routes={routes}
          pagination={pagination}
          loading={loading}
          onPageChange={handlePageChange}
          onRouteClick={handleRouteClick}
          highlightedRouteSlug={effectiveHighlightSlug}
          onRouteMouseEnter={(route) => setHoveredRouteSlug(route.slug)}
          onRouteMouseLeave={() => setHoveredRouteSlug(null)}
        />
      </div>
    </div>
  );
}
