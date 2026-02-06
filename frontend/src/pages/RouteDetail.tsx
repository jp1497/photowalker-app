/** Route detail page. Fetch by slug, display map + gallery + metadata. */
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getRouteBySlug } from '../api/routes';
import { RouteView } from '../components/routes/RouteView';
import { PhotoGallery } from '../components/photos/PhotoGallery';
import { PhotoUploadForm } from '../components/photos/PhotoUploadForm';
import { useAuth } from '../hooks/useAuth';
import type { RouteDetailResponse } from '../types/route';

export function RouteDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { user, isAuthenticated } = useAuth();
  const [data, setData] = useState<RouteDetailResponse | null>(null);
  const [loading, setLoading] = useState(!!slug);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const refetch = useCallback(() => {
    if (!slug) return;
    getRouteBySlug(slug).then(setData);
  }, [slug]);

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
  const isOwner = isAuthenticated && user?.id === route.user_id;

  return (
    <div style={{ padding: '2rem' }}>
      <p style={{ marginBottom: '1rem' }}>
        <Link to="/">Home</Link> / <Link to="/routes/create">Create route</Link>
      </p>
      <RouteView
        route={route}
        photos={photos}
        selectedPhotoId={selectedPhotoId}
        onSelectPhoto={setSelectedPhotoId}
      />
      <section style={{ marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Photos</h2>
          {isOwner && (
            <button
              type="button"
              onClick={() => setShowUpload((v) => !v)}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', cursor: 'pointer' }}
            >
              {showUpload ? 'Cancel' : 'Add photos'}
            </button>
          )}
        </div>
        {showUpload && isOwner && (
          <div style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <PhotoUploadForm
              routeIds={[route.id]}
              onSuccess={() => {
                refetch();
                setShowUpload(false);
              }}
            />
          </div>
        )}
        <PhotoGallery
          photos={photos}
          selectedPhotoId={selectedPhotoId}
          onSelectPhoto={setSelectedPhotoId}
        />
      </section>
    </div>
  );
}
