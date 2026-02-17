/** Reusable overlay card: consistent title, close button, and content layout. */
import { forwardRef } from 'react';

export interface OverlayCardProps {
  /** Title shown in header (centered). */
  title: string;
  /** Callback when close (×) is clicked. When provided, the close button is shown. */
  onClose?: () => void;
  /** Accessible label. Required when variant is 'dialog'. */
  'aria-label'?: string;
  /** Card content below the header. */
  children: React.ReactNode;
  /** Max width in pixels. Default 480. */
  maxWidth?: number;
  /** Optional id for the card container (e.g. for focus trap). */
  id?: string;
  /**
   * 'dialog' = card is the dialog (role="dialog", aria-modal). Use for standalone overlays.
   * 'card' = card is content inside a parent dialog. Use when wrapped in a backdrop dialog.
   */
  variant?: 'dialog' | 'card';
}

const cardStyle: React.CSSProperties = {
  padding: '1.25rem 2rem 2rem',
  maxWidth: 480,
  width: '90vw',
  background: 'rgba(255,255,255,0.97)',
  borderRadius: 12,
  boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
  textAlign: 'center',
};

const headerStyle: React.CSSProperties = {
  position: 'relative',
  marginBottom: '0.5rem',
};

const titleStyle: React.CSSProperties = {
  fontSize: '2rem',
  margin: 0,
  textAlign: 'center',
};

const closeButtonStyle: React.CSSProperties = {
  position: 'absolute',
  right: 0,
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'none',
  border: 'none',
  fontSize: '1.5rem',
  cursor: 'pointer',
  color: '#6b7280',
  lineHeight: 1,
  padding: 0,
};

export const OverlayCard = forwardRef<HTMLDivElement, OverlayCardProps>(
  function OverlayCard({ title, onClose, 'aria-label': ariaLabel, children, maxWidth = 480, id, variant = 'dialog' }, ref) {
    const isDialog = variant === 'dialog';
    return (
      <div
        ref={ref}
        id={id}
        role={isDialog ? 'dialog' : undefined}
        aria-modal={isDialog ? true : undefined}
        aria-label={isDialog ? ariaLabel : undefined}
        style={{ ...cardStyle, maxWidth: maxWidth }}
      >
        <div style={headerStyle}>
          <h1 style={titleStyle}>{title}</h1>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={closeButtonStyle}
            >
              ×
            </button>
          )}
        </div>
        {children}
      </div>
    );
  }
);
