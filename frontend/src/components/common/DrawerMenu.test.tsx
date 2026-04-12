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
