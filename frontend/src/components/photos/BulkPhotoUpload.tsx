/** Bulk photo upload: multi-file JPEG picker, per-file status, no route association. */
import { useState } from 'react';
import { uploadPhoto } from '../../api/photos';

const ACCEPT = 'image/jpeg,.jpg,.jpeg';

type FileStatus = 'queued' | 'uploading' | 'done' | 'error';

interface FileEntry {
  file: File;
  status: FileStatus;
}

interface BulkPhotoUploadProps {
  onDone: () => void;
}

export function BulkPhotoUpload({ onDone }: BulkPhotoUploadProps) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [allDone, setAllDone] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setEntries(files.map((file) => ({ file, status: 'queued' })));
    setAllDone(false);
  };

  const setStatus = (index: number, status: FileStatus) => {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, status } : e)));
  };

  const handleUpload = async () => {
    if (entries.length === 0 || uploading) return;
    setUploading(true);
    let successCount = 0;
    for (let i = 0; i < entries.length; i++) {
      setStatus(i, 'uploading');
      try {
        await uploadPhoto(entries[i].file, [], null);
        setStatus(i, 'done');
        successCount++;
      } catch {
        setStatus(i, 'error');
      }
    }
    setUploading(false);
    if (successCount > 0) setAllDone(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
      <div>
        <label
          htmlFor="bulk-photo-input"
          style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}
        >
          Select photos (JPEG)
        </label>
        <input
          id="bulk-photo-input"
          type="file"
          accept={ACCEPT}
          multiple
          onChange={handleFileChange}
          disabled={uploading}
        />
      </div>
      <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
        Photos without GPS won't appear as map pins but will still be saved to your library.
      </p>
      {entries.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {entries.map((entry, i) => (
            <li key={`${entry.file.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {entry.file.name}
              </span>
              <span style={{ color: statusColor(entry.status), flexShrink: 0 }}>
                {statusLabel(entry.status)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={handleUpload}
          disabled={entries.length === 0 || uploading}
          style={{
            padding: '0.5rem 1rem',
            fontWeight: 600,
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: entries.length > 0 && !uploading ? 'pointer' : 'not-allowed',
            opacity: entries.length === 0 || uploading ? 0.6 : 1,
          }}
        >
          {uploading ? 'Uploading\u2026' : 'Upload'}
        </button>
        {allDone && (
          <button
            type="button"
            onClick={onDone}
            style={{
              padding: '0.5rem 1rem',
              fontWeight: 600,
              background: '#16a34a',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}

function statusLabel(status: FileStatus): string {
  switch (status) {
    case 'queued': return 'Queued';
    case 'uploading': return 'Uploading\u2026';
    case 'done': return 'Done';
    case 'error': return 'Failed';
  }
}

function statusColor(status: FileStatus): string {
  switch (status) {
    case 'queued': return '#6b7280';
    case 'uploading': return '#2563eb';
    case 'done': return '#16a34a';
    case 'error': return '#b91c1c';
  }
}
