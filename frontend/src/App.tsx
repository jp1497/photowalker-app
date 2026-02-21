import { useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { Loading } from './components/common/Loading';
import { Toast } from './components/common/Toast';
import { AppMenu } from './components/common/AppMenu';
import { MapShell } from './components/map/MapShell';
import { AuthCallback } from './pages/AuthCallback';
import { Browse } from './pages/Browse';
import { CreateRouteFromPhotos } from './pages/CreateRouteFromPhotos';
import { Login } from './pages/Login';
import { MyRoutes } from './pages/MyRoutes';
import { NotFound } from './pages/NotFound';
import { RouteDetail } from './pages/RouteDetail';
import './App.css';

function MapShellLayout() {
  const location = useLocation();
  const { slug } = useParams<{ slug: string }>();
  const pathname = location.pathname;

  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) return;
    root.classList.add('map-first');
    return () => {
      root.classList.remove('map-first');
    };
  }, []);

  const mode =
    pathname === '/browse'
      ? 'browse'
      : pathname === '/routes/create'
        ? 'create'
        : pathname === '/routes/me'
          ? 'browse'
          : pathname.startsWith('/routes/') && slug
            ? 'detail'
            : 'home';

  return (
    <MapShell mode={mode} slug={slug ?? null}>
      <Outlet />
    </MapShell>
  );
}

function App() {
  const { loading } = useAuth();

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
      <AppMenu />
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route element={<MapShellLayout />}>
          <Route path="/" element={<Navigate to="/browse" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/browse" element={<Browse />} />
          <Route
            path="/routes/me"
            element={
              <ProtectedRoute>
                <MyRoutes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/routes/create"
            element={
              <ProtectedRoute>
                <CreateRouteFromPhotos />
              </ProtectedRoute>
            }
          />
          <Route path="/routes/:slug" element={<RouteDetail />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toast />
    </BrowserRouter>
  );
}

export default App;
