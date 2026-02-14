/** My Routes page. Lists current user's routes with links to detail. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyRoutes } from '../api/routes';
import { Loading } from '../components/common/Loading';
import type { Route } from '../types/route';

export function MyRoutes() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset then fetch on mount/retry
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
    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <Loading label="Loading your routes..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem' }}>
        <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setRetryCount((c) => c + 1)}>
            Retry
          </button>
          <Link to="/">Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <p style={{ marginBottom: '1rem' }}>
        <Link to="/">Home</Link> / <Link to="/routes/create">Create route</Link>
      </p>
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
    </div>
  );
}
