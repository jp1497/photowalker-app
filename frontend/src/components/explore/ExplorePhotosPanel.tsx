/** Photos panel: user's own photo library list with upload button. Mirrors ExploreRoutesPanel structure. */
import { useCallback, useEffect, useState } from 'react';
import { getMyPhotosInBbox, fetchPhotoImageBlob } from '../../api/photos';
import { useMapContext } from '../../contexts/MapContext';
import { useRoutesPanel } from '../../contexts/RoutesPanelContext';
import { NAV_RAIL_WIDTH } from '../common/DrawerMenu';
import type { PhotoBrowseItem } from '../../types/photo';

const PANEL_Z_INDEX = 999;
const PANEL_WIDTH = '30rem';
const PER_PAGE = 50;

export interface ExplorePhotosPanelProps {
  open: boolean;
  onClose: () => void;
  onUpload: () => void;
}

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: NAV_RAIL_WIDTH,
  bottom: 0,
  width: PANEL_WIDTH,
  maxWidth: 'min(320px, calc(100vw - 80px))',
  zIndex: PANEL_Z_INDEX,
  display: 'flex',
  flexDirection: 'column',
  background: '#fff',
  borderRight: '1px solid #e5e7eb',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.75rem 1rem',
  borderBottom: '1px solid #e5e7eb',
  flexShrink: 0,
};

const filtersRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  padding: '0.75rem 1rem',
  borderBottom: '1px solid #e5e7eb',
  flexShrink: 0,
};

const uploadButtonStyle: React.CSSProperties = {
  padding: '0.35rem 0.75rem',
  fontWeight: 600,
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '0.875rem',
};

const listStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
  padding: '0.5rem',
};

const emptyStyle: React.CSSProperties = {
  padding: '2rem 1rem',
  textAlign: 'center',
  color: '#6b7280',
  fontSize: '0.875rem',
};

export function ExplorePhotosPanel({ open, onClose, onUpload }: ExplorePhotosPanelProps) {
  const map = useMapContext()?.map ?? null;
  const routesPanel = useRoutesPanel();
  const photoLibraryVersion = routesPanel?.photoLibraryVersion ?? 0;
  const [photos, setPhotos] = useState<PhotoBrowseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [mapVersion, setMapVersion] = useState(0);

  const getBboxFromMap = useCallback((): string | null => {
    if (!map) return null;
    const b = map.getBounds();
    return `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`;
  }, [map]);

  // Track map movement - setState called from event handler, not effect body
  useEffect(() => {
    if (!map) return;
    const onMoveEnd = () => setMapVersion(v => v + 1);
    map.on('moveend', onMoveEnd);
    return () => { map.off('moveend', onMoveEnd); };
  }, [map]);

  // Fetch photos when panel opens, map moves, or library updates
  useEffect(() => {
    if (!open) return;
    const bbox = getBboxFromMap();
    if (!bbox) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      getMyPhotosInBbox(bbox, 1, PER_PAGE)
        .then((res) => { if (!cancelled) setPhotos(res.photos); })
        .catch(() => { if (!cancelled) setPhotos([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
    });
    return () => { cancelled = true; };
  }, [open, getBboxFromMap, mapVersion, photoLibraryVersion]);

  useEffect(() => {
    if (photos.length === 0) return;
    let cancelled = false;
    const urlsToRevoke: string[] = [];
    photos.forEach((p) => {
      fetchPhotoImageBlob(p.id, 'thumbnail')
        .then((blob) => {
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          urlsToRevoke.push(url);
          setThumbnailUrls((prev) => ({ ...prev, [p.id]: url }));
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
      urlsToRevoke.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [photos]);

  if (!open) return null;

  return (
    <div role="complementary" aria-label="Photos" style={panelStyle}>
      <header style={headerStyle}>
        <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>Photos</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{ background: 'none', border: 'none', padding: '0.25rem', cursor: 'pointer', fontSize: '1.25rem', color: '#374151', lineHeight: 1 }}
        >
          ×
        </button>
      </header>
      <div style={filtersRowStyle}>
        <button type="button" onClick={onUpload} style={uploadButtonStyle}>
          Upload photos
        </button>
      </div>
      <div style={listStyle}>
        {loading && <p style={emptyStyle}>Loading…</p>}
        {!loading && photos.length === 0 && (
          <p style={emptyStyle}>No photos yet. Upload some!</p>
        )}
        {!loading && photos.length > 0 && (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {photos.map((p) => (
              <li
                key={p.id}
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', borderRadius: 6, background: '#f9fafb' }}
              >
                <div style={{ width: 48, height: 48, flexShrink: 0, borderRadius: 4, overflow: 'hidden', background: '#e5e7eb' }}>
                  {thumbnailUrls[p.id] && (
                    <img
                      src={thumbnailUrls[p.id]}
                      alt={p.caption ?? ''}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.caption ?? <span style={{ color: '#9ca3af' }}>No caption</span>}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
