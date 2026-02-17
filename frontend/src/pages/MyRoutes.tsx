/** My Routes: list in closable drawer over full-viewport map. */
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getMyRoutes } from '../api/routes';
import { Loading } from '../components/common/Loading';
import { useMapContext } from '../contexts/MapContext';
import type { Route } from '../types/route';

export function MyRoutes() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(true);

  const mapContext = useMapContext();
  const location = useLocation();
  const navigate = useNavigate();
  const isShellMap = !!mapContext;

  useEffect(() => {
    if (location.state && typeof location.state === 'object' && 'openDrawer' in location.state && location.state.openDrawer) {
      setDrawerOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getMyRoutes()
      .then((res) => {
        if (!cancelled) setRoutes(res.routes);
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = err.response?.data?.error?.message ?? (err instanceof Error ? err.message : 'Failed to load routes.');
          setError(msg);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [retryCount]);

  useEffect(() => {
    if (!isShellMap) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isShellMap]);

  const floatingButtonStyle = {
    position: 'absolute' as const,
    top: '3.5rem',
    left: '0.75rem',
    zIndex: 500,
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    background: 'rgba(255,255,255,0.95)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    cursor: 'pointer' as const,
    pointerEvents: 'auto' as const,
  };

  if (!isShellMap) {
    return (
      <div style={{ padding: '2rem' }}>
        <p style={{ marginBottom: '1rem' }}>
          <Link to="/">Home</Link> / <Link to="/routes/create">Create route</Link>
        </p>
        {loading && (
          <div style={{ textAlign: 'center' }}>
            <Loading label="Loading your routes..." />
          </div>
        )}
        {error && (
          <>
            <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setRetryCount((c) => c + 1)}>Retry</button>
              <Link to="/">Home</Link>
            </div>
          </>
        )}
        {!loading && !error && (
          <>
            <h1 style={{ fontSize: '1.5rem', marginTop: 0, marginBottom: '1rem' }}>My Routes</h1>
            {routes.length === 0 ? (
              <p style={{ color: '#666' }}>You have not created any routes yet.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {routes.map((route) => (
                  <li
                    key={route.id}
                    style={{
                      padding: '0.75rem',
                      marginBottom: '0.5rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: 4,
                      background: '#fafafa',
                    }}
                  >
                    <Link to={`/routes/${route.slug}`} style={{ fontWeight: 500, color: '#2563eb', textDecoration: 'none' }}>
                      {route.title}
                    </Link>
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
                      {(route.distance_meters / 1000).toFixed(2)} km
                      {route.tags.length > 0 && ` · ${route.tags.join(', ')}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
      {!drawerOpen && (
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          style={floatingButtonStyle}
          aria-label="Open my routes"
        >
          My Routes
        </button>
      )}
      {drawerOpen && (
        <>
          <div
            role="presentation"
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0, zIndex: 201, background: 'rgba(0,0,0,0.3)', pointerEvents: 'auto' }}
            onClick={() => setDrawerOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="My routes"
            style={{
              position: 'absolute',
              top: '3.5rem',
              left: '0.75rem',
              right: '0.75rem',
              width: 'min(400px, calc(100vw - 1.5rem))',
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ margin: 0, fontSize: '1rem' }}>My Routes</h2>
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close">×</button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0.75rem' }}>
              {loading && (
                <div style={{ textAlign: 'center', padding: '1rem' }}>
                  <Loading label="Loading your routes..." />
                </div>
              )}
              {error && (
                <div>
                  <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => setRetryCount((c) => c + 1)}>Retry</button>
                    <Link to="/browse" onClick={() => setDrawerOpen(false)}>Browse</Link>
                  </div>
                </div>
              )}
              {!loading && !error && (
                <>
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem' }}>
                    <Link to="/" onClick={() => setDrawerOpen(false)}>Home</Link>
                    {' · '}
                    <Link to="/routes/create" onClick={() => setDrawerOpen(false)}>Create route</Link>
                  </p>
                  {routes.length === 0 ? (
                    <p style={{ color: '#666' }}>You have not created any routes yet.</p>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {routes.map((route) => (
                        <li
                          key={route.id}
                          style={{
                            padding: '0.75rem',
                            marginBottom: '0.5rem',
                            border: '1px solid #e5e7eb',
                            borderRadius: 4,
                            background: '#fafafa',
                          }}
                        >
                          <Link
                            to={`/routes/${route.slug}`}
                            onClick={() => setDrawerOpen(false)}
                            style={{ fontWeight: 500, color: '#2563eb', textDecoration: 'none' }}
                          >
                            {route.title}
                          </Link>
                          <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
                            {(route.distance_meters / 1000).toFixed(2)} km
                            {route.tags.length > 0 && ` · ${route.tags.join(', ')}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
