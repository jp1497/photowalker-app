/** Login page with Sign in with Google button. Stores redirect param for post-login navigation. */
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { login, REDIRECT_KEY } from '../api/auth';

export function Login() {
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');

  useEffect(() => {
    if (redirect && redirect.startsWith('/')) {
      sessionStorage.setItem(REDIRECT_KEY, redirect);
    }
  }, [redirect]);

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
    </div>
  );
}
