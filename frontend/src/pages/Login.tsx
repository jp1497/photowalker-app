/** Login page with Sign in with Google button. Stores redirect param for post-login navigation. */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { login, loginWithTestSecret, REDIRECT_KEY } from '../api/auth';
import { authStore } from '../store/authStore';

const E2E_MODE = import.meta.env.VITE_E2E_MODE === 'true';
const E2E_SECRET = import.meta.env.VITE_E2E_SECRET ?? '';

export function Login() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const redirect = searchParams.get('redirect');
  const [e2eError, setE2eError] = useState<string | null>(null);

  useEffect(() => {
    if (redirect && redirect.startsWith('/')) {
      sessionStorage.setItem(REDIRECT_KEY, redirect);
    }
  }, [redirect]);

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
