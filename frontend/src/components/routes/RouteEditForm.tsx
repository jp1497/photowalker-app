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
        <Button variant="secondary" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
