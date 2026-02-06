/** Gallery of photos with lightbox. Click photo to open modal. */
import { useState, useEffect } from 'react';
import { PhotoImage } from './PhotoImage';

/** Minimal shape needed for gallery (id for image + caption). */
export interface GalleryPhoto {
  id: string;
  caption: string | null;
}

interface PhotoGalleryProps {
  photos: GalleryPhoto[];
  /** When a pin is focused from the map, highlight this photo and open in modal if set. */
  selectedPhotoId?: string | null;
  onSelectPhoto?: (photoId: string) => void;
}

export function PhotoGallery({ photos, selectedPhotoId = null, onSelectPhoto }: PhotoGalleryProps) {
  const [modalIndex, setModalIndex] = useState<number | null>(null);

  const selectedIndex = selectedPhotoId ? photos.findIndex((p) => p.id === selectedPhotoId) : -1;
  const effectiveSelectedIndex = selectedIndex >= 0 ? selectedIndex : null;

  useEffect(() => {
    if (effectiveSelectedIndex != null) setModalIndex(effectiveSelectedIndex);
  }, [effectiveSelectedIndex]);

  const openModal = (index: number) => {
    setModalIndex(index);
    onSelectPhoto?.(photos[index].id);
  };
  const closeModal = () => setModalIndex(null);

  if (photos.length === 0) {
    return <p style={{ color: '#666' }}>No photos yet.</p>;
  }

  return (
    <>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
        {photos.map((photo, index) => (
          <li
            key={photo.id}
            style={{
              width: 120,
              outline: effectiveSelectedIndex === index ? '2px solid #2563eb' : undefined,
              outlineOffset: 2,
              borderRadius: 4,
            }}
          >
            <button
              type="button"
              onClick={() => openModal(index)}
              style={{
                padding: 0,
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                width: '100%',
                overflow: 'hidden',
                background: '#eee',
              }}
            >
              <div style={{ aspectRatio: '1', width: '100%' }}>
                <PhotoImage
                  photoId={photo.id}
                  size="thumbnail"
                  alt={photo.caption ?? 'Photo'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </div>
            </button>
            {photo.caption && (
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', padding: 0 }}>{photo.caption}</p>
            )}
          </li>
        ))}
      </ul>

      {modalIndex != null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo lightbox"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={closeModal}
        >
          <button
            type="button"
            onClick={closeModal}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              background: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Close
          </button>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
          >
            <PhotoImage
              photoId={photos[modalIndex].id}
              size="original"
              alt={photos[modalIndex].caption ?? 'Photo'}
              style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain' }}
            />
            {photos[modalIndex].caption && (
              <p style={{ color: '#fff', margin: 0, fontSize: '0.875rem' }}>{photos[modalIndex].caption}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
