/** Route detail page. Fetch by slug, display map + gallery + metadata. */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getRouteBySlug } from '../api/routes';
import { RouteView } from '../components/routes/RouteView';
import type { RouteDetailResponse } from '../types/route';

export function RouteDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<RouteDetailResponse | null>(null);
  const [loading, setLoading] = useState(!!slug);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount: reset then load
    setLoading(true);
    setError(null);
    getRouteBySlug(slug)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) {
          const status = err.response?.status;
          const msg = err.response?.data?.error?.message ?? (status === 404 ? 'Route not found' : status === 403 ? 'This route is private.' : 'Failed to load route.');
          setError({ message: msg, status });
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

  if (error || !data) {
    const is404 = error?.status === 404;
    const is403 = error?.status === 403;
    return (
      <div style={{ padding: '2rem' }}>
        <h2 style={{ marginTop: 0 }}>{is404 ? 'Route not found' : is403 ? 'Private route' : 'Error'}</h2>
        <p>{error?.message ?? 'Route not found'}</p>
        <Link to="/">Home</Link>
      </div>
    );
  }

  const { route, photos } = data;

  return (
    <div style={{ padding: '2rem' }}>
      <p style={{ marginBottom: '1rem' }}>
        <Link to="/">Home</Link> / <Link to="/routes/create">Create route</Link>
      </p>
      <RouteView route={route} photos={photos} />
      <section style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Photos</h2>
        {photos.length === 0 ? (
          <p style={{ color: '#666' }}>No photos yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {photos.map((photo) => (
              <li key={photo.id} style={{ width: 120 }}>
                <div
                  style={{
                    aspectRatio: '1',
                    background: '#eee',
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    color: '#666',
                  }}
                >
                  Photo
                </div>
                {photo.caption && <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem' }}>{photo.caption}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
