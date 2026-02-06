/** Photo upload: file picker, caption, route association. */
import { useState } from 'react';
import { uploadPhoto } from '../../api/photos';

const MAX_FILE_MB = 10;
const ACCEPT = 'image/jpeg,.jpg,.jpeg';

interface PhotoUploadFormProps {
  /** Route IDs to associate (e.g. current route when on route detail). */
  routeIds: string[];
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

export function PhotoUploadForm({ routeIds, onSuccess, onError }: PhotoUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      await uploadPhoto(file, routeIds, caption.trim() || null);
      setFile(null);
      setCaption('');
      onSuccess?.();
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

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 400 }}>
      <div>
        <label htmlFor="photo-file" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
          Photo (JPEG, max {MAX_FILE_MB}MB, must contain GPS)
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
    </form>
  );
}
