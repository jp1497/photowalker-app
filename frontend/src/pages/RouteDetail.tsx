/** Route detail page. Fetch by slug, display map + gallery + metadata. */
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { updatePhoto } from '../api/photos';
import { getRouteBySlug } from '../api/routes';
import { Loading } from '../components/common/Loading';
import { useMapContext } from '../contexts/MapContext';
import { MapPanel } from '../components/map/MapPanel';
import { MapPicker } from '../components/map/MapPicker';
import { RouteView } from '../components/routes/RouteView';
import { PhotoGallery } from '../components/photos/PhotoGallery';
import { PhotoUploadForm } from '../components/photos/PhotoUploadForm';
import { useAuth } from '../hooks/useAuth';
import { usePreferredMapCenter } from '../hooks/usePreferredMapCenter';
import type { RouteDetailResponse } from '../types/route';

export function RouteDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { user, isAuthenticated } = useAuth();
  const mapContext = useMapContext();
  const [data, setData] = useState<RouteDetailResponse | null>(null);
  const [loading, setLoading] = useState(!!slug);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [editLocationCoords, setEditLocationCoords] = useState<[number, number] | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);
  const [editLocationError, setEditLocationError] = useState<string | null>(null);
  const { center: mapCenter } = usePreferredMapCenter();
  const isShellMap = !!mapContext;

  useEffect(() => {
    if (!data) return;
    const photo = editingPhotoId ? data.photos.find((p) => p.id === editingPhotoId) : null;
    if (photo?.location?.coordinates?.length === 2) {
      setEditLocationCoords(photo.location.coordinates as [number, number]);
    } else {
      setEditLocationCoords(null);
    }
  }, [editingPhotoId, data]);

  const retry = useCallback(() => {
    if (!slug) return;
    setError(null);
    setLoading(true);
    getRouteBySlug(slug)
      .then(setData)
      .catch((err) => {
        const status = err.response?.status;
        const msg = err.response?.data?.error?.message ?? (status === 404 ? 'Route not found' : status === 403 ? 'This route is private.' : 'Failed to load route.');
        setError({ message: msg, status });
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const refetch = useCallback(() => {
    if (!slug) return;
    getRouteBySlug(slug).then(setData);
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
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
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <Loading label="Loading route..." />
      </div>
    );
  }

  if (error || !data) {
    const is404 = error?.status === 404;
    const is403 = error?.status === 403;
    const canRetry = !is404 && !is403;
    return (
      <div style={{ padding: '2rem' }}>
        <h2 style={{ marginTop: 0 }}>{is404 ? 'Route not found' : is403 ? 'Private route' : 'Error'}</h2>
        <p style={{ marginBottom: '1rem' }}>{error?.message ?? 'Route not found'}</p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {canRetry && (
            <button type="button" onClick={retry}>
              Retry
            </button>
          )}
          <Link to="/">Home</Link>
        </div>
      </div>
    );
  }

  const { route, photos } = data;
  const isOwner = isAuthenticated && user?.id === route.user_id;
  const editingPhoto = editingPhotoId ? photos.find((p) => p.id === editingPhotoId) : null;
  const editMapCenter = (editingPhoto?.location?.coordinates?.length === 2
    ? (editingPhoto.location.coordinates as [number, number])
    : mapCenter) as [number, number];

  const handleSaveEditLocation = async () => {
    if (!editingPhotoId || !editLocationCoords) return;
    setEditLocationError(null);
    setSavingLocation(true);
    try {
      await updatePhoto(editingPhotoId, {
        location: { type: 'Point', coordinates: editLocationCoords },
      });
      refetch();
      setEditingPhotoId(null);
      setEditLocationCoords(null);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        (err instanceof Error ? err.message : 'Failed to save location');
      setEditLocationError(msg);
    } finally {
      setSavingLocation(false);
    }
  };

  return (
    <div
      style={
        isShellMap
          ? {
              position: 'absolute',
              top: '3.5rem',
              left: '0.75rem',
              right: '0.75rem',
              maxWidth: 420,
              maxHeight: 'calc(100vh - 5rem)',
              overflow: 'auto',
              background: 'rgba(255,255,255,0.98)',
              padding: '1rem',
              borderRadius: 8,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              zIndex: 100,
            }
          : { padding: '2rem' }
      }
    >
      <p style={{ marginBottom: '1rem' }}>
        <Link to="/">Home</Link> / <Link to="/routes/create">Create route</Link>
      </p>
      {editingPhotoId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit photo location"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
          }}
          onClick={(e) => e.target === e.currentTarget && setEditLocationError(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 8,
              padding: '1rem',
              width: '90vw',
              maxWidth: 560,
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1.125rem' }}>Edit photo location</h3>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>
              Click the map to set the photo&apos;s location, then Save.
            </p>
            <MapPanel>
              <MapPicker
                initialCenter={editMapCenter}
                onSelect={setEditLocationCoords}
                style={{ height: '100%' }}
              />
            </MapPanel>
            {editLocationCoords && (
              <p style={{ margin: 0, fontSize: '0.875rem', fontFamily: 'monospace' }}>
                Selected: [{editLocationCoords[0].toFixed(5)}, {editLocationCoords[1].toFixed(5)}]
              </p>
            )}
            {editLocationError && (
              <p style={{ color: '#b91c1c', fontSize: '0.875rem', margin: 0 }} role="alert">
                {editLocationError}
              </p>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setEditingPhotoId(null);
                  setEditLocationCoords(null);
                  setEditLocationError(null);
                }}
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditLocation}
                disabled={!editLocationCoords || savingLocation}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  cursor: editLocationCoords && !savingLocation ? 'pointer' : 'not-allowed',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 500,
                }}
              >
                {savingLocation ? 'Saving…' : 'Save location'}
              </button>
            </div>
          </div>
        </div>
      )}
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
              data-testid="route-detail-add-photos"
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
          isOwner={isOwner}
          onEditLocation={isOwner ? (photoId) => { setEditingPhotoId(photoId); setEditLocationError(null); } : undefined}
        />
      </section>
    </div>
  );
}
