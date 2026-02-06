/** Create/edit route form. Title, description, tags, is_public, draw route on map. */
import { useCallback, useState } from 'react';
import { MapView } from '../map/MapView';
import { RouteDrawer } from '../map/RouteDrawer';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { usePreferredMapCenter } from '../../hooks/usePreferredMapCenter';
import { validateRouteGeometry } from '../../utils/geometry';
import type { RouteCreatePayload } from '../../types/route';
import type { Map } from 'maplibre-gl';

const TITLE_MIN = 1;
const TITLE_MAX = 100;
const MAX_TAGS = 5;

const E2E_MODE = import.meta.env.VITE_E2E_MODE === 'true';
const E2E_TEST_COORDS: [number, number][] = [
  [-122.4, 37.8],
  [-122.41, 37.81],
];

export interface RouteFormProps {
  onSubmit: (payload: RouteCreatePayload) => Promise<void>;
  isSubmitting?: boolean;
}

export function RouteForm({ onSubmit, isSubmitting = false }: RouteFormProps) {
  const { center: mapCenter, zoom: mapZoom } = usePreferredMapCenter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][] | null>(null);
  const [mapInstance, setMapInstance] = useState<Map | null>(null);
  const [errors, setErrors] = useState<{ title?: string; geometry?: string }>({});

  const tags = tagsInput
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, MAX_TAGS);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const nextErrors: { title?: string; geometry?: string } = {};
      const trimmedTitle = title.trim();
      if (trimmedTitle.length < TITLE_MIN) {
        nextErrors.title = 'Title is required';
      } else if (trimmedTitle.length > TITLE_MAX) {
        nextErrors.title = `Title must be ${TITLE_MAX} characters or less`;
      }
      if (!routeCoordinates || routeCoordinates.length < 2) {
        nextErrors.geometry = 'Draw a route on the map (at least 2 points)';
      } else {
        const result = validateRouteGeometry(routeCoordinates);
        if (!result.valid) {
          nextErrors.geometry = result.error ?? 'Invalid route';
        }
      }
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) return;

      const payload: RouteCreatePayload = {
        title: trimmedTitle,
        description: description.trim() || null,
        route_geometry: {
          type: 'LineString',
          coordinates: routeCoordinates as [number, number][],
        },
        tags,
        is_public: isPublic,
      };
      await onSubmit(payload);
    },
    [title, description, tags, isPublic, routeCoordinates, onSubmit]
  );

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 640 }}>
      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Route name"
        maxLength={TITLE_MAX}
        error={errors.title}
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
      <div>
        <p style={{ marginBottom: '0.25rem', fontWeight: 500 }}>Route (draw on map)</p>
        <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
          Use the draw tool on the map to trace your route. Click to add points, then finish the line.
        </p>
        {E2E_MODE && (
          <button
            type="button"
            data-testid="create-route-e2e-set-line"
            onClick={() => setRouteCoordinates(E2E_TEST_COORDS)}
            style={{ marginBottom: '0.5rem', padding: '0.35rem 0.75rem', fontSize: '0.875rem', cursor: 'pointer' }}
          >
            Use test route (E2E)
          </button>
        )}
        {errors.geometry && (
          <span style={{ fontSize: '0.875rem', color: '#c00', display: 'block', marginBottom: '0.5rem' }}>{errors.geometry}</span>
        )}
        <div data-testid="create-route-map" style={{ height: 320, border: '1px solid #ccc', borderRadius: 4, overflow: 'hidden' }}>
          <MapView
            center={mapCenter}
            zoom={mapZoom}
            onMapReady={(map) => setMapInstance(map)}
            style={{ width: '100%', height: '100%' }}
          />
          <RouteDrawer map={mapInstance} onLineChange={setRouteCoordinates} />
        </div>
      </div>
      <Button type="submit" loading={isSubmitting}>
        Create route
      </Button>
    </form>
  );
}
