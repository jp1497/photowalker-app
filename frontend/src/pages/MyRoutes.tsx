/** My Routes page. Lists current user's routes with links to detail. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyRoutes } from '../api/routes';
import type { Route } from '../types/route';

export function MyRoutes() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p style={{ padding: '2rem', textAlign: 'center' }}>Loading your routes...</p>;
  }

  if (error) {
    return (
      <div style={{ padding: '2rem' }}>
        <p style={{ color: '#b91c1c' }}>{error}</p>
        <Link to="/">Home</Link>
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
