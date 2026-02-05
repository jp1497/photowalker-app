import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { AuthCallback } from './pages/AuthCallback';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import './App.css';

function App() {
  const { user, loading, logout, isAuthenticated } = useAuth();

  if (loading) {
    return <p style={{ padding: '2rem', textAlign: 'center' }}>Loading...</p>;
  }

  return (
    <BrowserRouter>
      <nav style={{ padding: '1rem', borderBottom: '1px solid #ccc' }}>
        <Link to="/" style={{ marginRight: '1rem' }}>
          Home
        </Link>
        {isAuthenticated ? (
          <>
            <span style={{ marginRight: '1rem' }}>{user?.name}</span>
            <button type="button" onClick={logout}>
              Sign out
            </button>
          </>
        ) : (
          <Link to="/login">Sign in</Link>
        )}
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
