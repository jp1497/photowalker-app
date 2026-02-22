/**
 * Shared bottom-anchored drawer for route view and create flow (PRD v6 FR-U4).
 *
 * Contract:
 * - Props: open, onClose, children, optional title, optional peekContent (ReactNode for peek strip).
 * - Peek state: shows a strip (title bar or peekContent) so the map remains largely visible.
 * - Expanded state: user expands via button or clicking the peek bar; shows full scrollable content.
 * - Height uses max-height (e.g. 80vh) and relative height (e.g. 60%) so a future drag handle or
 *   full-height expand on mobile is not blocked. No single fixed pixel height for expanded state.
 * - z-index: above map/panel, below modals (lightbox, login). Use returnFocusRef to restore focus to trigger on close.
 * - Left edge aligns with the app nav rail (DrawerMenu) so the drawer starts where the menu bar finishes.
 */
import { useEffect, useRef, useState } from 'react';
import { NAV_RAIL_WIDTH } from './DrawerMenu';
import { useFocusTrap } from '../../hooks/useFocusTrap';

const DRAWER_Z_INDEX = 600;

export interface BottomDrawerProps {
  /** When true, the drawer is visible (peek or expanded). */
  open: boolean;
  /** Called when the drawer should close (close button, Escape, or backdrop if desired). */
  onClose: () => void;
  /** Main content when expanded; must be scrollable-friendly. */
  children: React.ReactNode;
  /** Optional title shown in the peek bar and in the expanded header. */
  title?: string;
  /** Optional content for the peek strip only (e.g. one line or thumbnail). If not set, title is used. */
  peekContent?: React.ReactNode;
  /** Optional ref for the element that opened the drawer; focus returns here on close. */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

const peekBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem',
  padding: '0.5rem 0.75rem 0.5rem 1rem',
  minHeight: 48,
  background: 'rgba(255,255,255,0.97)',
  borderTopLeftRadius: 12,
  borderTopRightRadius: 12,
  boxShadow: '0 -2px 10px rgba(0,0,0,0.08)',
  cursor: 'pointer',
};

const expandButtonStyle: React.CSSProperties = {
  flexShrink: 0,
  background: 'none',
  border: 'none',
  padding: '0.25rem',
  cursor: 'pointer',
  fontSize: '1.25rem',
  color: '#6b7280',
  lineHeight: 1,
};

const expandedContainerStyle: React.CSSProperties = {
  maxHeight: '80vh',
  height: '60%',
  display: 'flex',
  flexDirection: 'column',
  background: 'rgba(255,255,255,0.97)',
  borderTopLeftRadius: 12,
  borderTopRightRadius: 12,
  boxShadow: '0 -2px 20px rgba(0,0,0,0.12)',
};

const expandedHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem',
  padding: '0.5rem 1rem',
  borderBottom: '1px solid #e5e7eb',
  flexShrink: 0,
};

const expandedTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.25rem',
  fontWeight: 600,
};

const closeButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: '0.25rem',
  cursor: 'pointer',
  fontSize: '1.5rem',
  color: '#6b7280',
  lineHeight: 1,
};

const scrollAreaStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
};

export function BottomDrawer({
  open,
  onClose,
  children,
  title,
  peekContent,
  returnFocusRef,
}: BottomDrawerProps) {
  const [expanded, setExpanded] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useFocusTrap(drawerRef, {
    active: open && expanded,
    returnFocusRef,
    autoFocus: true,
  });

  useEffect(() => {
    if (!open) {
      const id = setTimeout(() => setExpanded(false), 0);
      return () => clearTimeout(id);
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        e.preventDefault();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handlePeekBarClick = () => {
    setExpanded(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title ?? 'Drawer'}
      style={{
        position: 'fixed',
        left: NAV_RAIL_WIDTH,
        right: 0,
        bottom: 0,
        zIndex: DRAWER_Z_INDEX,
        pointerEvents: 'auto',
      }}
    >
      {!expanded ? (
        <div
          role="region"
          aria-label={title ?? 'Drawer peek'}
          style={peekBarStyle}
          onClick={handlePeekBarClick}
        >
          <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {peekContent ?? title ?? 'Details'}
          </span>
          <button
            type="button"
            style={expandButtonStyle}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(true);
            }}
            aria-label="Expand"
            aria-expanded="false"
          >
            &#9650;
          </button>
        </div>
      ) : (
        <div ref={drawerRef} style={expandedContainerStyle}>
          <header style={expandedHeaderStyle}>
            <h2 style={expandedTitleStyle}>{title ?? 'Details'}</h2>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label="Collapse"
              style={closeButtonStyle}
            >
              &#9660;
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={closeButtonStyle}
            >
              ×
            </button>
          </header>
          <div style={scrollAreaStyle}>{children}</div>
        </div>
      )}
    </div>
  );
}
