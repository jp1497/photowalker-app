/** OAuth callback: exchange code for tokens, then redirect. */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authStore } from '../store/authStore';
import { loginWithCode, REDIRECT_KEY } from '../api/auth';

export function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const code = searchParams.get('code');
  const missingCode = !code && !error;

  useEffect(() => {
    if (!code) return;
    loginWithCode(code)
      .then(({ access_token, user }) => {
        authStore.getState().setAccessToken(access_token);
        authStore.getState().setUser(user);
        authStore.getState().setLoading(false);
        const redirect = sessionStorage.getItem(REDIRECT_KEY);
        sessionStorage.removeItem(REDIRECT_KEY);
        navigate(redirect && redirect.startsWith('/') ? redirect : '/', { replace: true });
      })
      .catch((err) => {
        setError(err.response?.data?.error?.message ?? 'Sign in failed');
      });
  }, [code, navigate]);

  if (missingCode || error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>{error ?? 'Missing authorization code'}</p>
        <button type="button" onClick={() => navigate('/login')}>
          Try again
        </button>
      </div>
    );
  }
  return <p style={{ padding: '2rem', textAlign: 'center' }}>Signing you in...</p>;
}
