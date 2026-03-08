/** Persistent nav drawer: Browse, Routes, and Photos (auth-gated). No menu button; rail is always visible. */
import { useNavigate } from 'react-router-dom';
import { useRoutesPanel } from '../../contexts/RoutesPanelContext';
import { useAuth } from '../../hooks/useAuth';

const DRAWER_PANEL_ID = 'drawer-menu-panel';

/** Width of the nav rail; panels open to the right of this. */
export const NAV_RAIL_WIDTH = 80;

const navStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  bottom: 0,
  width: NAV_RAIL_WIDTH,
  maxWidth: '50vw',
  zIndex: 1000,
  padding: '0.75rem 0 1rem',
  background: '#fff',
  borderRight: '1px solid #e5e7eb',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
};

const itemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '0.6rem 0.75rem',
  textAlign: 'left',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '1rem',
  fontFamily: 'inherit',
  color: 'inherit',
  textDecoration: 'none',
};

export function DrawerMenu() {
  const navigate = useNavigate();
  const routesPanel = useRoutesPanel();
  const { isAuthenticated } = useAuth();

  return (
    <nav id={DRAWER_PANEL_ID} aria-label="Navigation" style={navStyle}>
      <button type="button" style={itemStyle} onClick={() => { routesPanel?.setRoutesPanelOpen(false); routesPanel?.setPhotosPanelOpen(false); navigate('/browse'); }}>
        Browse
      </button>
      <button type="button" style={itemStyle} onClick={() => { routesPanel?.setPhotosPanelOpen(false); routesPanel?.setRoutesPanelOpen(true); }}>
        Routes
      </button>
      {isAuthenticated && (
        <button type="button" style={itemStyle} onClick={() => { routesPanel?.setRoutesPanelOpen(false); routesPanel?.setPhotosPanelOpen(true); }}>
          Photos
        </button>
      )}
    </nav>
  );
}
