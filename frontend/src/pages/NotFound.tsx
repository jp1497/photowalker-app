/** 404 page for unknown routes. */
import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div
      style={{
        padding: '3rem 2rem',
        textAlign: 'center',
        maxWidth: 400,
        margin: '0 auto',
      }}
    >
      <h1 style={{ fontSize: '4rem', margin: 0, color: '#6b7280', fontWeight: 300 }}>404</h1>
      <h2 style={{ marginTop: '0.5rem', marginBottom: '1rem', fontSize: '1.25rem' }}>Page not found</h2>
      <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        to="/"
        style={{
          display: 'inline-block',
          padding: '0.5rem 1rem',
          background: '#2563eb',
          color: 'white',
          textDecoration: 'none',
          borderRadius: 6,
          fontWeight: 500,
        }}
      >
        Go to Home
      </Link>
    </div>
  );
}
