# Route Editing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let route owners edit title/description/tags/visibility, reorder photos, and delete their route — all from an inline edit mode on the RouteDetail page.

**Architecture:** Toggle `isEditMode` in `RouteDetail` (owner only). Metadata edits call the existing `PATCH /v1/routes/{route_id}`. Photo reordering calls a new `PUT /v1/routes/{route_id}/photos/order` endpoint that updates `display_order` and recomputes geometry. Delete calls the existing `DELETE /v1/routes/{route_id}` and navigates to `/browse`.

**Tech Stack:** FastAPI + SQLAlchemy async (backend), React 19 + TypeScript + Axios (frontend), HTML5 Drag and Drop API (no extra library).

---

### Task 1: Backend — `reorder_route_photos` service function

**Files:**
- Modify: `backend/app/services/route_service.py`
- Test: `backend/tests/unit/test_route_service.py`

**Step 1: Write the failing test**

Add to `backend/tests/unit/test_route_service.py`:

```python
@requires_postgres
@pytest.mark.asyncio
async def test_reorder_route_photos_updates_display_order(db_session: AsyncSession) -> None:
    """reorder_route_photos sets display_order to match supplied photo_ids list."""
    from app.models.route_photo import RoutePhoto
    user = User(google_id="g_reorder", email="reorder@example.com", name="Reorder User")
    db_session.add(user)
    await db_session.flush()

    from app.models.photo import Photo
    p1 = Photo(user_id=user.id, s3_key_original="k1", file_size_bytes=1)
    p2 = Photo(user_id=user.id, s3_key_original="k2", file_size_bytes=1)
    db_session.add_all([p1, p2])
    await db_session.flush()

    data = RouteCreate(
        title="Reorder Route",
        description=None,
        route_geometry=RouteGeometrySchema(
            type="LineString",
            coordinates=[[-122.4, 37.8], [-122.41, 37.81]],
        ),
        slug=None,
        tags=[],
        is_public=False,
    )
    route = await route_service.create_route(db_session, user.id, data)
    # Attach photos in order p1, p2
    db_session.add(RoutePhoto(route_id=route.id, photo_id=p1.id, display_order=0))
    db_session.add(RoutePhoto(route_id=route.id, photo_id=p2.id, display_order=1))
    await db_session.flush()

    # Reorder to p2 first, p1 second
    await route_service.reorder_route_photos(db_session, route.id, user.id, [p2.id, p1.id])

    from sqlalchemy import select
    rps = (await db_session.execute(
        select(RoutePhoto)
        .where(RoutePhoto.route_id == route.id)
        .order_by(RoutePhoto.display_order)
    )).scalars().all()
    assert rps[0].photo_id == p2.id
    assert rps[1].photo_id == p1.id


@requires_postgres
@pytest.mark.asyncio
async def test_reorder_route_photos_raises_if_not_owner(db_session: AsyncSession) -> None:
    """reorder_route_photos raises RouteForbiddenError when caller is not owner."""
    user = User(google_id="g_reorder_own", email="reorder_own@example.com", name="Owner")
    other = User(google_id="g_reorder_oth", email="reorder_oth@example.com", name="Other")
    db_session.add_all([user, other])
    await db_session.flush()

    data = RouteCreate(
        title="Another Route",
        description=None,
        route_geometry=RouteGeometrySchema(
            type="LineString",
            coordinates=[[-122.4, 37.8], [-122.41, 37.81]],
        ),
        slug=None,
        tags=[],
        is_public=False,
    )
    route = await route_service.create_route(db_session, user.id, data)

    with pytest.raises(RouteForbiddenError):
        await route_service.reorder_route_photos(db_session, route.id, other.id, [])
```

**Step 2: Run tests to verify they fail**

```bash
cd backend && backend/.venv/bin/pytest tests/unit/test_route_service.py::test_reorder_route_photos_updates_display_order tests/unit/test_route_service.py::test_reorder_route_photos_raises_if_not_owner -v
```

Expected: FAIL with `AttributeError: module ... has no attribute 'reorder_route_photos'`

**Step 3: Implement the service function**

Add to `backend/app/services/route_service.py` (after `delete_route`):

```python
async def reorder_route_photos(
    db: AsyncSession,
    route_id: UUID,
    user_id: UUID,
    photo_ids: list[UUID],
) -> None:
    """Update display_order of route photos to match photo_ids order.

    Raises RouteNotFoundError if route not found, RouteForbiddenError if not owner.
    Only updates RoutePhoto rows whose photo_id is in photo_ids.
    Calls recompute_route_geometry_from_photos after reordering.
    """
    route = await get_route_by_id(db, route_id)
    if route is None:
        raise RouteNotFoundError()
    if route.user_id != user_id:
        raise RouteForbiddenError()

    id_to_order = {photo_id: i for i, photo_id in enumerate(photo_ids)}
    r = await db.execute(
        select(RoutePhoto).where(RoutePhoto.route_id == route_id)
    )
    route_photos = r.scalars().all()
    for rp in route_photos:
        if rp.photo_id in id_to_order:
            rp.display_order = id_to_order[rp.photo_id]
    await db.flush()
    await recompute_route_geometry_from_photos(db, route_id)
```

**Step 4: Run tests to verify they pass**

```bash
cd backend && backend/.venv/bin/pytest tests/unit/test_route_service.py::test_reorder_route_photos_updates_display_order tests/unit/test_route_service.py::test_reorder_route_photos_raises_if_not_owner -v
```

Expected: PASS

**Step 5: Commit**

```bash
git add backend/app/services/route_service.py backend/tests/unit/test_route_service.py
git commit -m "feat(backend): add reorder_route_photos service function"
```

---

### Task 2: Backend — `PUT /v1/routes/{route_id}/photos/order` endpoint

**Files:**
- Modify: `backend/app/api/v1/routes.py`

**Step 1: Write the test**

Add to `backend/tests/unit/test_route_service.py` (imports already present). This is a router test — add a new file:

Create `backend/tests/unit/test_routes_api_reorder.py`:

```python
"""Unit tests for PUT /v1/routes/{route_id}/photos/order."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.factory import create_app
from app.core.config import get_settings


@pytest.fixture()
def client():
    settings = get_settings()
    app = create_app(settings)
    return TestClient(app)


def test_reorder_photos_unauthenticated_returns_401(client: TestClient) -> None:
    """PUT /v1/routes/{id}/photos/order returns 401 with no auth."""
    route_id = uuid4()
    resp = client.put(f"/v1/routes/{route_id}/photos/order", json={"photo_ids": []})
    assert resp.status_code == 401
```

**Step 2: Run test to verify it fails**

```bash
cd backend && backend/.venv/bin/pytest tests/unit/test_routes_api_reorder.py -v
```

Expected: FAIL with 404 (endpoint doesn't exist yet) or 405.

**Step 3: Add the endpoint**

Add to `backend/app/api/v1/routes.py` (before `@router.patch("/{route_id}")`):

First add the import at the top of the imports block:
```python
from app.schemas.route import RouteCreate, RouteFromPhotosCreate, RoutePhotoOrder, RouteResponse, RouteUpdate
```

Add to `backend/app/schemas/route.py` (after `RouteUpdate`):

```python
class RoutePhotoOrder(BaseModel):
    """Request body for PUT /v1/routes/{route_id}/photos/order."""

    photo_ids: list[UUID] = Field(..., description="Ordered photo UUIDs for this route")
```

Add import at top of `backend/app/schemas/route.py`:
```python
from uuid import UUID
```
(it already imports UUID — just ensure `RoutePhotoOrder` uses it)

Add the endpoint to `backend/app/api/v1/routes.py`:

```python
@router.put("/{route_id}/photos/order", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_route_photos(
    route_id: UUID,
    body: RoutePhotoOrder,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_required),
) -> None:
    """Update photo display_order for a route. Owner only."""
    try:
        await route_service.reorder_route_photos(db, route_id, current_user.id, body.photo_ids)
    except RouteNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Route not found", "details": None},
        )
    except RouteForbiddenError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Not allowed to reorder photos on this route", "details": None},
        )
    await db.commit()
```

**Important:** Place this route **before** `@router.patch("/{route_id}")` to avoid ambiguity. Actually it's `/{route_id}/photos/order` which is unambiguous, but keep it near the other `/{route_id}` routes.

**Step 4: Run test to verify it passes**

```bash
cd backend && backend/.venv/bin/pytest tests/unit/test_routes_api_reorder.py -v
```

Expected: PASS

**Step 5: Run full backend test suite**

```bash
cd backend && backend/.venv/bin/pytest --tb=short -q
```

Expected: All pass (postgres tests skipped if no DB).

**Step 6: Commit**

```bash
git add backend/app/api/v1/routes.py backend/app/schemas/route.py backend/tests/unit/test_routes_api_reorder.py
git commit -m "feat(backend): add PUT /v1/routes/{route_id}/photos/order endpoint"
```

---

### Task 3: Frontend — API functions

**Files:**
- Modify: `frontend/src/api/routes.ts`
- Modify: `frontend/src/api/photos.ts`
- Modify: `frontend/src/types/route.ts`

**Step 1: Add `RouteUpdatePayload` type**

Add to `frontend/src/types/route.ts` (after `RouteFromPhotosPayload`):

```typescript
/** Payload for PATCH /v1/routes/{id} */
export interface RouteUpdatePayload {
  title?: string;
  description?: string | null;
  tags?: string[];
  is_public?: boolean;
}
```

**Step 2: Add `updateRoute` and `deleteRoute` to `api/routes.ts`**

Add to `frontend/src/api/routes.ts`:

```typescript
import type {
  BrowseParams,
  BrowseResponse,
  Route,
  RouteCreatePayload,
  RouteDetailResponse,
  RouteFromPhotosPayload,
  RouteUpdatePayload,
} from '../types/route';

export async function updateRoute(routeId: string, payload: RouteUpdatePayload): Promise<Route> {
  const { data } = await apiClient.patch<{ route: Route }>(`/v1/routes/${encodeURIComponent(routeId)}`, payload);
  return data.route;
}

export async function deleteRoute(routeId: string): Promise<void> {
  await apiClient.delete(`/v1/routes/${encodeURIComponent(routeId)}`);
}
```

**Step 3: Add `reorderRoutePhotos` to `api/photos.ts`**

Add to `frontend/src/api/photos.ts`:

```typescript
/** Update display_order of photos for a route. Owner only. */
export async function reorderRoutePhotos(routeId: string, photoIds: string[]): Promise<void> {
  await apiClient.put(`/v1/routes/${encodeURIComponent(routeId)}/photos/order`, { photo_ids: photoIds });
}
```

**Step 4: Verify TypeScript compiles**

```bash
cd frontend && npm run build 2>&1 | head -30
```

Expected: No type errors.

**Step 5: Commit**

```bash
git add frontend/src/api/routes.ts frontend/src/api/photos.ts frontend/src/types/route.ts
git commit -m "feat(frontend): add updateRoute, deleteRoute, reorderRoutePhotos API functions"
```

---

### Task 4: Frontend — `RouteEditForm` component

**Files:**
- Create: `frontend/src/components/routes/RouteEditForm.tsx`

This component renders inline editable fields for title, description, tags, and public toggle. It receives the current route values as props and calls `onSave` with the patch payload.

**Step 1: Create the component**

Create `frontend/src/components/routes/RouteEditForm.tsx`:

```typescript
/** Inline edit form for route metadata (title, description, tags, visibility). */
import { useState } from 'react';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import type { Route } from '../../types/route';
import type { RouteUpdatePayload } from '../../types/route';

interface RouteEditFormProps {
  route: Route;
  onSave: (patch: RouteUpdatePayload) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

const MAX_TAGS = 5;
const TITLE_MAX = 100;

export function RouteEditForm({ route, onSave, onCancel, isSaving }: RouteEditFormProps) {
  const [title, setTitle] = useState(route.title);
  const [description, setDescription] = useState(route.description ?? '');
  const [tagsInput, setTagsInput] = useState(route.tags.join(', '));
  const [isPublic, setIsPublic] = useState(route.is_public);
  const [titleError, setTitleError] = useState<string | null>(null);

  const tags = tagsInput
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, MAX_TAGS);

  const handleSave = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitleError('Title is required');
      return;
    }
    if (trimmed.length > TITLE_MAX) {
      setTitleError(`Title must be ${TITLE_MAX} characters or less`);
      return;
    }
    setTitleError(null);
    await onSave({
      title: trimmed,
      description: description.trim() || null,
      tags,
      is_public: isPublic,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={TITLE_MAX}
        error={titleError ?? undefined}
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
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        Public (visible to everyone)
      </label>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <Button onClick={handleSave} loading={isSaving}>
          Save changes
        </Button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          style={{ padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.875rem' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd frontend && npm run build 2>&1 | head -30
```

Expected: No errors.

**Step 3: Commit**

```bash
git add frontend/src/components/routes/RouteEditForm.tsx
git commit -m "feat(frontend): add RouteEditForm component"
```

---

### Task 5: Frontend — `ReorderablePhotoList` component

**Files:**
- Create: `frontend/src/components/photos/ReorderablePhotoList.tsx`

This replaces `PhotoGallery` in edit mode. Uses HTML5 drag-and-drop. Each photo card has ↑/↓ buttons and a drag handle.

**Step 1: Create the component**

Create `frontend/src/components/photos/ReorderablePhotoList.tsx`:

```typescript
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

  const move = (from: number, to: number) => {
    if (from === to) return;
    const next = [...photos];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  if (photos.length === 0) {
    return <p style={{ color: '#666' }}>No photos yet.</p>;
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {photos.map((photo, index) => (
        <li
          key={photo.id}
          draggable
          onDragStart={() => { dragIndex.current = index; }}
          onDragOver={(e) => { e.preventDefault(); setDragOverIndex(index); }}
          onDragLeave={() => setDragOverIndex(null)}
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
                padding: '0.125rem 0.5rem',
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
                padding: '0.125rem 0.5rem',
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
  );
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd frontend && npm run build 2>&1 | head -30
```

Expected: No errors.

**Step 3: Commit**

```bash
git add frontend/src/components/photos/ReorderablePhotoList.tsx
git commit -m "feat(frontend): add ReorderablePhotoList component"
```

---

### Task 6: Frontend — Wire edit mode into `RouteDetail`

**Files:**
- Modify: `frontend/src/pages/RouteDetail.tsx`

This is the main integration task. Add `isEditMode` state, "Edit" button, `RouteEditForm`, `ReorderablePhotoList`, and delete flow.

**Step 1: Add imports at top of `RouteDetail.tsx`**

Add these imports (after the existing imports):

```typescript
import { updateRoute, deleteRoute } from '../api/routes';
import { reorderRoutePhotos } from '../api/photos';
import { RouteEditForm } from '../components/routes/RouteEditForm';
import { ReorderablePhotoList } from '../components/photos/ReorderablePhotoList';
import { toastStore } from '../store/toastStore';
import type { RouteDetailPhoto } from '../types/route';
```

**Step 2: Add new state variables**

Add after the existing `useState` declarations (around line 33):

```typescript
const [isEditMode, setIsEditMode] = useState(false);
const [isSaving, setIsSaving] = useState(false);
const [isDeleting, setIsDeleting] = useState(false);
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
// Local photo order for optimistic reorder in edit mode
const [editPhotos, setEditPhotos] = useState<RouteDetailPhoto[]>([]);
```

**Step 3: Sync `editPhotos` when entering edit mode**

Add a `useEffect` after the existing ones (around line 97):

```typescript
useEffect(() => {
  if (isEditMode && data) {
    setEditPhotos([...data.photos]);
  }
}, [isEditMode, data]);
```

**Step 4: Add `handleSaveMetadata`**

Add after `handleSaveEditLocation` (around line 223):

```typescript
const handleSaveMetadata = async (patch: import('../types/route').RouteUpdatePayload) => {
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

const handleReorder = async (reordered: RouteDetailPhoto[]) => {
  if (!data) return;
  const prev = editPhotos;
  setEditPhotos(reordered);
  try {
    await reorderRoutePhotos(data.route.id, reordered.map((p) => p.id));
    refetch();
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
```

**Step 5: Add the "Edit" button and edit-mode content to the drawer (shell map path)**

In the `BottomDrawer` content block (around line 378), replace:

```typescript
<RouteView route={route} photos={photos} selectedPhotoId={selectedPhotoId} onSelectPhoto={setSelectedPhotoId} contentOnly />
```

with:

```typescript
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
  <span />
  {isOwner && !isEditMode && (
    <button
      type="button"
      onClick={() => setIsEditMode(true)}
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
```

**Step 6: Replace the Photos section in the drawer with edit-aware version**

Replace the existing Photos section (the `<section>` around line 383) with:

```typescript
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
        onSuccess={() => { refetch(); setShowUpload(false); }}
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
```

**Step 7: Apply the same changes to the non-shell-map path**

The non-shell-map render path (starting around line 225) has the same Photos section and RouteView. Apply identical edits there — same "Edit" button, same edit mode branching, same delete UI.

**Step 8: Verify TypeScript compiles with no errors**

```bash
cd frontend && npm run build 2>&1 | head -40
```

Expected: No type errors.

**Step 9: Verify frontend tests pass**

```bash
cd frontend && npm run test
```

Expected: All pass.

**Step 10: Commit**

```bash
git add frontend/src/pages/RouteDetail.tsx
git commit -m "feat(frontend): add route edit mode to RouteDetail"
```

---

### Task 7: Final verification

**Step 1: Run full test suite**

```bash
make test
```

Expected: All backend unit tests pass (postgres tests skipped if no DB), all frontend vitest tests pass.

**Step 2: Manual smoke test (requires infra running)**

```bash
make dev-infra
make dev-backend   # in a separate terminal
make dev-frontend  # in a separate terminal
```

- Navigate to a route you own at `/routes/:slug`
- Verify "Edit" button is visible for owner, hidden for non-owner
- Click "Edit" → verify title/description/tags/public fields appear pre-filled
- Edit title → click "Save changes" → verify title updates on the page
- Click "Edit" again → drag a photo to reorder → verify order persists on refresh
- Click "Edit" → click "Delete route" → confirm → verify redirect to `/browse`
- Verify non-owner sees no Edit button and no delete option

**Step 3: Commit if any fixups were made**

```bash
git add -p
git commit -m "fix: route editing smoke test fixups"
```
