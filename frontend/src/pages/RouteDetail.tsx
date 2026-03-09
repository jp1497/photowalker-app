/** Route detail page. Map full viewport; metadata and gallery in shared BottomDrawer (PRD v6 FR-U4). */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { updatePhoto, reorderRoutePhotos } from '../api/photos';
import { getRouteBySlug, updateRoute, deleteRoute } from '../api/routes';
import { RouteEditForm } from '../components/routes/RouteEditForm';
import { ReorderablePhotoList } from '../components/photos/ReorderablePhotoList';
import { toastStore } from '../store/toastStore';
import type { RouteUpdatePayload, RouteDetailPhoto } from '../types/route';
import type { ReorderablePhoto } from '../components/photos/ReorderablePhotoList';
import { BottomDrawer } from '../components/common/BottomDrawer';
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
  const location = useLocation();
  const navigate = useNavigate();
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
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editPhotos, setEditPhotos] = useState<RouteDetailPhoto[]>([]);
  const preserveViewport = !!(location.state as { preserveViewport?: boolean })?.preserveViewport;
  const { center: mapCenter } = usePreferredMapCenter();
  const isShellMap = !!mapContext;
  const detailsPanelRef = useRef<HTMLDivElement>(null);
  const editLocationModalRef = useRef<HTMLDivElement>(null);

  useFocusTrap(detailsPanelRef, {
    active: isShellMap && !editingPhotoId,
  });

  useFocusTrap(editLocationModalRef, { active: !!editingPhotoId });

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

  useEffect(() => {
    if (isEditMode && data) {
      setEditPhotos([...data.photos]);
    }
  }, [isEditMode, data]);

  useEffect(() => {
    if (!isShellMap) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingPhotoId) {
          setEditingPhotoId(null);
          setEditLocationCoords(null);
          setEditLocationError(null);
        } else if (isEditMode) {
          setIsEditMode(false);
        } else {
          navigate('/browse');
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isShellMap, editingPhotoId, isEditMode, navigate]);

  if (!slug) {
    return (
      <div style={{ padding: '2rem' }}>
        <p>Invalid route.</p>
        <Link to="/">Home</Link>
      </div>
    );
  }

  if (loading) {
    return isShellMap ? (
      <div
        style={{
          position: 'absolute',
          top: '5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '0.5rem 1rem',
          background: 'rgba(255,255,255,0.95)',
          borderRadius: 6,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          pointerEvents: 'auto',
          zIndex: 100,
        }}
      >
        <Loading label="Loading route..." />
      </div>
    ) : (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <Loading label="Loading route..." />
      </div>
    );
  }

  if (error || !data) {
    const is404 = error?.status === 404;
    const is403 = error?.status === 403;
    const canRetry = !is404 && !is403;
    return isShellMap ? (
      <div
        style={{
          position: 'absolute',
          top: '5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '1rem 1.5rem',
          background: 'rgba(255,255,255,0.98)',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          pointerEvents: 'auto',
          zIndex: 500,
          maxWidth: 'calc(100vw - 2rem)',
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: '1.125rem' }}>{is404 ? 'Route not found' : is403 ? 'Private route' : 'Error'}</h2>
        <p style={{ marginBottom: '1rem' }}>{error?.message ?? 'Route not found'}</p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {canRetry && (
            <button type="button" onClick={retry}>
              Retry
            </button>
          )}
          <Link to="/browse">Browse</Link>
        </div>
      </div>
    ) : (
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

  const handleSaveMetadata = async (patch: RouteUpdatePayload) => {
    if (!data) return;
    setIsSaving(true);
    try {
      await updateRoute(data.route.id, patch);
      await refetch();
      setIsEditMode(false);
    } catch {
      toastStore.getState().add('Failed to save changes', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReorder = async (reordered: ReorderablePhoto[]) => {
    if (!data) return;
    const prev = editPhotos;
    const reorderedFull = reordered.map(
      (r) => editPhotos.find((p) => p.id === r.id)!
    );
    setEditPhotos(reorderedFull);
    try {
      await reorderRoutePhotos(data.route.id, reordered.map((p) => p.id));
      void refetch();
    } catch {
      setEditPhotos(prev);
      toastStore.getState().add('Failed to save photo order', 'error');
    }
  };

  const handleDelete = async () => {
    if (!data) return;
    setIsDeleting(true);
    try {
      await deleteRoute(data.route.id);
      navigate('/browse');
    } catch {
      toastStore.getState().add('Failed to delete route', 'error');
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!isShellMap) {
    return (
      <div style={{ padding: '2rem' }}>
        <p style={{ marginBottom: '1rem' }}>
          <Link to="/">Home</Link> / <Link to="/routes/create">Create route</Link>
        </p>
        {editingPhotoId && (
          <div
            ref={editLocationModalRef}
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span />
          {isOwner && !isEditMode && (
            <button
              type="button"
              aria-label="Edit route"
              onClick={() => { setIsEditMode(true); setShowUpload(false); }}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', cursor: 'pointer' }}
            >
              Edit
            </button>
          )}
        </div>
        {isEditMode ? (
          <RouteEditForm
            route={route}
            onSave={handleSaveMetadata}
            onCancel={() => setIsEditMode(false)}
            isSaving={isSaving}
          />
        ) : (
          <RouteView route={route} photos={photos} selectedPhotoId={selectedPhotoId} onSelectPhoto={setSelectedPhotoId} preserveViewport={isShellMap && preserveViewport} />
        )}
        <section style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Photos</h2>
            {isOwner && !isEditMode && (
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
          {showUpload && isOwner && !isEditMode && (
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
          {isEditMode ? (
            <ReorderablePhotoList
              photos={editPhotos}
              onChange={handleReorder}
            />
          ) : (
            <PhotoGallery
              photos={photos}
              selectedPhotoId={selectedPhotoId}
              onSelectPhoto={setSelectedPhotoId}
              isOwner={isOwner}
              onEditLocation={isOwner ? (photoId) => { setEditingPhotoId(photoId); setEditLocationError(null); } : undefined}
            />
          )}
          {isEditMode && isOwner && (
            <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    background: '#fee2e2',
                    color: '#b91c1c',
                    border: '1px solid #fca5a5',
                    borderRadius: 6,
                  }}
                >
                  Delete route
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.875rem', color: '#b91c1c' }}>Delete this route permanently?</span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem',
                      cursor: isDeleting ? 'not-allowed' : 'pointer',
                      background: '#b91c1c',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                    }}
                  >
                    {isDeleting ? 'Deleting…' : 'Yes, delete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      {/* Map layers stay mounted so pins remain visible when the drawer is closed. */}
      <RouteView
        route={route}
        photos={photos}
        selectedPhotoId={selectedPhotoId}
        onSelectPhoto={setSelectedPhotoId}
        preserveViewport={isShellMap && preserveViewport}
        mapOnly
      />
      <BottomDrawer
        open
        onClose={() => navigate('/browse')}
        title={route.title}
        initialExpanded={!!(location.state as { openDrawer?: boolean })?.openDrawer}
      >
        <div ref={detailsPanelRef} style={{ padding: '0 1rem 1rem' }}>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem' }}>
            <Link to="/">Home</Link> / <Link to="/browse">Browse</Link>
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span />
            {isOwner && !isEditMode && (
              <button
                type="button"
                aria-label="Edit route"
                onClick={() => { setIsEditMode(true); setShowUpload(false); }}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', cursor: 'pointer' }}
              >
                Edit
              </button>
            )}
          </div>
          {isEditMode ? (
            <RouteEditForm
              route={route}
              onSave={handleSaveMetadata}
              onCancel={() => setIsEditMode(false)}
              isSaving={isSaving}
            />
          ) : (
            <RouteView route={route} photos={photos} selectedPhotoId={selectedPhotoId} onSelectPhoto={setSelectedPhotoId} contentOnly />
          )}
          <section style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Photos</h2>
              {isOwner && !isEditMode && (
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
            {showUpload && isOwner && !isEditMode && (
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
            {isEditMode ? (
              <ReorderablePhotoList
                photos={editPhotos}
                onChange={handleReorder}
              />
            ) : (
              <PhotoGallery
                photos={photos}
                selectedPhotoId={selectedPhotoId}
                onSelectPhoto={setSelectedPhotoId}
                isOwner={isOwner}
                onEditLocation={isOwner ? (photoId) => { setEditingPhotoId(photoId); setEditLocationError(null); } : undefined}
              />
            )}
            {isEditMode && isOwner && (
              <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                {!showDeleteConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      background: '#fee2e2',
                      color: '#b91c1c',
                      border: '1px solid #fca5a5',
                      borderRadius: 6,
                    }}
                  >
                    Delete route
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.875rem', color: '#b91c1c' }}>Delete this route permanently?</span>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isDeleting}
                      style={{
                        padding: '0.5rem 1rem',
                        fontSize: '0.875rem',
                        cursor: isDeleting ? 'not-allowed' : 'pointer',
                        background: '#b91c1c',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                      }}
                    >
                      {isDeleting ? 'Deleting…' : 'Yes, delete'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={isDeleting}
                      style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </BottomDrawer>
      {editingPhotoId && (
        <div
          ref={editLocationModalRef}
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
            pointerEvents: 'auto',
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
    </div>
  );
}
