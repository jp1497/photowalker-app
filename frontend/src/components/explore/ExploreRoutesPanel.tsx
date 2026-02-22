/**
 * Left Explore routes panel (PRD v6 FR-U3).
 * Structure: header (title + close), filters slot, route list slot, Create route button slot.
 * Open state from parent (drawer menu). Close and reopen via Routes in the nav bar.
 */
import { NAV_RAIL_WIDTH } from '../common/DrawerMenu';

const PANEL_Z_INDEX = 999;
const PANEL_WIDTH = '30rem';

export interface ExploreRoutesPanelProps {
  /** When true, the panel is visible. */
  open: boolean;
  /** Called when the panel should close (e.g. close button). */
  onClose: () => void;
  /** Optional; Phase 4 will wire route selection to open drawer. */
  onRouteSelect?: (routeId: string) => void;
  /** Optional; Phase 4 will wire hover/select to highlight route on map. */
  onHighlightRoute?: (routeId: string | null) => void;
}

const closeButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: '0.25rem',
  cursor: 'pointer',
  fontSize: '1.25rem',
  color: '#374151',
  lineHeight: 1,
};

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: NAV_RAIL_WIDTH,
  bottom: 0,
  width: PANEL_WIDTH,
  maxWidth: 'min(320px, calc(100vw - 80px))',
  zIndex: PANEL_Z_INDEX,
  display: 'flex',
  flexDirection: 'column',
  background: '#fff',
  borderRight: '1px solid #e5e7eb',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.75rem 1rem',
  borderBottom: '1px solid #e5e7eb',
  flexShrink: 0,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.125rem',
  fontWeight: 600,
};

const slotStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  borderBottom: '1px solid #e5e7eb',
  fontSize: '0.875rem',
  color: '#6b7280',
};

const listSlotStyle: React.CSSProperties = {
  ...slotStyle,
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
};

const createButtonSlotStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  flexShrink: 0,
  borderTop: '1px solid #e5e7eb',
};

export function ExploreRoutesPanel({
  open,
  onClose,
  onRouteSelect: _onRouteSelect,
  onHighlightRoute: _onHighlightRoute,
}: ExploreRoutesPanelProps) {
  if (!open) return null;

  return (
    <div
      role="complementary"
      aria-label="Explore routes"
      style={panelStyle}
    >
      <header style={headerStyle}>
        <h2 style={titleStyle}>Routes</h2>
        <button type="button" onClick={onClose} aria-label="Close" style={closeButtonStyle}>
          ×
        </button>
      </header>
      <div style={slotStyle} data-slot="filters">
        Filters (All, My routes)
      </div>
      <div style={listSlotStyle} data-slot="route-list">
        Route list
      </div>
      <div style={createButtonSlotStyle} data-slot="create-route">
        Create route
      </div>
    </div>
  );
}
