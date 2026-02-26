/** Unit tests for ExploreRoutesPanel: filters All/My routes, route list, Create route button. */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExploreRoutesPanel } from './ExploreRoutesPanel';
import * as routesApi from '../../api/routes';
import { useAuth } from '../../hooks/useAuth';
import { useMapContext } from '../../contexts/MapContext';

vi.mock('../../api/routes');
vi.mock('../../hooks/useAuth');
vi.mock('../../contexts/MapContext');

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockGetBrowseRoutes = vi.mocked(routesApi.getBrowseRoutes);

describe('ExploreRoutesPanel', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isAuthenticated: false,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(useMapContext).mockReturnValue({
      map: null,
      onMapReady: vi.fn(),
    });
    mockGetBrowseRoutes.mockResolvedValue({
      routes: [],
      pagination: { page: 1, per_page: 20, total: 0 },
    });
  });

  it('does not render when open is false', () => {
    render(<ExploreRoutesPanel open={false} onClose={() => {}} />);
    expect(screen.queryByRole('complementary', { name: /explore routes/i })).toBeFalsy();
  });

  it('renders when open and shows panel with filters, list area, and Create route button', async () => {
    render(<ExploreRoutesPanel open onClose={() => {}} />);
    await screen.findByText(/no routes found/i);
    const panel = screen.getByRole('complementary', { name: /explore routes/i });
    expect(panel).toBeTruthy();
    expect(screen.getByText('Routes')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^all$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /create route/i })).toBeTruthy();
    expect(document.querySelector('[data-slot="filters"]')).toBeTruthy();
    expect(document.querySelector('[data-slot="route-list"]')).toBeTruthy();
    expect(document.querySelector('[data-slot="create-route"]')).toBeTruthy();
  });

  it('shows My routes filter when authenticated', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'u1', email: 'a@b.co', name: 'User', avatar_url: null, created_at: '' },
      isAuthenticated: true,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    render(<ExploreRoutesPanel open onClose={() => {}} />);
    await screen.findByText(/no routes found/i);
    expect(screen.getByRole('button', { name: /my routes/i })).toBeTruthy();
  });

  it('calls getBrowseRoutes with bbox and no author_id when All is selected', async () => {
    render(<ExploreRoutesPanel open onClose={() => {}} />);
    await screen.findByText(/no routes found/i);
    expect(mockGetBrowseRoutes).toHaveBeenCalledWith(
      expect.objectContaining({
        bbox: expect.any(String),
        page: 1,
        per_page: 20,
        sort: 'created_at',
      })
    );
    expect(mockGetBrowseRoutes.mock.calls[0][0]).not.toHaveProperty('author_id');
  });

  it('calls getBrowseRoutes with author_id when My routes is selected and authenticated', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-123', email: 'a@b.co', name: 'User', avatar_url: null, created_at: '' },
      isAuthenticated: true,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    mockGetBrowseRoutes.mockResolvedValue({
      routes: [],
      pagination: { page: 1, per_page: 20, total: 0 },
    });
    render(<ExploreRoutesPanel open onClose={() => {}} />);
    await screen.findByText(/no routes found/i);
    await userEvent.click(screen.getByRole('button', { name: /my routes/i }));
    await screen.findByText(/no routes found/i);
    const callWithAuthor = mockGetBrowseRoutes.mock.calls.find((c) => c[0]?.author_id === 'user-123');
    expect(callWithAuthor).toBeTruthy();
  });

  it('onClose is called when close button is clicked', async () => {
    const onClose = vi.fn();
    render(<ExploreRoutesPanel open onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: /^close$/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('Create route button navigates to login with return URL when not authenticated', async () => {
    render(<ExploreRoutesPanel open onClose={() => {}} />);
    mockNavigate.mockClear();
    await userEvent.click(screen.getByRole('button', { name: /create route/i }));
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/login'));
    expect(mockNavigate.mock.calls[0][0]).toMatch(/\/login\?redirect=/);
  });

  it('Create route button closes panel and navigates to /routes/create when authenticated', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'u1', email: 'a@b.co', name: 'User', avatar_url: null, created_at: '' },
      isAuthenticated: true,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    const onClose = vi.fn();
    render(<ExploreRoutesPanel open onClose={onClose} />);
    mockNavigate.mockClear();
    await userEvent.click(screen.getByRole('button', { name: /create route/i }));
    expect(onClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/routes/create', {
      state: { openDrawer: true, preserveViewport: true },
    });
  });

  it('uses rem for width (no desktop-only fixed px assumption)', async () => {
    const { container } = render(<ExploreRoutesPanel open onClose={() => {}} />);
    await screen.findByText(/no routes found/i);
    const panel = container.querySelector('[style*="30rem"]');
    expect(panel).toBeTruthy();
  });
});
