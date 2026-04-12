/** Unit tests for RouteEditForm: pre-filled values, validation, save, cancel. */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouteEditForm } from './RouteEditForm';
import type { Route } from '../../types/route';

const baseRoute: Route = {
  id: 'route-1',
  user_id: 'user-1',
  slug: 'my-route',
  title: 'My Route',
  description: 'A nice walk',
  route_geometry: { type: 'LineString', coordinates: [[-122.42, 37.78], [-122.43, 37.79]] },
  distance_meters: 500,
  is_public: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  tags: ['urban', 'sunset'],
};

describe('RouteEditForm', () => {
  it('renders with pre-filled values from the route prop', () => {
    render(
      <RouteEditForm
        route={baseRoute}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        isSaving={false}
      />,
    );
    expect((screen.getByLabelText(/title/i) as HTMLInputElement).value).toBe('My Route');
    expect((screen.getByLabelText(/description/i) as HTMLInputElement).value).toBe('A nice walk');
    expect((screen.getByLabelText(/tags/i) as HTMLInputElement).value).toBe('urban, sunset');
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
  });

  it('shows error and blocks save when title is empty', async () => {
    const onSave = vi.fn();
    render(
      <RouteEditForm
        route={baseRoute}
        onSave={onSave}
        onCancel={vi.fn()}
        isSaving={false}
      />,
    );
    const titleInput = screen.getByLabelText(/title/i);
    await userEvent.clear(titleInput);
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => {
      expect(screen.getByText(/title is required/i)).toBeTruthy();
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('shows error and blocks save when title exceeds 100 characters', async () => {
    const onSave = vi.fn();
    render(
      <RouteEditForm
        route={baseRoute}
        onSave={onSave}
        onCancel={vi.fn()}
        isSaving={false}
      />,
    );
    const titleInput = screen.getByLabelText(/title/i);
    // Use fireEvent.change to bypass the maxLength=100 attribute and set 101 characters in state
    const longTitle = 'a'.repeat(101);
    fireEvent.change(titleInput, { target: { value: longTitle } });
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => {
      expect(screen.getByText(/100 characters or less/i)).toBeTruthy();
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('calls onSave with correct payload on valid input', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <RouteEditForm
        route={baseRoute}
        onSave={onSave}
        onCancel={vi.fn()}
        isSaving={false}
      />,
    );
    const titleInput = screen.getByLabelText(/title/i);
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Updated Title');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        title: 'Updated Title',
        description: 'A nice walk',
        tags: ['urban', 'sunset'],
        is_public: true,
      });
    });
  });

  it('calls onCancel when Cancel button is clicked', async () => {
    const onCancel = vi.fn();
    render(
      <RouteEditForm
        route={baseRoute}
        onSave={vi.fn()}
        onCancel={onCancel}
        isSaving={false}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
