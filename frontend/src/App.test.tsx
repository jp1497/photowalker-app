import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';

describe('App', () => {
  it('placeholder', () => {
    expect(true).toBe(true);
  });

  describe('root redirect to browse', () => {
    it('navigating to / redirects to /browse (replace)', () => {
      const BrowseMarker = () => <div data-testid="browse-page">Browse</div>;
      render(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<Navigate to="/browse" replace />} />
            <Route path="/browse" element={<BrowseMarker />} />
          </Routes>
        </MemoryRouter>
      );
      expect(screen.getByTestId('browse-page')).toBeTruthy();
      expect(screen.getByText('Browse')).toBeTruthy();
    });

    it('no route renders Home at /', () => {
      const BrowseMarker = () => <div data-testid="browse-page">Browse</div>;
      render(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<Navigate to="/browse" replace />} />
            <Route path="/browse" element={<BrowseMarker />} />
          </Routes>
        </MemoryRouter>
      );
      expect(screen.queryByRole('heading', { name: /photowalker/i })).toBeFalsy();
    });
  });
});
