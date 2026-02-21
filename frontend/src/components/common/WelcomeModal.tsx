/** Dismissible welcome modal for Browse: app description, Browse the map, Create account, Maybe later. */
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { OverlayCard } from './OverlayCard';
import { useFocusTrap } from '../../hooks/useFocusTrap';

const SESSION_STORAGE_KEY = 'photowalker_welcome_dismissed';

export function getWelcomeDismissed(): boolean {
  try {
    return sessionStorage.getItem(SESSION_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setWelcomeDismissed(): void {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, '1');
  } catch {
    // ignore
  }
}

export interface WelcomeModalProps {
  open: boolean;
  onDismiss: () => void;
}

const descriptionStyle: React.CSSProperties = {
  fontSize: '1.125rem',
  color: '#6b7280',
  marginBottom: '1.5rem',
  lineHeight: 1.6,
};

const buttonRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '1rem',
  justifyContent: 'center',
  flexWrap: 'wrap',
};

const primaryButtonStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '0.75rem 1.5rem',
  background: '#2563eb',
  color: 'white',
  border: 'none',
  borderRadius: 8,
  fontWeight: 500,
  cursor: 'pointer',
  fontSize: '1rem',
};

const secondaryButtonStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  background: 'transparent',
  color: '#2563eb',
  border: '2px solid #2563eb',
};

const laterButtonStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  background: 'transparent',
  color: '#6b7280',
  border: '1px solid #d1d5db',
};

export function WelcomeModal({ open, onDismiss }: WelcomeModalProps) {
  const navigate = useNavigate();
  const modalRef = useRef<HTMLDivElement>(null);

  useFocusTrap(modalRef, { active: open });

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setWelcomeDismissed();
        onDismiss();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onDismiss]);

  const handleBrowseTheMap = () => {
    onDismiss();
  };

  const handleCreateAccount = () => {
    onDismiss();
    navigate('/login');
  };

  const handleMaybeLater = () => {
    setWelcomeDismissed();
    onDismiss();
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 400,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'auto',
          zIndex: 401,
        }}
      >
        <OverlayCard
          ref={modalRef}
          title="photowalker"
          onClose={() => {
            setWelcomeDismissed();
            onDismiss();
          }}
          aria-label="Welcome"
          variant="dialog"
        >
          <p style={descriptionStyle}>
            Create photowalks, share them with others and discover a new side of your city
          </p>
          <div style={buttonRowStyle}>
            <button type="button" onClick={handleBrowseTheMap} style={primaryButtonStyle}>
              Browse the map
            </button>
            <button type="button" onClick={handleCreateAccount} style={secondaryButtonStyle}>
              Create account
            </button>
            <button type="button" onClick={handleMaybeLater} style={laterButtonStyle}>
              Maybe later
            </button>
          </div>
        </OverlayCard>
      </div>
    </div>
  );
}
