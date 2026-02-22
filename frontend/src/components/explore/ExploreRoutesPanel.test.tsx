/** Unit tests for ExploreRoutesPanel: shell with slots for filters, list, Create button. */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExploreRoutesPanel } from './ExploreRoutesPanel';

describe('ExploreRoutesPanel', () => {
  it('does not render when open is false', () => {
    render(<ExploreRoutesPanel open={false} onClose={() => {}} />);
    expect(screen.queryByRole('complementary', { name: /explore routes/i })).toBeFalsy();
  });

  it('renders when open and shows panel with header and slots', () => {
    render(<ExploreRoutesPanel open onClose={() => {}} />);
    const panel = screen.getByRole('complementary', { name: /explore routes/i });
    expect(panel).toBeTruthy();
    expect(screen.getByText('Routes')).toBeTruthy();
    expect(screen.getByText('Filters (All, My routes)')).toBeTruthy();
    expect(screen.getByText('Route list')).toBeTruthy();
    expect(screen.getByText('Create route')).toBeTruthy();
  });

  it('onClose is called when close button is clicked', async () => {
    const onClose = vi.fn();
    render(<ExploreRoutesPanel open onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: /^close$/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has slots identifiable for filters, route list, and create button', () => {
    render(<ExploreRoutesPanel open onClose={() => {}} />);
    expect(document.querySelector('[data-slot="filters"]')).toBeTruthy();
    expect(document.querySelector('[data-slot="route-list"]')).toBeTruthy();
    expect(document.querySelector('[data-slot="create-route"]')).toBeTruthy();
  });

  it('uses rem for width (no desktop-only fixed px assumption)', () => {
    const { container } = render(<ExploreRoutesPanel open onClose={() => {}} />);
    const panel = container.querySelector('[style*="30rem"]');
    expect(panel).toBeTruthy();
  });
});
