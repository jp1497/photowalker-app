/** Login page with Sign in with Google button. */
import { login } from '../api/auth';

export function Login() {
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
