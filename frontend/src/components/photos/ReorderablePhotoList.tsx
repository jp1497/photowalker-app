/** Drag-and-drop + button reorderable photo list for route edit mode. */
import { useRef, useState } from 'react';
import { PhotoImage } from './PhotoImage';

export interface ReorderablePhoto {
  id: string;
  caption: string | null;
}

interface ReorderablePhotoListProps {
  photos: ReorderablePhoto[];
  /** Called with new ordered list after any reorder. */
  onChange: (photos: ReorderablePhoto[]) => void;
}

export function ReorderablePhotoList({ photos, onChange }: ReorderablePhotoListProps) {
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [reorderAnnouncement, setReorderAnnouncement] = useState('');

  const move = (from: number, to: number) => {
    if (from === to) return;
    const next = [...photos];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
    setReorderAnnouncement(
      `Moved photo to position ${to + 1} of ${photos.length}`
    );
  };

  if (photos.length === 0) {
    return <p style={{ color: '#666' }}>No photos yet.</p>;
  }

  return (
    <div>
      <div
        aria-live="polite"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          borderWidth: 0,
        }}
      >
        {reorderAnnouncement}
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {photos.map((photo, index) => (
          <li
            key={photo.id}
            draggable
            onDragStart={() => { dragIndex.current = index; }}
            onDragOver={(e) => { e.preventDefault(); setDragOverIndex(index); }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDragOverIndex(null);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIndex.current !== null) move(dragIndex.current, index);
              dragIndex.current = null;
              setDragOverIndex(null);
            }}
            onDragEnd={() => { dragIndex.current = null; setDragOverIndex(null); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.5rem',
              background: dragOverIndex === index ? '#eff6ff' : '#fafafa',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              cursor: 'grab',
              userSelect: 'none',
            }}
          >
            {/* Drag handle */}
            <span
              aria-hidden="true"
              style={{ color: '#9ca3af', fontSize: '1.25rem', flexShrink: 0, cursor: 'grab' }}
            >
              ⠿
            </span>
            <div style={{ width: 56, height: 56, flexShrink: 0, borderRadius: 4, overflow: 'hidden', background: '#eee' }}>
              <PhotoImage
                photoId={photo.id}
                size="thumbnail"
                alt={photo.caption ?? 'Photo'}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>
            <span style={{ flex: 1, fontSize: '0.875rem', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {photo.caption ?? <em style={{ color: '#9ca3af' }}>No caption</em>}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', flexShrink: 0 }}>
              <button
                type="button"
                aria-label="Move photo up"
                disabled={index === 0}
                onClick={() => move(index, index - 1)}
                style={{
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.75rem',
                  cursor: index === 0 ? 'not-allowed' : 'pointer',
                  opacity: index === 0 ? 0.4 : 1,
                  border: '1px solid #d1d5db',
                  borderRadius: 3,
                  background: '#fff',
                }}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label="Move photo down"
                disabled={index === photos.length - 1}
                onClick={() => move(index, index + 1)}
                style={{
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.75rem',
                  cursor: index === photos.length - 1 ? 'not-allowed' : 'pointer',
                  opacity: index === photos.length - 1 ? 0.4 : 1,
                  border: '1px solid #d1d5db',
                  borderRadius: 3,
                  background: '#fff',
                }}
              >
                ↓
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
