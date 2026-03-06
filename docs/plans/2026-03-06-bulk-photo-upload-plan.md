# Bulk Photo Upload & My Photos Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let authenticated users upload batches of JPEGs into their personal photo library (independent of routes) and see them as map pins, with a "My photos" toggle on /browse and a dedicated Photos side panel.

**Architecture:** Seven sequential tasks. Each task is self-contained with a failing test first. New context state (`photosPanelOpen`, `uploadDrawerOpen`) is plumbed from `RoutesPanelContext` into `MapShellLayout` → `DrawerMenu` → new components. The Browse map toggle switches the bbox API call between `GET /v1/photos` and `GET /v1/photos/my`.

**Tech Stack:** React 19, TypeScript, Vitest + Testing Library, Axios (via `apiClient`), MapLibre GL, Zustand

---

### Task 1: Add `getMyPhotosInBbox` to the photos API

**Files:**
- Modify: `frontend/src/api/photos.ts`
- Modify: `frontend/src/api/photos.test.ts`

**Step 1: Write the failing test**

Open `frontend/src/api/photos.test.ts`. Add this test inside the existing `describe('photos API', ...)` block:

```ts
it('getMyPhotosInBbox calls GET /v1/photos/my with bbox and pagination params', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({
    data: { photos: [], pagination: { page: 1, per_page: 20, total: 0 } },
  });

  await getMyPhotosInBbox('-122.5,37.7,-122.3,37.9', 2, 30);

  expect(apiClient.get).toHaveBeenCalledWith('/v1/photos/my', {
    params: { bbox: '-122.5,37.7,-122.3,37.9', page: 2, per_page: 30 },
  });
});
```

Also update the import at line 4 to add `getMyPhotosInBbox`:

```ts
import { uploadPhoto, getPhotoImageUrl, getRoutePhotos, updatePhoto, getMyPhotosInBbox } from './photos';
```

**Step 2: Run test to verify it fails**

```bash
cd frontend && npm run test -- photos.test.ts
```

Expected: FAIL — `getMyPhotosInBbox is not a function`

**Step 3: Implement `getMyPhotosInBbox`**

In `frontend/src/api/photos.ts`, after the existing `getPhotosInBbox` function (after line 53), add:

```ts
/** Browse current user's own photos in viewport (bbox). Auth required. */
export async function getMyPhotosInBbox(
  bbox: string,
  page = 1,
  per_page = 50
): Promise<PhotosBrowseResponse> {
  const { data } = await apiClient.get<PhotosBrowseResponse>('/v1/photos/my', {
    params: { bbox, page, per_page },
  });
  return data;
}
```

**Step 4: Run test to verify it passes**

```bash
cd frontend && npm run test -- photos.test.ts
```

Expected: all tests PASS

**Step 5: Commit**

```bash
git add frontend/src/api/photos.ts frontend/src/api/photos.test.ts
git commit -m "feat(frontend): add getMyPhotosInBbox API function"
```

---

### Task 2: Extend `RoutesPanelContext` with photos panel and upload drawer state

**Files:**
- Modify: `frontend/src/contexts/RoutesPanelContext.tsx`

There are no dedicated tests for the context itself — it's covered by the DrawerMenu and App tests in later tasks. Make the change directly.

**Step 1: Replace the content of `frontend/src/contexts/RoutesPanelContext.tsx`**

```tsx
/** Context for nav panel open states: routes panel, photos panel, upload drawer. */
import { createContext, useContext, useState, type ReactNode } from 'react';

export interface RoutesPanelContextValue {
  routesPanelOpen: boolean;
  setRoutesPanelOpen: (open: boolean) => void;
  photosPanelOpen: boolean;
  setPhotosPanelOpen: (open: boolean) => void;
  uploadDrawerOpen: boolean;
  setUploadDrawerOpen: (open: boolean) => void;
}

const RoutesPanelContext = createContext<RoutesPanelContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components -- hook and provider are co-located by design.
export function useRoutesPanel(): RoutesPanelContextValue | null {
  return useContext(RoutesPanelContext);
}

export interface RoutesPanelProviderProps {
  children: ReactNode;
}

export function RoutesPanelProvider({ children }: RoutesPanelProviderProps) {
  const [routesPanelOpen, setRoutesPanelOpen] = useState(false);
  const [photosPanelOpen, setPhotosPanelOpen] = useState(false);
  const [uploadDrawerOpen, setUploadDrawerOpen] = useState(false);
  return (
    <RoutesPanelContext.Provider
      value={{
        routesPanelOpen,
        setRoutesPanelOpen,
        photosPanelOpen,
        setPhotosPanelOpen,
        uploadDrawerOpen,
        setUploadDrawerOpen,
      }}
    >
      {children}
    </RoutesPanelContext.Provider>
  );
}
```

**Step 2: Run all tests to confirm nothing broke**

```bash
cd frontend && npm run test
```

Expected: all existing tests PASS (the context is additive — existing consumers only use `routesPanelOpen`)

**Step 3: Commit**

```bash
git add frontend/src/contexts/RoutesPanelContext.tsx
git commit -m "feat(frontend): extend RoutesPanelContext with photos panel and upload drawer state"
```

---

### Task 3: Create `BulkPhotoUpload` component

**Files:**
- Create: `frontend/src/components/photos/BulkPhotoUpload.tsx`
- Create: `frontend/src/components/photos/BulkPhotoUpload.test.tsx`

**Step 1: Write the failing tests**

Create `frontend/src/components/photos/BulkPhotoUpload.test.tsx`:

```tsx
/** Unit tests for BulkPhotoUpload: multi-file upload, per-file status, done callback. */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulkPhotoUpload } from './BulkPhotoUpload';
import * as photosApi from '../../api/photos';

vi.mock('../../api/photos');

describe('BulkPhotoUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders file input and upload button', () => {
    render(<BulkPhotoUpload onDone={() => {}} />);
    expect(screen.getByLabelText(/select photos/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /upload/i })).toBeTruthy();
  });

  it('upload button is disabled when no files selected', () => {
    render(<BulkPhotoUpload onDone={() => {}} />);
    expect((screen.getByRole('button', { name: /upload/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows file names after selection', async () => {
    render(<BulkPhotoUpload onDone={() => {}} />);
    const input = screen.getByLabelText(/select photos/i);
    const file = new File(['x'], 'sunset.jpg', { type: 'image/jpeg' });
    await userEvent.upload(input, [file]);
    expect(screen.getByText('sunset.jpg')).toBeTruthy();
  });

  it('uploads each file with empty route_ids and calls onDone when done is clicked', async () => {
    const mockUpload = vi.mocked(photosApi.uploadPhoto);
    mockUpload.mockResolvedValue({
      photo: {
        id: 'p1', caption: null, user_id: 'u1',
        location: { type: 'Point', coordinates: [-122, 37] },
        s3_key_original: 'k', s3_key_thumbnail: null,
        file_size_bytes: 1, captured_at: null, created_at: '', updated_at: '',
      },
    });
    const onDone = vi.fn();
    render(<BulkPhotoUpload onDone={onDone} />);

    const input = screen.getByLabelText(/select photos/i);
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    await userEvent.upload(input, [file]);
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));

    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalledWith(file, [], null);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /done/i })).toBeTruthy();
    });

    await userEvent.click(screen.getByRole('button', { name: /done/i }));
    expect(onDone).toHaveBeenCalled();
  });

  it('shows error status for failed uploads', async () => {
    vi.mocked(photosApi.uploadPhoto).mockRejectedValue(new Error('Server error'));
    render(<BulkPhotoUpload onDone={() => {}} />);

    const input = screen.getByLabelText(/select photos/i);
    const file = new File(['x'], 'bad.jpg', { type: 'image/jpeg' });
    await userEvent.upload(input, [file]);
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed/i)).toBeTruthy();
    });
  });

  it('shows GPS note', () => {
    render(<BulkPhotoUpload onDone={() => {}} />);
    expect(screen.getByText(/without gps/i)).toBeTruthy();
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd frontend && npm run test -- BulkPhotoUpload.test.tsx
```

Expected: FAIL — `BulkPhotoUpload is not a function`

**Step 3: Implement `BulkPhotoUpload`**

Create `frontend/src/components/photos/BulkPhotoUpload.tsx`:

```tsx
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
    for (let i = 0; i < entries.length; i++) {
      setStatus(i, 'uploading');
      try {
        await uploadPhoto(entries[i].file, [], null);
        setStatus(i, 'done');
      } catch {
        setStatus(i, 'error');
      }
    }
    setUploading(false);
    setAllDone(true);
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
            <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
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
          {uploading ? 'Uploading…' : 'Upload'}
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
    case 'uploading': return 'Uploading…';
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
```

**Step 4: Run tests to verify they pass**

```bash
cd frontend && npm run test -- BulkPhotoUpload.test.tsx
```

Expected: all tests PASS

**Step 5: Commit**

```bash
git add frontend/src/components/photos/BulkPhotoUpload.tsx frontend/src/components/photos/BulkPhotoUpload.test.tsx
git commit -m "feat(frontend): add BulkPhotoUpload component"
```

---

### Task 4: Create `ExplorePhotosPanel` component

**Files:**
- Create: `frontend/src/components/explore/ExplorePhotosPanel.tsx`
- Create: `frontend/src/components/explore/ExplorePhotosPanel.test.tsx`

**Step 1: Write the failing tests**

Create `frontend/src/components/explore/ExplorePhotosPanel.test.tsx`:

```tsx
/** Unit tests for ExplorePhotosPanel: photo list, upload button, close. */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExplorePhotosPanel } from './ExplorePhotosPanel';
import * as photosApi from '../../api/photos';
import { useAuth } from '../../hooks/useAuth';
import { useMapContext } from '../../contexts/MapContext';

vi.mock('../../api/photos');
vi.mock('../../hooks/useAuth');
vi.mock('../../contexts/MapContext');

describe('ExplorePhotosPanel', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'u1', email: 'a@b.co', name: 'User', avatar_url: null, created_at: '' },
      isAuthenticated: true,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(useMapContext).mockReturnValue({ map: null, onMapReady: vi.fn() });
    vi.mocked(photosApi.getMyPhotosInBbox).mockResolvedValue({
      photos: [],
      pagination: { page: 1, per_page: 20, total: 0 },
    });
    vi.mocked(photosApi.fetchPhotoImageBlob).mockResolvedValue(new Blob());
  });

  it('does not render when open is false', () => {
    render(<ExplorePhotosPanel open={false} onClose={() => {}} onUpload={() => {}} />);
    expect(screen.queryByRole('complementary')).toBeFalsy();
  });

  it('renders panel with header, empty state, and Upload photos button when open', async () => {
    render(<ExplorePhotosPanel open onClose={() => {}} onUpload={() => {}} />);
    await waitFor(() => {
      expect(screen.getByRole('complementary', { name: /photos/i })).toBeTruthy();
    });
    expect(screen.getByText('Photos')).toBeTruthy();
    expect(screen.getByRole('button', { name: /upload photos/i })).toBeTruthy();
    expect(screen.getByText(/no photos/i)).toBeTruthy();
  });

  it('calls getMyPhotosInBbox on open', async () => {
    render(<ExplorePhotosPanel open onClose={() => {}} onUpload={() => {}} />);
    await waitFor(() => {
      expect(vi.mocked(photosApi.getMyPhotosInBbox)).toHaveBeenCalled();
    });
  });

  it('renders a photo list item for each photo returned', async () => {
    vi.mocked(photosApi.getMyPhotosInBbox).mockResolvedValue({
      photos: [
        {
          id: 'p1', caption: 'Sunset', user: { id: 'u1', name: 'User' },
          route_ids: [], image_url: '/v1/photos/p1/image',
          location: { type: 'Point', coordinates: [-122, 37] },
        },
      ],
      pagination: { page: 1, per_page: 20, total: 1 },
    });
    render(<ExplorePhotosPanel open onClose={() => {}} onUpload={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Sunset')).toBeTruthy();
    });
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    render(<ExplorePhotosPanel open onClose={onClose} onUpload={() => {}} />);
    await waitFor(() => screen.getByRole('complementary', { name: /photos/i }));
    await userEvent.click(screen.getByRole('button', { name: /^close$/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onUpload when Upload photos button is clicked', async () => {
    const onUpload = vi.fn();
    render(<ExplorePhotosPanel open onClose={() => {}} onUpload={onUpload} />);
    await waitFor(() => screen.getByRole('button', { name: /upload photos/i }));
    await userEvent.click(screen.getByRole('button', { name: /upload photos/i }));
    expect(onUpload).toHaveBeenCalled();
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd frontend && npm run test -- ExplorePhotosPanel.test.tsx
```

Expected: FAIL — `ExplorePhotosPanel is not a function`

**Step 3: Implement `ExplorePhotosPanel`**

Create `frontend/src/components/explore/ExplorePhotosPanel.tsx`:

```tsx
/** Photos panel: user's own photo library list with upload button. Mirrors ExploreRoutesPanel structure. */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { getMyPhotosInBbox, fetchPhotoImageBlob } from '../../api/photos';
import { useMapContext } from '../../contexts/MapContext';
import { NAV_RAIL_WIDTH } from '../common/DrawerMenu';
import type { PhotoBrowseItem } from '../../types/photo';

const PANEL_Z_INDEX = 999;
const PANEL_WIDTH = '30rem';
const PER_PAGE = 20;
const DEFAULT_BBOX = '-122.44,37.77,-122.30,37.81';

export interface ExplorePhotosPanelProps {
  open: boolean;
  onClose: () => void;
  onUpload: () => void;
}

function boundsToBbox(bounds: { getSouthWest(): { lng: number; lat: number }; getNorthEast(): { lng: number; lat: number } }): string {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return [sw.lng, sw.lat, ne.lng, ne.lat].join(',');
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
  const mapContext = useMapContext();
  const [photos, setPhotos] = useState<PhotoBrowseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [bbox, setBbox] = useState(DEFAULT_BBOX);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const bboxRef = useRef(bbox);
  const mapRef = useRef<MapLibreMap | null>(null);
  const moveEndHandlerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    bboxRef.current = bbox;
  }, [bbox]);

  useEffect(() => {
    if (!open || !mapContext) return;
    const updateBbox = (map: MapLibreMap) => setBbox(boundsToBbox(map.getBounds()));
    const setup = (map: MapLibreMap) => {
      mapRef.current = map;
      const handler = () => updateBbox(map);
      moveEndHandlerRef.current = handler;
      map.on('moveend', handler);
      updateBbox(map);
    };
    const cleanup = () => {
      const map = mapRef.current;
      const handler = moveEndHandlerRef.current;
      if (map && handler) map.off('moveend', handler);
      mapRef.current = null;
      moveEndHandlerRef.current = null;
    };
    if (mapContext.map) {
      setup(mapContext.map);
      return cleanup;
    }
    mapContext.onMapReady(setup);
    return cleanup;
  }, [open, mapContext]);

  const fetchPhotos = useCallback(() => {
    setLoading(true);
    getMyPhotosInBbox(bboxRef.current, 1, PER_PAGE)
      .then((res) => setPhotos(res.photos))
      .catch(() => setPhotos([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(fetchPhotos, 0);
    return () => clearTimeout(t);
  }, [open, bbox, fetchPhotos]);

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
          <p style={emptyStyle}>No photos in this area yet. Upload some!</p>
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
```

**Step 4: Run tests to verify they pass**

```bash
cd frontend && npm run test -- ExplorePhotosPanel.test.tsx
```

Expected: all tests PASS

**Step 5: Commit**

```bash
git add frontend/src/components/explore/ExplorePhotosPanel.tsx frontend/src/components/explore/ExplorePhotosPanel.test.tsx
git commit -m "feat(frontend): add ExplorePhotosPanel component"
```

---

### Task 5: Update `DrawerMenu` to add "Photos" button

**Files:**
- Modify: `frontend/src/components/common/DrawerMenu.tsx`
- Modify: `frontend/src/components/common/DrawerMenu.test.tsx`

**Step 1: Write the failing tests**

Add these two tests to the existing `describe('DrawerMenu', ...)` block in `frontend/src/components/common/DrawerMenu.test.tsx`:

```tsx
// Update the existing test that checks "only Browse and Routes" to allow Photos:
// Change: 'shows persistent nav with only Browse and Routes'
// To: 'shows persistent nav with Browse, Routes, and Photos when authenticated'
// And add two new tests below:

it('does not show Photos button when not authenticated', () => {
  // DrawerMenu reads useRoutesPanel which uses RoutesPanelContext. useAuth must be mocked.
  // DrawerMenu.tsx will need to import useAuth. For this test, no auth mock means Photos is hidden.
  render(
    <MemoryRouter>
      <RoutesPanelProvider>
        <DrawerMenu />
      </RoutesPanelProvider>
    </MemoryRouter>,
  );
  expect(screen.queryByRole('button', { name: /^photos$/i })).toBeFalsy();
});

it('Photos button opens the photos panel when authenticated', async () => {
  // This requires useAuth to be mocked in DrawerMenu — add the mock at the top of the file.
  // See Step 3 for the full updated test file.
  const panel = useRoutesPanel as unknown as ReturnType<typeof vi.fn>;
  // tested via PanelIndicator pattern below
});
```

The test file needs a broader rewrite to accommodate the new `useAuth` dependency. Replace `frontend/src/components/common/DrawerMenu.test.tsx` with:

```tsx
/** Unit tests for DrawerMenu: Browse, Routes, and Photos (auth-gated) nav buttons. */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DrawerMenu } from './DrawerMenu';
import { RoutesPanelProvider, useRoutesPanel } from '../../contexts/RoutesPanelContext';
import { useAuth } from '../../hooks/useAuth';

vi.mock('../../hooks/useAuth');

function PanelIndicator() {
  const panel = useRoutesPanel();
  return (
    <>
      {panel?.routesPanelOpen && <span data-testid="routes-panel-open">Open</span>}
      {panel?.photosPanelOpen && <span data-testid="photos-panel-open">Open</span>}
    </>
  );
}

describe('DrawerMenu', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: null, isAuthenticated: false, loading: false, login: vi.fn(), logout: vi.fn(),
    });
  });

  it('shows Browse and Routes when not authenticated; no Photos', () => {
    render(
      <MemoryRouter>
        <RoutesPanelProvider>
          <DrawerMenu />
        </RoutesPanelProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('navigation', { name: /navigation/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^browse$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^routes$/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^photos$/i })).toBeFalsy();
  });

  it('shows Photos button when authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'u1', email: 'a@b.co', name: 'User', avatar_url: null, created_at: '' },
      isAuthenticated: true, loading: false, login: vi.fn(), logout: vi.fn(),
    });
    render(
      <MemoryRouter>
        <RoutesPanelProvider>
          <DrawerMenu />
        </RoutesPanelProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: /^photos$/i })).toBeTruthy();
  });

  it('Browse navigates to /browse', async () => {
    render(
      <MemoryRouter initialEntries={['/other']}>
        <RoutesPanelProvider>
          <DrawerMenu />
          <Routes>
            <Route path="/other" element={<span data-testid="other">Other</span>} />
            <Route path="/browse" element={<span data-testid="browse">Browse</span>} />
          </Routes>
        </RoutesPanelProvider>
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: /^browse$/i }));
    expect(screen.getByTestId('browse')).toBeTruthy();
  });

  it('Routes opens the Routes panel', async () => {
    render(
      <MemoryRouter>
        <RoutesPanelProvider>
          <DrawerMenu />
          <PanelIndicator />
        </RoutesPanelProvider>
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('routes-panel-open')).toBeFalsy();
    await userEvent.click(screen.getByRole('button', { name: /^routes$/i }));
    expect(screen.getByTestId('routes-panel-open')).toBeTruthy();
  });

  it('Photos opens the Photos panel when authenticated', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'u1', email: 'a@b.co', name: 'User', avatar_url: null, created_at: '' },
      isAuthenticated: true, loading: false, login: vi.fn(), logout: vi.fn(),
    });
    render(
      <MemoryRouter>
        <RoutesPanelProvider>
          <DrawerMenu />
          <PanelIndicator />
        </RoutesPanelProvider>
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('photos-panel-open')).toBeFalsy();
    await userEvent.click(screen.getByRole('button', { name: /^photos$/i }));
    expect(screen.getByTestId('photos-panel-open')).toBeTruthy();
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd frontend && npm run test -- DrawerMenu.test.tsx
```

Expected: FAIL — Photos button not found / `useAuth` not imported in DrawerMenu

**Step 3: Update `DrawerMenu.tsx`**

Replace `frontend/src/components/common/DrawerMenu.tsx` with:

```tsx
/** Persistent nav drawer: Browse, Routes, and Photos (auth-gated). No menu button; rail is always visible. */
import { useNavigate } from 'react-router-dom';
import { useRoutesPanel } from '../../contexts/RoutesPanelContext';
import { useAuth } from '../../hooks/useAuth';

const DRAWER_PANEL_ID = 'drawer-menu-panel';

/** Width of the nav rail; panels open to the right of this. */
export const NAV_RAIL_WIDTH = 80;

const navStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  bottom: 0,
  width: NAV_RAIL_WIDTH,
  maxWidth: '50vw',
  zIndex: 1000,
  padding: '0.75rem 0 1rem',
  background: '#fff',
  borderRight: '1px solid #e5e7eb',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
};

const itemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '0.6rem 0.75rem',
  textAlign: 'left',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '1rem',
  fontFamily: 'inherit',
  color: 'inherit',
  textDecoration: 'none',
};

export function DrawerMenu() {
  const navigate = useNavigate();
  const routesPanel = useRoutesPanel();
  const { isAuthenticated } = useAuth();

  return (
    <nav id={DRAWER_PANEL_ID} aria-label="Navigation" style={navStyle}>
      <button type="button" style={itemStyle} onClick={() => navigate('/browse')}>
        Browse
      </button>
      <button type="button" style={itemStyle} onClick={() => routesPanel?.setRoutesPanelOpen(true)}>
        Routes
      </button>
      {isAuthenticated && (
        <button type="button" style={itemStyle} onClick={() => routesPanel?.setPhotosPanelOpen(true)}>
          Photos
        </button>
      )}
    </nav>
  );
}
```

**Step 4: Run tests to verify they pass**

```bash
cd frontend && npm run test -- DrawerMenu.test.tsx
```

Expected: all tests PASS

**Step 5: Run all tests to check for regressions**

```bash
cd frontend && npm run test
```

Expected: all tests PASS

**Step 6: Commit**

```bash
git add frontend/src/components/common/DrawerMenu.tsx frontend/src/components/common/DrawerMenu.test.tsx
git commit -m "feat(frontend): add Photos nav button to DrawerMenu (auth-gated)"
```

---

### Task 6: Wire `ExplorePhotosPanel` and upload `BottomDrawer` into `App.tsx`

**Files:**
- Modify: `frontend/src/App.tsx`

No new tests needed — `App.test.tsx` covers smoke rendering. The wiring is straightforward composition.

**Step 1: Update `MapShellLayout` in `App.tsx`**

Read `frontend/src/App.tsx` first (already done in planning), then apply these changes:

1. Add imports at the top of the file (after existing imports):

```tsx
import { ExplorePhotosPanel } from './components/explore/ExplorePhotosPanel';
import { BulkPhotoUpload } from './components/photos/BulkPhotoUpload';
import { BottomDrawer } from './components/common/BottomDrawer';
```

2. Inside `MapShellLayout`, after the `handleRouteSelect` callback, add:

```tsx
const handleOpenUpload = useCallback(() => {
  routesPanel?.setPhotosPanelOpen(false);
  routesPanel?.setUploadDrawerOpen(true);
}, [routesPanel]);

const handleCloseUpload = useCallback(() => {
  routesPanel?.setUploadDrawerOpen(false);
  routesPanel?.setPhotosPanelOpen(true);
}, [routesPanel]);
```

3. Inside the returned JSX, after the closing `{routesPanel?.routesPanelOpen && (...)}` block and before `</MapShell>`, add:

```tsx
{routesPanel?.photosPanelOpen && (
  <ExplorePhotosPanel
    open
    onClose={() => routesPanel.setPhotosPanelOpen(false)}
    onUpload={handleOpenUpload}
  />
)}
<BottomDrawer
  open={!!routesPanel?.uploadDrawerOpen}
  onClose={handleCloseUpload}
  title="Upload photos"
  initialExpanded
>
  <BulkPhotoUpload onDone={handleCloseUpload} />
</BottomDrawer>
```

**Step 2: Run all tests**

```bash
cd frontend && npm run test
```

Expected: all tests PASS

**Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(frontend): wire ExplorePhotosPanel and upload BottomDrawer into MapShellLayout"
```

---

### Task 7: Add "My photos" toggle to `Browse.tsx`

**Files:**
- Modify: `frontend/src/pages/Browse.tsx`
- Modify: `frontend/src/pages/Browse.test.tsx`

**Step 1: Write the failing tests**

Add these tests to `frontend/src/pages/Browse.test.tsx`. First, read the existing test file to find the correct location. Add inside the existing `describe('Browse', ...)` block after the last test:

```tsx
it('does not show My photos toggle when not authenticated', async () => {
  vi.mocked(useAuth.useAuth).mockReturnValue({
    user: null, isAuthenticated: false, loading: false, login: vi.fn(), logout: vi.fn(),
  });
  vi.mocked(photosApi.getPhotosInBbox).mockResolvedValue({
    photos: [], pagination: { page: 1, per_page: 20, total: 0 },
  });
  render(
    <MemoryRouter>
      <Browse />
    </MemoryRouter>
  );
  expect(screen.queryByRole('button', { name: /my photos/i })).toBeFalsy();
});

it('shows My photos toggle when authenticated', async () => {
  vi.mocked(useAuth.useAuth).mockReturnValue({
    user: { id: 'u1', email: 'a@b.co', name: 'User', avatar_url: null, created_at: '' },
    isAuthenticated: true, loading: false, login: vi.fn(), logout: vi.fn(),
  });
  vi.mocked(photosApi.getPhotosInBbox).mockResolvedValue({
    photos: [], pagination: { page: 1, per_page: 20, total: 0 },
  });
  render(
    <MemoryRouter>
      <Browse />
    </MemoryRouter>
  );
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /my photos/i })).toBeTruthy();
  });
});

it('calls getMyPhotosInBbox when My photos toggle is active', async () => {
  vi.mocked(useAuth.useAuth).mockReturnValue({
    user: { id: 'u1', email: 'a@b.co', name: 'User', avatar_url: null, created_at: '' },
    isAuthenticated: true, loading: false, login: vi.fn(), logout: vi.fn(),
  });
  vi.mocked(photosApi.getPhotosInBbox).mockResolvedValue({
    photos: [], pagination: { page: 1, per_page: 20, total: 0 },
  });
  vi.mocked(photosApi.getMyPhotosInBbox).mockResolvedValue({
    photos: [], pagination: { page: 1, per_page: 20, total: 0 },
  });
  render(
    <MemoryRouter>
      <Browse />
    </MemoryRouter>
  );
  await waitFor(() => screen.getByRole('button', { name: /my photos/i }));
  await userEvent.click(screen.getByRole('button', { name: /my photos/i }));
  await waitFor(() => {
    expect(vi.mocked(photosApi.getMyPhotosInBbox)).toHaveBeenCalled();
  });
});
```

Also add `getMyPhotosInBbox` to the existing `vi.mock('../api/photos')` mock — check if the photos mock needs to be made explicit. The `vi.mock('../api/photos')` auto-mock should cover it, but you may need to add:

```tsx
vi.mocked(photosApi.getMyPhotosInBbox).mockResolvedValue({
  photos: [], pagination: { page: 1, per_page: 20, total: 0 },
});
```
in the `beforeEach` block (after verifying the mock structure by running tests).

**Step 2: Run tests to verify they fail**

```bash
cd frontend && npm run test -- Browse.test.tsx
```

Expected: FAIL — "My photos" button not found

**Step 3: Update `Browse.tsx`**

In `frontend/src/pages/Browse.tsx`:

1. Add `getMyPhotosInBbox` to the import from `'../api/photos'` (line 7):

```tsx
import { fetchPhotoImageBlob, getPhotosInBbox, getMyPhotosInBbox } from '../api/photos';
```

2. Add `myPhotosMode` state after the existing `browsePhotos` state declarations (around line 174):

```tsx
const [myPhotosMode, setMyPhotosMode] = useState(false);
```

3. Update `fetchPhotosInBbox` callback to use the correct API based on `myPhotosMode`. Find the `fetchPhotosInBbox` callback (around line 297) and replace the `getPhotosInBbox` call:

```tsx
const fetchPhotosInBbox = useCallback((bbox: string) => {
  setLoading(true);
  setBboxTooLarge(false);
  const fetcher = myPhotosMode ? getMyPhotosInBbox : getPhotosInBbox;
  fetcher(bbox, 1, 50)
    .then((res) => {
      // ... existing handler body unchanged
    })
    // ... existing catch/finally unchanged
}, [myPhotosMode]); // add myPhotosMode to deps
```

Note: read the existing fetchPhotosInBbox body carefully and keep it intact — only change the function called and add the dependency.

4. Add the toggle button to the JSX. Find where the map controls / overlay content is rendered (search for the `bboxTooLarge` error message or the photo lightbox conditional). Add the toggle pill above the map (before the photo lightbox / overlay section):

```tsx
{isAuthenticated && (
  <div
    style={{
      position: 'absolute',
      top: '1rem',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 100,
      display: 'flex',
      background: '#fff',
      borderRadius: 20,
      boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
      overflow: 'hidden',
    }}
  >
    <button
      type="button"
      onClick={() => setMyPhotosMode(false)}
      aria-pressed={!myPhotosMode}
      style={{
        padding: '0.4rem 0.9rem',
        border: 'none',
        background: !myPhotosMode ? '#2563eb' : 'transparent',
        color: !myPhotosMode ? '#fff' : '#374151',
        cursor: 'pointer',
        fontSize: '0.875rem',
        fontWeight: !myPhotosMode ? 600 : 400,
      }}
    >
      All photos
    </button>
    <button
      type="button"
      onClick={() => setMyPhotosMode(true)}
      aria-pressed={myPhotosMode}
      style={{
        padding: '0.4rem 0.9rem',
        border: 'none',
        background: myPhotosMode ? '#2563eb' : 'transparent',
        color: myPhotosMode ? '#fff' : '#374151',
        cursor: 'pointer',
        fontSize: '0.875rem',
        fontWeight: myPhotosMode ? 600 : 400,
      }}
    >
      My photos
    </button>
  </div>
)}
```

5. Ensure `myPhotosMode` is included in the `useEffect` that calls `fetchPhotosInBbox` (the bbox effect). Find the effect that triggers `fetchPhotosInBbox` on bbox change and add `myPhotosMode` to its dependency array.

**Step 4: Run tests to verify they pass**

```bash
cd frontend && npm run test -- Browse.test.tsx
```

Expected: all tests PASS

**Step 5: Run all tests**

```bash
cd frontend && npm run test
```

Expected: all tests PASS

**Step 6: Commit**

```bash
git add frontend/src/pages/Browse.tsx frontend/src/pages/Browse.test.tsx
git commit -m "feat(frontend): add My photos toggle to Browse map"
```

---

## Verification

After all tasks are complete, run the full test suite:

```bash
cd frontend && npm run test
```

Expected: all tests PASS with no regressions.

Manual smoke test (requires `make dev-infra && make dev-backend && make dev-frontend`):
1. Log in → nav rail shows "Photos" button
2. Click "Photos" → ExplorePhotosPanel slides open, shows photo list (empty if none uploaded)
3. Click "Upload photos" → panel closes, BottomDrawer opens expanded with BulkPhotoUpload
4. Select multiple JPEGs → file list appears with "Queued" status
5. Click Upload → each file shows "Uploading…" then "Done" (or "Failed")
6. Click Done → drawer closes, Photos panel reopens
7. On /browse map — "My photos" pill visible when logged in; clicking it refetches from `/v1/photos/my`
8. Log out → "Photos" nav button disappears, "My photos" toggle disappears
