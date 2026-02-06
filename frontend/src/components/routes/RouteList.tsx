/** Paginated list of routes for browse. Click route → navigate to detail. */
import { useNavigate } from 'react-router-dom';
import { Loading } from '../common/Loading';
import type { Route } from '../../types/route';

export interface RouteListProps {
  routes: Route[];
  pagination: { page: number; per_page: number; total: number };
  loading?: boolean;
  onPageChange: (page: number) => void;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function RouteList({ routes, pagination, loading, onPageChange }: RouteListProps) {
  const navigate = useNavigate();
  const { page, per_page, total } = pagination;
  const totalPages = Math.max(1, Math.ceil(total / per_page));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const handleRouteClick = (slug: string) => {
    navigate(`/routes/${slug}`);
  };

  if (loading) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center' }}>
        <Loading label="Loading routes..." />
      </div>
    );
  }

  if (routes.length === 0) {
    return (
      <p style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>
        No routes found. Try adjusting the map or filters.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: '0.5rem',
          flex: 1,
          overflow: 'auto',
        }}
      >
        {routes.map((route) => (
          <li
            key={route.id}
            style={{
              padding: '0.75rem',
              marginBottom: '0.5rem',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              cursor: 'pointer',
              background: '#fff',
            }}
            onClick={() => handleRouteClick(route.slug)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleRouteClick(route.slug);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <strong style={{ display: 'block', marginBottom: '0.25rem' }}>{route.title}</strong>
            {route.description && (
              <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.875rem', color: '#6b7280' }}>
                {route.description.slice(0, 100)}
                {route.description.length > 100 ? '…' : ''}
              </p>
            )}
            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
              {formatDate(route.created_at)}
              {route.distance_meters != null && (
                <span style={{ marginLeft: '0.5rem' }}>
                  · {(route.distance_meters / 1000).toFixed(1)} km
                </span>
              )}
            </div>
            {route.tags && route.tags.length > 0 && (
              <div style={{ marginTop: '0.25rem' }}>
                {route.tags.map((t) => (
                  <span
                    key={t}
                    style={{
                      display: 'inline-block',
                      marginRight: '0.25rem',
                      padding: '0.125rem 0.5rem',
                      background: '#e5e7eb',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      {totalPages > 1 && (
        <div
          style={{
            padding: '0.5rem',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
          }}
        >
          <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            Page {page} of {totalPages} ({total} total)
          </span>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button
              type="button"
              disabled={!hasPrev}
              onClick={() => onPageChange(page - 1)}
              style={{ padding: '0.25rem 0.5rem' }}
            >
              Previous
            </button>
            <button
              type="button"
              disabled={!hasNext}
              onClick={() => onPageChange(page + 1)}
              style={{ padding: '0.25rem 0.5rem' }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
