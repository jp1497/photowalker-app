/** Login: Sign in with Google. Renders as overlay over map when inside map layout. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { login, loginWithTestSecret, REDIRECT_KEY } from '../api/auth';
import { authStore } from '../store/authStore';
import { useMapContext } from '../contexts/MapContext';
import { OverlayCard } from '../components/common/OverlayCard';

const E2E_MODE = import.meta.env.VITE_E2E_MODE === 'true';
const E2E_SECRET = import.meta.env.VITE_E2E_SECRET ?? '';

export function Login() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDivElement>(null);
  const redirect = searchParams.get('redirect');
  const [e2eError, setE2eError] = useState<string | null>(null);
  const mapContext = useMapContext();
  const isOverMap = !!mapContext;

  useEffect(() => {
    if (redirect && redirect.startsWith('/')) {
      sessionStorage.setItem(REDIRECT_KEY, redirect);
    }
  }, [redirect]);

  const handleClose = useCallback(() => {
    const to = sessionStorage.getItem(REDIRECT_KEY);
    if (to && to.startsWith('/')) {
      sessionStorage.removeItem(REDIRECT_KEY);
      navigate(to, { replace: true });
    } else {
      navigate('/browse', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (!isOverMap) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOverMap, handleClose]);

  useFocusTrap(dialogRef, { active: isOverMap });

  const handleTestLogin = async () => {
    if (!E2E_SECRET) return;
    setE2eError(null);
    try {
      const { access_token, user } = await loginWithTestSecret(E2E_SECRET);
      authStore.getState().setAccessToken(access_token);
      authStore.getState().setUser(user);
      authStore.getState().setLoading(false);
      const to = sessionStorage.getItem(REDIRECT_KEY);
      sessionStorage.removeItem(REDIRECT_KEY);
      navigate(to && to.startsWith('/') ? to : '/', { replace: true });
    } catch {
      setE2eError('Test sign in failed');
    }
  };

  if (isOverMap) {
    return (
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Sign in"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 300,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
          }}
          onClick={(e) => e.target === e.currentTarget && handleClose()}
        >
          <OverlayCard
            title="photowalker"
            onClose={handleClose}
            variant="card"
          >
            <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>Sign in to create and share photowalk routes.</p>
            <button
              type="button"
              onClick={login}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                cursor: 'pointer',
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontWeight: 500,
              }}
            >
              Sign in with Google
            </button>
            {E2E_MODE && E2E_SECRET && (
              <div style={{ marginTop: '1.5rem' }}>
                <button
                  type="button"
                  data-testid="login-e2e-test-signin"
                  onClick={handleTestLogin}
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  Test sign in (E2E)
                </button>
                {e2eError && <p style={{ color: '#c00', marginTop: '0.5rem' }}>{e2eError}</p>}
              </div>
            )}
          </OverlayCard>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Photowalker</h1>
      <p>Sign in to create and share photowalk routes.</p>
      <button
        type="button"
        onClick={login}
        style={{
          padding: '0.75rem 1.5rem',
          fontSize: '1rem',
          cursor: 'pointer',
        }}
      >
        Sign in with Google
      </button>
      {E2E_MODE && E2E_SECRET && (
        <div style={{ marginTop: '1.5rem' }}>
          <button
            type="button"
            data-testid="login-e2e-test-signin"
            onClick={handleTestLogin}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Test sign in (E2E)
          </button>
          {e2eError && <p style={{ color: '#c00', marginTop: '0.5rem' }}>{e2eError}</p>}
        </div>
      )}
    </div>
  );
}
