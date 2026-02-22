/** Placeholder for Explore routes panel until Phase 4. Opens beside the nav rail when "Routes" is clicked. */
import { useRef, useEffect } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { NAV_RAIL_WIDTH } from './DrawerMenu';

export interface RoutesPanelPlaceholderProps {
  onClose: () => void;
}

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: NAV_RAIL_WIDTH,
  bottom: 0,
  width: 280,
  maxWidth: 'min(320px, calc(100vw - 80px))',
  zIndex: 999,
  padding: '0.75rem 1rem 1rem',
  background: '#fff',
  borderRight: '1px solid #e5e7eb',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
};

export function RoutesPanelPlaceholder({ onClose }: RoutesPanelPlaceholderProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useFocusTrap(panelRef, { active: true });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Routes panel" style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Explore routes</h2>
        <button type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
        Routes panel (My routes, Create route) will be available here in a later update.
      </p>
    </div>
  );
}
