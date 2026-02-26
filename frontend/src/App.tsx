import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { Loading } from './components/common/Loading';
import { Toast } from './components/common/Toast';
import { AccountIcon } from './components/common/AccountIcon';
import { DrawerMenu } from './components/common/DrawerMenu';
import { HighlightedRouteLayer } from './components/map/HighlightedRouteLayer';
import { MapShell } from './components/map/MapShell';
import { ExploreRoutesPanel } from './components/explore/ExploreRoutesPanel';
import { HighlightedRouteContext } from './contexts/HighlightedRouteContext';
import { RoutesPanelProvider, useRoutesPanel } from './contexts/RoutesPanelContext';
import { AuthCallback } from './pages/AuthCallback';
import { Browse } from './pages/Browse';
import { CreateRouteFromPhotos } from './pages/CreateRouteFromPhotos';
import { Login } from './pages/Login';
import { NotFound } from './pages/NotFound';
import { RouteDetail } from './pages/RouteDetail';
import { Settings } from './pages/Settings';
import './App.css';

function MapShellLayout() {
  const location = useLocation();
  const { slug } = useParams<{ slug: string }>();
  const routesPanel = useRoutesPanel();
  const pathname = location.pathname;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [highlightedRouteSlug, setHighlightedRouteSlug] = useState<string | null>(null);
  const [highlightedLayerReady, setHighlightedLayerReady] = useState(false);

  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) return;
    root.classList.add('map-first');
    return () => {
      root.classList.remove('map-first');
    };
  }, []);

  /** Sync highlight from URL when on /browse (e.g. initial load or back/forward). */
  useEffect(() => {
    if (pathname !== '/browse') return;
    setHighlightedRouteSlug(searchParams.get('route') || null);
  }, [pathname, searchParams]);

  /** Set highlighted route (panel hover/select). Update state immediately so HighlightedRouteLayer and fade respond; keep URL in sync for /browse?route=:slug. */
  const handleHighlightRoute = useCallback(
    (slug: string | null) => {
      setHighlightedRouteSlug(slug);
      if (pathname === '/browse') {
        if (slug) {
          setSearchParams({ route: slug }, { replace: true });
        } else {
          setSearchParams({}, { replace: true });
        }
      }
    },
    [pathname, setSearchParams]
  );

  /** Open route in drawer: close routes panel, navigate to /routes/:slug. Preserve map viewport for seamless transition. */
  const handleRouteSelect = useCallback(
    (routeSlug: string) => {
      routesPanel?.setRoutesPanelOpen(false);
      navigate(`/routes/${routeSlug}`, { state: { openDrawer: true, preserveViewport: true } });
    },
    [navigate, routesPanel]
  );

  useEffect(() => {
    if (!routesPanel?.routesPanelOpen) {
      setHighlightedRouteSlug(null);
      setHighlightedLayerReady(false);
      if (pathname === '/browse') setSearchParams({}, { replace: true });
    }
  }, [routesPanel?.routesPanelOpen, pathname, setSearchParams]);

  /** browse-photos = /browse (photo pins in bbox). /routes/me removed (Phase 7); My routes is panel filter only. */
  const mode =
    pathname === '/browse'
      ? 'browse-photos'
      : pathname === '/routes/create'
        ? 'create'
        : pathname.startsWith('/routes/') && slug
          ? 'detail'
          : 'home';

  const preserveViewport = !!(location.state as { preserveViewport?: boolean })?.preserveViewport;

  return (
    <HighlightedRouteContext.Provider value={{ highlightedRouteSlug, highlightedLayerReady }}>
      <MapShell mode={mode} slug={slug ?? null} preserveViewport={preserveViewport}>
        <Outlet />
        <HighlightedRouteLayer
          highlightedRouteSlug={highlightedRouteSlug}
          onHighlightedLayerReadyChange={setHighlightedLayerReady}
        />
        {routesPanel?.routesPanelOpen && (
          <ExploreRoutesPanel
            open
            onClose={() => routesPanel.setRoutesPanelOpen(false)}
            onHighlightRoute={handleHighlightRoute}
            onRouteSelect={handleRouteSelect}
          />
        )}
      </MapShell>
    </HighlightedRouteContext.Provider>
  );
}

function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <Loading />
        <p style={{ marginTop: '1rem' }}>Loading...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <RoutesPanelProvider>
        <DrawerMenu />
        <AccountIcon />
        <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route element={<MapShellLayout />}>
          <Route path="/" element={<Navigate to="/browse" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/routes/me" element={<Navigate to="/browse" replace />} />
          <Route
            path="/routes/create"
            element={
              <ProtectedRoute>
                <CreateRouteFromPhotos />
              </ProtectedRoute>
            }
          />
          <Route path="/routes/:slug" element={<RouteDetail />} />
        </Route>
        <Route path="*" element={<NotFound />} />
        </Routes>
        <Toast />
      </RoutesPanelProvider>
    </BrowserRouter>
  );
}

export default App;
