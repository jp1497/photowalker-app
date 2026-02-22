/** Unit tests for DrawerMenu: persistent nav with only Browse and Routes; Browse → /browse; Routes → opens panel. */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DrawerMenu } from './DrawerMenu';
import { RoutesPanelProvider, useRoutesPanel } from '../../contexts/RoutesPanelContext';

function PanelIndicator() {
  const panel = useRoutesPanel();
  return panel?.routesPanelOpen ? <span data-testid="routes-panel-open">Open</span> : null;
}

describe('DrawerMenu', () => {
  it('shows persistent nav with only Browse and Routes (no My routes, Create route, Sign in/out)', () => {
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
    expect(screen.queryByText(/my routes/i)).toBeFalsy();
    expect(screen.queryByText(/create route/i)).toBeFalsy();
    expect(screen.queryByText(/sign in/i)).toBeFalsy();
    expect(screen.queryByText(/sign out/i)).toBeFalsy();
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
});
