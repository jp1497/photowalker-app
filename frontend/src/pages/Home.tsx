/** Home: map with dismissible welcome/CTA overlay. */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useAuth } from '../hooks/useAuth';
import { useMapContext } from '../contexts/MapContext';
import { OverlayCard } from '../components/common/OverlayCard';

export function Home() {
  const { user, isAuthenticated } = useAuth();
  const mapContext = useMapContext();
  const [ctaDismissed, setCtaDismissed] = useState(false);
  const isShellMap = !!mapContext;
  const ctaRef = useRef<HTMLDivElement>(null);
  const floatingButtonRef = useRef<HTMLButtonElement>(null);

  useFocusTrap(ctaRef, { active: isShellMap && !ctaDismissed });

  useEffect(() => {
    if (!isShellMap) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCtaDismissed(true);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isShellMap]);

  useEffect(() => {
    if (ctaDismissed && isShellMap) floatingButtonRef.current?.focus();
  }, [ctaDismissed, isShellMap]);

  if (!isShellMap) {
    return (
      <div style={{ padding: '3rem 2rem', maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', marginTop: 0, marginBottom: '0.5rem' }}>photowalker</h1>
        <p style={{ fontSize: '1.125rem', color: '#6b7280', marginBottom: '2rem', lineHeight: 1.6 }}>
          create photowalks, share them with others and discover a new side of your city
        </p>
        {isAuthenticated && user ? (
          <>
            <p style={{ marginBottom: '1.5rem', color: '#374151' }}>Welcome, {user.name}.</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/browse" style={{ display: 'inline-block', padding: '0.75rem 1.5rem', background: '#2563eb', color: 'white', textDecoration: 'none', borderRadius: 8, fontWeight: 500 }}>
                Browse routes
              </Link>
              <Link to="/routes/create" style={{ display: 'inline-block', padding: '0.75rem 1.5rem', background: 'transparent', color: '#2563eb', textDecoration: 'none', borderRadius: 8, fontWeight: 500, border: '2px solid #2563eb' }}>
                Create route
              </Link>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/browse" style={{ display: 'inline-block', padding: '0.75rem 1.5rem', background: '#2563eb', color: 'white', textDecoration: 'none', borderRadius: 8, fontWeight: 500 }}>
                Browse routes
              </Link>
              <Link to="/login" style={{ display: 'inline-block', padding: '0.75rem 1.5rem', background: 'transparent', color: '#2563eb', textDecoration: 'none', borderRadius: 8, fontWeight: 500, border: '2px solid #2563eb' }}>
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

  if (ctaDismissed) {
    return (
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
        <button
          ref={floatingButtonRef}
          type="button"
          onClick={() => setCtaDismissed(false)}
          style={{
            position: 'absolute',
            top: '3.5rem',
            left: '0.75rem',
            zIndex: 500,
            padding: '0.5rem 0.75rem',
            fontSize: '0.875rem',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            background: 'rgba(255,255,255,0.95)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            cursor: 'pointer',
            pointerEvents: 'auto',
          }}
          aria-label="Show welcome"
        >
          photowalker
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'auto',
          zIndex: 100,
        }}
      >
        <OverlayCard
          ref={ctaRef}
          title="photowalker"
          onClose={() => setCtaDismissed(true)}
          aria-label="Welcome"
        >
        <p style={{ fontSize: '1.125rem', color: '#6b7280', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          create photowalks, share them with others and discover a new side of your city
        </p>
        {isAuthenticated && user ? (
          <>
            <p style={{ marginBottom: '1rem', color: '#374151' }}>Welcome, {user.name}.</p>
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
            <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#9ca3af' }}>
              Sign in with Google to create and share your own photowalk routes.
            </p>
          </>
        )}
        </OverlayCard>
      </div>
    </div>
  );
}
