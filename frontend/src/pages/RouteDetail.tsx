/** Route detail page. Fetch by slug, display route (minimal for Step 3.3; full map/gallery in 3.4). */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getRouteBySlug } from '../api/routes';
import type { Route } from '../types/route';

export function RouteDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [route, setRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(!!slug);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount: reset then load
    setLoading(true);
    setError(null);
    getRouteBySlug(slug)
      .then((res) => {
        if (!cancelled) {
          setRoute(res.route);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const status = err.response?.status;
          const msg = err.response?.data?.error?.message ?? (status === 404 ? 'Route not found' : status === 403 ? 'You do not have access to this route' : 'Failed to load route');
          setError(msg);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!slug) {
    return (
      <div style={{ padding: '2rem' }}>
        <p>Invalid route.</p>
        <Link to="/">Home</Link>
      </div>
    );
  }

  if (loading) {
    return <p style={{ padding: '2rem', textAlign: 'center' }}>Loading route...</p>;
  }

  if (error || !route) {
    return (
      <div style={{ padding: '2rem' }}>
        <p>{error ?? 'Route not found'}</p>
        <Link to="/">Home</Link>
      </div>
    );
  }

  const pointCount = route.route_geometry?.coordinates?.length ?? 0;

  return (
    <div style={{ padding: '2rem' }}>
      <p style={{ marginBottom: '1rem' }}>
        <Link to="/">Home</Link> / <Link to="/routes/create">Create route</Link>
      </p>
      <h1>{route.title}</h1>
      <p style={{ color: '#666' }}>Slug: {route.slug}</p>
      {route.description && <p>{route.description}</p>}
      <p>Distance: {(route.distance_meters / 1000).toFixed(2)} km</p>
      <p>Points: {pointCount}</p>
      {route.tags.length > 0 && <p>Tags: {route.tags.join(', ')}</p>}
      <p>{route.is_public ? 'Public' : 'Private'}</p>
    </div>
  );
}
