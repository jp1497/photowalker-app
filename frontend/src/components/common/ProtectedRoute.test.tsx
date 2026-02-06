/** Unit tests for ProtectedRoute: redirect when not authenticated. */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import * as useAuth from '../../hooks/useAuth';

vi.mock('../../hooks/useAuth');

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.mocked(useAuth.useAuth).mockReturnValue({
      user: null,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      isAuthenticated: false,
    });
  });

  it('redirects to login when not authenticated', () => {
    render(
      <MemoryRouter initialEntries={['/routes/create']}>
        <Routes>
          <Route
            path="/routes/create"
            element={
              <ProtectedRoute>
                <div data-testid="protected-content">Create Route</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div data-testid="login-page">Sign in</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('login-page')).toBeTruthy();
    expect(screen.queryByTestId('protected-content')).toBeNull();
  });

  it('renders children when authenticated', () => {
    vi.mocked(useAuth.useAuth).mockReturnValue({
      user: { id: '1', email: 't@t.com', name: 'Test', avatar_url: '', created_at: '' },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={['/routes/create']}>
        <Routes>
          <Route
            path="/routes/create"
            element={
              <ProtectedRoute>
                <div data-testid="protected-content">Create Route</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('protected-content')).toBeTruthy();
  });
});
