import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { AuthCallback } from './pages/AuthCallback';
import { Browse } from './pages/Browse';
import { CreateRoute } from './pages/CreateRoute';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { MyRoutes } from './pages/MyRoutes';
import { RouteDetail } from './pages/RouteDetail';
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
        <Link to="/browse" style={{ marginRight: '1rem' }}>
          Browse
        </Link>
        {isAuthenticated ? (
          <>
            <Link to="/routes/me" style={{ marginRight: '1rem' }}>
              My routes
            </Link>
            <Link to="/routes/create" style={{ marginRight: '1rem' }}>
              Create route
            </Link>
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
        <Route path="/browse" element={<Browse />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/routes/me" element={<MyRoutes />} />
        <Route path="/routes/create" element={<CreateRoute />} />
        <Route path="/routes/:slug" element={<RouteDetail />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
