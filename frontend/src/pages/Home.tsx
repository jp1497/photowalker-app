/** Home page. */
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function Home() {
  const { user, isAuthenticated } = useAuth();

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Photowalker</h1>
      {isAuthenticated && user ? (
        <p>Welcome, {user.name}.</p>
      ) : (
        <p>
          <Link to="/login">Sign in with Google</Link> to create and share photowalk routes.
        </p>
      )}
    </div>
  );
}
