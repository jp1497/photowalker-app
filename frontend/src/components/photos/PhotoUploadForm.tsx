/** Photo upload: file picker, caption, route association. If upload has no GPS, show place-on-map step. */
import { useState } from 'react';
import { uploadPhoto, updatePhoto } from '../../api/photos';
import { MapPicker } from '../map/MapPicker';
import { usePreferredMapCenter } from '../../hooks/usePreferredMapCenter';

const MAX_FILE_MB = 10;
const ACCEPT = 'image/jpeg,.jpg,.jpeg';

interface PhotoUploadFormProps {
  /** Route IDs to associate (e.g. current route when on route detail). */
  routeIds: string[];
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

/** Photo that needs a location set (upload succeeded but location is null). */
interface PhotoToPlace {
  id: string;
  caption: string | null;
}

export function PhotoUploadForm({ routeIds, onSuccess, onError }: PhotoUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoToPlace, setPhotoToPlace] = useState<PhotoToPlace | null>(null);
  const [pickedCoords, setPickedCoords] = useState<[number, number] | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const { center: mapCenter } = usePreferredMapCenter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || routeIds.length === 0) {
      setError('Select a photo and at least one route.');
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`Photo must be under ${MAX_FILE_MB}MB.`);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const { photo } = await uploadPhoto(file, routeIds, caption.trim() || null);
      setFile(null);
      setCaption('');
      if (photo.location == null || photo.location.coordinates == null || photo.location.coordinates.length < 2) {
        setPhotoToPlace({ id: photo.id, caption: photo.caption });
        setPickedCoords(null);
        setPlaceError(null);
      } else {
        onSuccess?.();
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        (err instanceof Error ? err.message : 'Upload failed');
      setError(msg);
      onError?.(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveLocation = async () => {
    if (!photoToPlace || !pickedCoords) return;
    setPlaceError(null);
    setSavingLocation(true);
    try {
      await updatePhoto(photoToPlace.id, {
        location: { type: 'Point', coordinates: pickedCoords },
      });
      setPhotoToPlace(null);
      setPickedCoords(null);
      onSuccess?.();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        (err instanceof Error ? err.message : 'Failed to save location');
      setPlaceError(msg);
      onError?.(msg);
    } finally {
      setSavingLocation(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 400 }}>
      <div>
        <label htmlFor="photo-file" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
          Photo (JPEG, max {MAX_FILE_MB}MB; GPS optional)
        </label>
        <input
          id="photo-file"
          type="file"
          accept={ACCEPT}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setError(null);
          }}
          style={{ display: 'block' }}
        />
      </div>
      <div>
        <label htmlFor="photo-caption" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
          Caption (optional)
        </label>
        <textarea
          id="photo-caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={2}
          maxLength={500}
          style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem' }}
        />
      </div>
      {routeIds.length > 0 && (
        <p style={{ fontSize: '0.875rem', color: '#666', margin: 0 }}>
          Photo will be added to {routeIds.length} route{routeIds.length !== 1 ? 's' : ''}.
        </p>
      )}
      {error && (
        <p style={{ color: '#b91c1c', fontSize: '0.875rem', margin: 0 }} role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={!file || uploading} style={{ padding: '0.5rem 1rem', cursor: file && !uploading ? 'pointer' : 'not-allowed' }}>
        {uploading ? 'Uploading…' : 'Upload'}
      </button>

      {photoToPlace && (
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
              This photo has no location. Click the map to set a position, then Save.
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
      )}
    </form>
  );
}
