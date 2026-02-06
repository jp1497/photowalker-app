import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { Loading } from './components/common/Loading';
import { Toast } from './components/common/Toast';
import { AuthCallback } from './pages/AuthCallback';
import { Browse } from './pages/Browse';
import { CreateRoute } from './pages/CreateRoute';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { MyRoutes } from './pages/MyRoutes';
import { NotFound } from './pages/NotFound';
import { RouteDetail } from './pages/RouteDetail';
import './App.css';

const navLinkStyle = ({ isActive }: { isActive: boolean }) => ({
  marginRight: '1rem',
  textDecoration: isActive ? 'underline' : 'none',
  fontWeight: isActive ? 600 : 400,
});

function App() {
  const { user, loading, logout, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <Loading />
        <p style={{ marginTop: '1rem' }}>Loading...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <nav style={{ padding: '1rem 2rem', borderBottom: '1px solid #e5e7eb' }}>
        <NavLink to="/" style={navLinkStyle}>
          Home
        </NavLink>
        <NavLink to="/browse" style={navLinkStyle}>
          Browse
        </NavLink>
        {isAuthenticated ? (
          <>
            <NavLink to="/routes/me" style={navLinkStyle}>
              My routes
            </NavLink>
            <NavLink to="/routes/create" style={navLinkStyle}>
              Create route
            </NavLink>
            <span style={{ marginRight: '1rem', color: '#6b7280' }}>{user?.name}</span>
            <button type="button" onClick={logout}>
              Sign out
            </button>
          </>
        ) : (
          <NavLink to="/login" style={navLinkStyle}>
            Sign in
          </NavLink>
        )}
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/routes/me" element={<ProtectedRoute><MyRoutes /></ProtectedRoute>} />
        <Route path="/routes/create" element={<ProtectedRoute><CreateRoute /></ProtectedRoute>} />
        <Route path="/routes/:slug" element={<RouteDetail />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toast />
    </BrowserRouter>
  );
}

export default App;
