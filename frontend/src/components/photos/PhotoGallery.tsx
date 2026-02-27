/** Gallery of photos with lightbox. Click photo to open modal. Reused for browse single-photo view. */
import { useState, useEffect, useRef } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { PhotoImage } from './PhotoImage';

/** Minimal shape needed for gallery (id for image + caption). */
export interface GalleryPhoto {
  id: string;
  caption: string | null;
}

/** Optional context for lightbox (e.g. browse: user name and routes containing the photo). */
export interface PhotoGalleryLightboxContext {
  user?: { id: string; name: string };
  routes?: { slug: string; title?: string }[];
  onOpenRoute?: (slug: string) => void;
}

interface PhotoGalleryProps {
  photos: GalleryPhoto[];
  /** When a pin is focused from the map, highlight this photo and open in modal if set. */
  selectedPhotoId?: string | null;
  onSelectPhoto?: (photoId: string) => void;
  /** If true, show "Edit location" in the lightbox (route owner). */
  isOwner?: boolean;
  /** Called when user chooses to edit this photo's location. */
  onEditLocation?: (photoId: string) => void;
  /** When false, do not render the thumbnail grid (lightbox-only mode, e.g. browse). */
  showGrid?: boolean;
  /** Optional user and routes for lightbox; when onOpenRoute is set, show "Open route" links. */
  lightboxContext?: PhotoGalleryLightboxContext | null;
  /** Called when the lightbox is closed (e.g. to clear selection and return focus). */
  onClose?: () => void;
  /** Ref for element to receive focus when lightbox closes (e.g. map or pin trigger). */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

export function PhotoGallery({
  photos,
  selectedPhotoId = null,
  onSelectPhoto,
  isOwner,
  onEditLocation,
  showGrid = true,
  lightboxContext,
  onClose,
  returnFocusRef,
}: PhotoGalleryProps) {
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);

  const closeModal = () => {
    setModalIndex(null);
    onClose?.();
  };

  useFocusTrap(lightboxRef, { active: modalIndex != null, returnFocusRef });

  useEffect(() => {
    if (modalIndex == null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalIndex(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [modalIndex]);

  const selectedIndex = selectedPhotoId ? photos.findIndex((p) => p.id === selectedPhotoId) : -1;
  const effectiveSelectedIndex = selectedIndex >= 0 ? selectedIndex : null;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync modal to selected photo from map
    if (effectiveSelectedIndex != null) setModalIndex(effectiveSelectedIndex);
  }, [effectiveSelectedIndex]);

  const openModal = (index: number) => {
    setModalIndex(index);
    onSelectPhoto?.(photos[index].id);
  };

  if (photos.length === 0) {
    if (!showGrid) return null;
    return <p style={{ color: '#666' }}>No photos yet.</p>;
  }

  const ctx = lightboxContext;
  const hasOpenRoute = !!(ctx?.routes?.length && ctx?.onOpenRoute);

  return (
    <>
      {showGrid && (
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
      )}

      {modalIndex != null && (
        <div
          ref={lightboxRef}
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
            zIndex: 1001,
            pointerEvents: 'auto',
          }}
          onClick={closeModal}
        >
          <div style={{ position: 'absolute', top: 16, right: '4rem', display: 'flex', gap: '0.5rem' }}>
            {isOwner && onEditLocation && (
              <button
                type="button"
                onClick={() => onEditLocation(photos[modalIndex].id)}
                style={{
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '0.5rem 1rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Edit location
              </button>
            )}
            <button
              type="button"
              onClick={closeModal}
              style={{
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
          </div>
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
            {(ctx?.user?.name || hasOpenRoute) && (
              <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.875rem' }}>
                {ctx?.user?.name && <p style={{ margin: '0 0 0.25rem' }}>{ctx.user.name}</p>}
                {hasOpenRoute && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {ctx!.routes!.map((r) => (
                      <button
                        key={r.slug}
                        type="button"
                        onClick={() => ctx!.onOpenRoute!(r.slug)}
                        style={{
                          background: 'transparent',
                          color: '#93c5fd',
                          border: '1px solid rgba(147,197,253,0.6)',
                          borderRadius: 4,
                          padding: '0.25rem 0.5rem',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                        }}
                      >
                        Open route{r.title ? `: ${r.title}` : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
