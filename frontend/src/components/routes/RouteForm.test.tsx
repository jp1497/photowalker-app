/** Unit tests for RouteForm: title required, geometry required. */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouteForm } from './RouteForm';

vi.mock('../../hooks/usePreferredMapCenter', () => ({
  usePreferredMapCenter: () => ({ center: [-122.42, 37.78], zoom: 12 }),
}));
vi.mock('../map/MapView', () => ({ MapView: () => <div data-testid="map-view" /> }));
vi.mock('../map/RouteDrawer', () => ({ RouteDrawer: () => null }));

describe('RouteForm', () => {
  it('renders form with title input and create button', () => {
    render(<RouteForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/title/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /create route/i })).toBeTruthy();
    expect(screen.getByTestId('map-view')).toBeTruthy();
  });

  it('shows title required when submitting with empty title', async () => {
    const onSubmit = vi.fn();
    render(<RouteForm onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: /create route/i }));
    await waitFor(() => {
      expect(screen.getByText(/title is required/i)).toBeTruthy();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows geometry required when submitting with title but no route drawn', async () => {
    const onSubmit = vi.fn();
    render(<RouteForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/title/i), 'My Route');
    await userEvent.click(screen.getByRole('button', { name: /create route/i }));
    await waitFor(() => {
      expect(screen.getByText(/draw a route on the map/i)).toBeTruthy();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
