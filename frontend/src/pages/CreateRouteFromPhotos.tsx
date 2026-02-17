/** Photo-first create route: upload photos, place on map, reorder, submit to POST /v1/routes/from-photos. PRD v3 FR-R1. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import { MapView } from '../components/map/MapView';
import { MapPicker } from '../components/map/MapPicker';
import { createPhotoMarkerElement } from '../components/map/PhotoMarker';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { useMapContext } from '../contexts/MapContext';
import { uploadPhoto, updatePhoto, getPhotoImageUrl } from '../api/photos';
import { apiClient } from '../api/client';
import { createRouteFromPhotos } from '../api/routes';
import { usePreferredMapCenter } from '../hooks/usePreferredMapCenter';
import type { Photo } from '../types/photo';
import type { RouteFromPhotosPayload } from '../types/route';

const MAX_FILE_MB = 10;
const ACCEPT = 'image/jpeg,.jpg,.jpeg';
const TITLE_MIN = 1;
const TITLE_MAX = 100;
const MAX_TAGS = 5;
const MAX_PHOTOS = 50;

const ROUTE_PREVIEW_SOURCE_ID = 'route-preview-line';
const ROUTE_PREVIEW_LAYER_ID = 'route-preview-line-layer';

function getBoundsFromCoords(coords: [number, number][]): [[number, number], [number, number]] {
  if (coords.length === 0) return [[-122.42, 37.78], [-122.4, 37.8]];
  let minLng = coords[0][0];
  let maxLng = coords[0][0];
  let minLat = coords[0][1];
  let maxLat = coords[0][1];
  for (let i = 1; i < coords.length; i++) {
    const [lng, lat] = coords[i];
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  const pad = 0.002;
  return [[minLng - pad, minLat - pad], [maxLng + pad, maxLat + pad]];
}

/** Fetches thumbnail (with auth), creates object URL, reports to parent. Parent owns URL so it survives reorder. */
function ThumbnailLoader({
  photoId,
  onLoaded,
  style,
}: {
  photoId: string;
  onLoaded: (photoId: string, url: string) => void;
  style: React.CSSProperties;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const opts = { responseType: 'blob' as const, signal: controller.signal };
    const attach = (res: { data: Blob }) => {
      const objectUrl = URL.createObjectURL(res.data);
      setUrl(objectUrl);
      onLoaded(photoId, objectUrl);
    };
    apiClient
      .get(getPhotoImageUrl(photoId, 'thumbnail'), opts)
      .then(attach)
      .catch(() => apiClient.get(getPhotoImageUrl(photoId, 'original'), opts).then(attach))
      .catch(() => setUrl(null));
    return () => controller.abort();
  }, [photoId, onLoaded]);

  if (!url) {
    return (
      <div style={{ ...style, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '0.75rem' }}>
        Loading…
      </div>
    );
  }
  return <img src={url} alt="" style={style} />;
}

export function CreateRouteFromPhotos() {
  const navigate = useNavigate();
  const location = useLocation();
  const { center: mapCenter } = usePreferredMapCenter();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [photoToPlace, setPhotoToPlace] = useState<Photo | null>(null);
  const [pickedCoords, setPickedCoords] = useState<[number, number] | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const thumbnailUrlsRef = useRef<Record<string, string>>({});
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const mapRef = useRef<maplibregl.Map | null>(null);
  thumbnailUrlsRef.current = thumbnailUrls;

  const handleThumbnailLoaded = useCallback((photoId: string, url: string) => {
    setThumbnailUrls((prev) => ({ ...prev, [photoId]: url }));
  }, []);

  const tags = tagsInput
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, MAX_TAGS);

  const coordinates = photos
    .map((p) => p.location?.coordinates)
    .filter((c): c is number[] => c != null && c.length >= 2) as [number, number][] | [];
  const hasLine = coordinates.length >= 2;

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length || photos.length >= MAX_PHOTOS) return;
      setUploadError(null);
      setUploading(true);
      const toAdd: Photo[] = [];
      for (let i = 0; i < files.length && photos.length + toAdd.length < MAX_PHOTOS; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/jpeg') || file.size > MAX_FILE_MB * 1024 * 1024) continue;
        try {
          const { photo } = await uploadPhoto(file, [], null);
          toAdd.push(photo);
        } catch (err: unknown) {
          const msg =
            (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
            (err instanceof Error ? err.message : 'Upload failed');
          setUploadError(msg);
          break;
        }
      }
      setPhotos((prev) => [...prev, ...toAdd]);
      setUploading(false);
    },
    [photos.length]
  );

  const handleSaveLocation = useCallback(async () => {
    if (!photoToPlace || !pickedCoords) return;
    setPlaceError(null);
    setSavingLocation(true);
    try {
      const updated = await updatePhoto(photoToPlace.id, {
        location: { type: 'Point', coordinates: pickedCoords },
      });
      setPhotos((prev) => prev.map((p) => (p.id === photoToPlace.id ? updated : p)));
      setPhotoToPlace(null);
      setPickedCoords(null);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        (err instanceof Error ? err.message : 'Failed to save location');
      setPlaceError(msg);
    } finally {
      setSavingLocation(false);
    }
  }, [photoToPlace, pickedCoords]);

  const movePhoto = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setPhotos((prev) => {
      const next = [...prev];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);
      return next;
    });
  }, []);

  const handleDragStart = (index: number) => setDraggedIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex == null) return;
    if (draggedIndex !== index) movePhoto(draggedIndex, index);
    setDraggedIndex(index);
  };
  const handleDragEnd = () => setDraggedIndex(null);

  const removePhoto = useCallback((photoId: string) => {
    setThumbnailUrls((prev) => {
      const url = prev[photoId];
      if (url) URL.revokeObjectURL(url);
      const next = { ...prev };
      delete next[photoId];
      return next;
    });
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    if (photoToPlace?.id === photoId) setPhotoToPlace(null);
  }, [photoToPlace?.id]);

  const updateMap = useCallback(
    (map: maplibregl.Map) => {
      markersRef.current.forEach((m) => {
        try {
          m.remove();
        } catch {
          /* defensive */
        }
      });
      markersRef.current = [];

      if (hasLine) {
        if (map.getSource(ROUTE_PREVIEW_SOURCE_ID)) {
          (map.getSource(ROUTE_PREVIEW_SOURCE_ID) as maplibregl.GeoJSONSource).setData({
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates },
          });
        } else {
          map.addSource(ROUTE_PREVIEW_SOURCE_ID, {
            type: 'geojson',
            data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } },
          });
          map.addLayer({
            id: ROUTE_PREVIEW_LAYER_ID,
            type: 'line',
            source: ROUTE_PREVIEW_SOURCE_ID,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#2563eb', 'line-width': 4 },
          });
        }
        try {
          map.fitBounds(getBoundsFromCoords(coordinates), { padding: 40, maxZoom: 14, duration: 300 });
        } catch {
          /* bounds may be invalid */
        }
      }

      coordinates.forEach(([lng, lat]) => {
        const el = createPhotoMarkerElement();
        const marker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
        markersRef.current.push(marker);
      });
    },
    [coordinates, hasLine]
  );

  const handleMapReady = useCallback(
    (map: maplibregl.Map) => {
      mapRef.current = map;
      updateMap(map);
    },
    [updateMap]
  );

  const mapContext = useMapContext();

  useEffect(() => {
    if (!mapContext) return;
    mapContext.onMapReady(handleMapReady);
  }, [mapContext, handleMapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (map) updateMap(map);
  }, [updateMap]);

  useEffect(() => {
    return () => {
      const map = mapRef.current;
      markersRef.current.forEach((m) => {
        try {
          m.remove();
        } catch {
          /* ignore */
        }
      });
      markersRef.current = [];
      if (map) {
        try {
          if (map.getLayer(ROUTE_PREVIEW_LAYER_ID)) map.removeLayer(ROUTE_PREVIEW_LAYER_ID);
          if (map.getSource(ROUTE_PREVIEW_SOURCE_ID)) map.removeSource(ROUTE_PREVIEW_SOURCE_ID);
        } catch {
          /* defensive teardown */
        }
      }
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      Object.values(thumbnailUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);
      const trimmedTitle = title.trim();
      if (trimmedTitle.length < TITLE_MIN) {
        setSubmitError('Title is required');
        return;
      }
      if (trimmedTitle.length > TITLE_MAX) {
        setSubmitError(`Title must be ${TITLE_MAX} characters or less`);
        return;
      }
      const withLocation = photos.filter(
        (p) => p.location?.coordinates && p.location.coordinates.length >= 2
      );
      if (withLocation.length < 2) {
        setSubmitError('Add at least 2 photos with locations. Place any missing photos on the map.');
        return;
      }
      const payload: RouteFromPhotosPayload = {
        title: trimmedTitle,
        description: description.trim() || null,
        tags,
        is_public: isPublic,
        photo_ids: photos.map((p) => p.id),
      };
      setIsSubmitting(true);
      try {
        const { route } = await createRouteFromPhotos(payload);
        navigate(`/routes/${route.slug}`, { replace: true });
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
          (err instanceof Error ? err.message : 'Failed to create route');
        setSubmitError(msg);
      } finally {
        setIsSubmitting(false);
      }
    },
    [title, description, tags, isPublic, photos, navigate]
  );

  const photosWithoutLocation = photos.filter(
    (p) => !p.location?.coordinates || p.location.coordinates.length < 2
  );
  const isShellMap = !!mapContext;

  useEffect(() => {
    if (location.state && typeof location.state === 'object' && 'openDrawer' in location.state && location.state.openDrawer) {
      setDrawerOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (!isShellMap) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !photoToPlace) setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isShellMap, photoToPlace]);

  const drawerTop = '6rem';
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

  const createContent = (
    <>
      <p style={{ color: '#666', marginBottom: '1.5rem' }}>
        Upload photos, place them on the map if needed, reorder to define the route, then add a title and create.
      </p>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>1. Upload photos</h2>
        <input
          type="file"
          accept={ACCEPT}
          multiple
          disabled={uploading || photos.length >= MAX_PHOTOS}
          onChange={(e) => handleFiles(e.target.files)}
          data-testid="create-route-from-photos-upload"
        />
        {photos.length >= MAX_PHOTOS && (
          <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
            Maximum {MAX_PHOTOS} photos.
          </p>
        )}
        {uploadError && (
          <p style={{ color: '#b91c1c', fontSize: '0.875rem', marginTop: '0.5rem' }} role="alert">
            {uploadError}
          </p>
        )}
      </section>

      {photos.length > 0 && (
        <>
          <section style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>2. Order and map</h2>
            <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
              Drag to reorder. Route is drawn through photos in this order. Photos without a location need to be placed on the map.
            </p>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
              data-testid="create-route-from-photos-list"
            >
              {photos.map((photo, index) => {
                const hasLoc =
                  photo.location?.coordinates && photo.location.coordinates.length >= 2;
                return (
                  <li
                    key={photo.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.5rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: 6,
                      background: draggedIndex === index ? '#f3f4f6' : '#fff',
                      cursor: 'grab',
                    }}
                  >
                    <span style={{ fontWeight: 500, minWidth: '1.5rem' }}>{index + 1}</span>
                    {thumbnailUrls[photo.id] ? (
                      <img
                        src={thumbnailUrls[photo.id]}
                        alt=""
                        style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }}
                      />
                    ) : (
                      <ThumbnailLoader
                        photoId={photo.id}
                        onLoaded={handleThumbnailLoaded}
                        style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }}
                      />
                    )}
                    <span style={{ flex: 1, fontSize: '0.875rem' }}>
                      {photo.caption || (hasLoc ? 'Has location' : 'No location')}
                    </span>
                    {!hasLoc && (
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoToPlace(photo);
                          setPickedCoords(null);
                          setPlaceError(null);
                        }}
                        style={{
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                          background: '#2563eb',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 6,
                        }}
                      >
                        Set location
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removePhoto(photo.id)}
                      aria-label="Remove photo"
                      style={{
                        padding: '0.25rem',
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        background: 'transparent',
                        border: '1px solid #d1d5db',
                        borderRadius: 4,
                        color: '#6b7280',
                      }}
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
            {!isShellMap && (
              <div
                style={{ height: 280, border: '1px solid #ccc', borderRadius: 4, overflow: 'hidden', marginTop: '0.75rem' }}
                data-testid="create-route-from-photos-map"
              >
                <MapView
                  center={mapCenter}
                  zoom={12}
                  onMapReady={handleMapReady}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
            )}
            {isShellMap && (
              <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
                Map is behind this panel. Reorder and place photos; the route preview updates on the map.
              </p>
            )}
          </section>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.125rem', marginBottom: '0.25rem' }}>3. Route details</h2>
            <Input
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Route name"
              maxLength={TITLE_MAX}
              data-testid="create-route-from-photos-title-input"
            />
            <Input
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
            <Input
              label="Tags (comma-separated, max 5)"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. urban, sunset"
            />
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
                Public (visible to everyone)
              </label>
            </div>
            {submitError && (
              <p style={{ color: '#b91c1c', fontSize: '0.875rem', margin: 0 }} role="alert">
                {submitError}
              </p>
            )}
            <Button
              type="submit"
              loading={isSubmitting}
              disabled={photosWithoutLocation.length > 0 || photos.length < 2}
              data-testid="create-route-from-photos-submit"
            >
              Create route
            </Button>
            {photosWithoutLocation.length > 0 && photos.length >= 2 && (
              <p style={{ fontSize: '0.875rem', color: '#b45309', margin: 0 }}>
                Place {photosWithoutLocation.length} photo(s) on the map before creating.
              </p>
            )}
          </form>
        </>
      )}
    </>
  );

  const placePhotoModal = photoToPlace ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Place photo on map"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        pointerEvents: 'auto',
      }}
      onClick={(e) => e.target === e.currentTarget && setPlaceError(null)}
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
        <h3 style={{ margin: 0, fontSize: '1.125rem' }}>Place photo on map</h3>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>
          Click the map to set this photo&apos;s location, then Save.
        </p>
        <div style={{ height: 320, border: '1px solid #ccc', borderRadius: 4, overflow: 'hidden' }}>
          <MapPicker
            initialCenter={mapCenter}
            onSelect={setPickedCoords}
            style={{ height: '100%' }}
          />
        </div>
        {pickedCoords && (
          <p style={{ margin: 0, fontSize: '0.875rem', fontFamily: 'monospace' }}>
            Selected: [{pickedCoords[0].toFixed(5)}, {pickedCoords[1].toFixed(5)}]
          </p>
        )}
        {placeError && (
          <p style={{ color: '#b91c1c', fontSize: '0.875rem', margin: 0 }} role="alert">
            {placeError}
          </p>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => {
              setPhotoToPlace(null);
              setPickedCoords(null);
              setPlaceError(null);
            }}
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveLocation}
            disabled={!pickedCoords || savingLocation}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              cursor: pickedCoords && !savingLocation ? 'pointer' : 'not-allowed',
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
  ) : null;

  if (!isShellMap) {
    return (
      <div style={{ padding: '2rem', maxWidth: 720, margin: '0 auto' }}>
        <h1 data-testid="create-route-from-photos-title">Create route from photos</h1>
        {createContent}
        {placePhotoModal}
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
          aria-label="Open create route"
        >
          Create route
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
            aria-label="Create route"
            style={{
              position: 'absolute',
              top: drawerTop,
              left: '0.75rem',
              right: '0.75rem',
              bottom: '0.75rem',
              width: 'min(480px, calc(100vw - 1.5rem))',
              maxHeight: 'calc(100vh - 6.75rem)',
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
              <h2 style={{ margin: 0, fontSize: '1rem' }}>Create route</h2>
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close">×</button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '1rem' }}>
              <h1 data-testid="create-route-from-photos-title" style={{ fontSize: '1.25rem', margin: '0 0 0.5rem' }}>Create route from photos</h1>
              {createContent}
            </div>
          </div>
        </>
      )}
      {placePhotoModal}
    </div>
  );
}
