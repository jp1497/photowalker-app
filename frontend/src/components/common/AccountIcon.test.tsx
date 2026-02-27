/** Unit tests for AccountIcon: top-right icon, dropdown with Sign in, Settings, Sign out only. */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AccountIcon } from './AccountIcon';
import * as useAuth from '../../hooks/useAuth';

vi.mock('../../hooks/useAuth');

describe('AccountIcon', () => {
  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.mocked(useAuth.useAuth).mockReturnValue({
      user: null,
      loading: false,
      login: vi.fn(),
      logout: mockLogout,
      isAuthenticated: false,
    });
    mockLogout.mockReset();
  });

  it('renders account icon in top-right (button visible)', () => {
    render(
      <MemoryRouter>
        <AccountIcon />
      </MemoryRouter>,
    );
    const trigger = screen.getByRole('button', { name: /open account menu/i });
    expect(trigger).toBeTruthy();
    expect(trigger.getAttribute('aria-haspopup')).toBe('true');
  });

  it('click opens dropdown with Sign in, Settings when not authenticated (no My routes or Create route)', async () => {
    render(
      <MemoryRouter>
        <AccountIcon />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: /open account menu/i }));

    expect(screen.getByRole('menu', { name: /account menu/i })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /sign in/i })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /settings/i })).toBeTruthy();
    expect(screen.queryByText(/my routes/i)).toBeFalsy();
    expect(screen.queryByText(/create route/i)).toBeFalsy();
  });

  it('Sign in navigates to /login', async () => {
    render(
      <MemoryRouter initialEntries={['/browse']}>
        <Routes>
          <Route path="/browse" element={<AccountIcon />} />
          <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: /open account menu/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /sign in/i }));

    expect(screen.getByTestId('login-page')).toBeTruthy();
  });

  it('Sign out calls logout when authenticated', async () => {
    vi.mocked(useAuth.useAuth).mockReturnValue({
      user: { id: 'u1', name: 'User', email: 'u@e.com', avatar_url: null, created_at: '2025-01-01T00:00:00Z' },
      loading: false,
      login: vi.fn(),
      logout: mockLogout,
      isAuthenticated: true,
    });

    render(
      <MemoryRouter>
        <AccountIcon />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: /open account menu/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /sign out/i }));

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('when authenticated dropdown has Settings and Sign out only (no Sign in)', async () => {
    vi.mocked(useAuth.useAuth).mockReturnValue({
      user: { id: 'u1', name: 'User', email: 'u@e.com', avatar_url: null, created_at: '2025-01-01T00:00:00Z' },
      loading: false,
      login: vi.fn(),
      logout: mockLogout,
      isAuthenticated: true,
    });

    render(
      <MemoryRouter>
        <AccountIcon />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: /open account menu/i }));

    expect(screen.queryByRole('menuitem', { name: /sign in/i })).toBeFalsy();
    expect(screen.getByRole('menuitem', { name: /settings/i })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /sign out/i })).toBeTruthy();
  });
});
