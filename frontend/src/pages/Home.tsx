/** Home page: landing, welcome, CTA to browse or create. */
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function Home() {
  const { user, isAuthenticated } = useAuth();

  return (
    <div
      style={{
        padding: '3rem 2rem',
        maxWidth: 640,
        margin: '0 auto',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: '2.5rem', marginTop: 0, marginBottom: '0.5rem' }}>Photowalker</h1>
      <p style={{ fontSize: '1.125rem', color: '#6b7280', marginBottom: '2rem', lineHeight: 1.6 }}>
        Create and share photowalk routes. Draw your path, add photos with GPS, and discover routes from others.
      </p>

      {isAuthenticated && user ? (
        <>
          <p style={{ marginBottom: '1.5rem', color: '#374151' }}>Welcome, {user.name}.</p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              to="/browse"
              style={{
                display: 'inline-block',
                padding: '0.75rem 1.5rem',
                background: '#2563eb',
                color: 'white',
                textDecoration: 'none',
                borderRadius: 8,
                fontWeight: 500,
                border: 'none',
              }}
            >
              Browse routes
            </Link>
            <Link
              to="/routes/create"
              style={{
                display: 'inline-block',
                padding: '0.75rem 1.5rem',
                background: 'transparent',
                color: '#2563eb',
                textDecoration: 'none',
                borderRadius: 8,
                fontWeight: 500,
                border: '2px solid #2563eb',
              }}
            >
              Create route
            </Link>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              to="/browse"
              style={{
                display: 'inline-block',
                padding: '0.75rem 1.5rem',
                background: '#2563eb',
                color: 'white',
                textDecoration: 'none',
                borderRadius: 8,
                fontWeight: 500,
              }}
            >
              Browse routes
            </Link>
            <Link
              to="/login"
              style={{
                display: 'inline-block',
                padding: '0.75rem 1.5rem',
                background: 'transparent',
                color: '#2563eb',
                textDecoration: 'none',
                borderRadius: 8,
                fontWeight: 500,
                border: '2px solid #2563eb',
              }}
            >
              Sign in to create
            </Link>
          </div>
          <p style={{ marginTop: '1.5rem', fontSize: '0.875rem', color: '#9ca3af' }}>
            Sign in with Google to create and share your own photowalk routes.
          </p>
        </>
      )}
    </div>
  );
}
