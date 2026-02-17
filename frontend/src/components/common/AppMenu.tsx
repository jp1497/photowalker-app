/** Minimal app menu: trigger button opens popup with nav links and Sign in/out. */
import { useEffect, useRef, useState } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const MENU_BUTTON_ID = 'app-menu-trigger';
const MENU_POPUP_ID = 'app-menu-popup';

export function AppMenu() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useFocusTrap(popupRef, { active: open, returnFocusRef: triggerRef });

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const closeAndNavigate = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={MENU_BUTTON_ID}
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={MENU_POPUP_ID}
        aria-label="Open menu"
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed',
          top: '0.75rem',
          left: '0.75rem',
          zIndex: 1000,
          padding: '0.5rem 0.75rem',
          fontSize: '1rem',
          cursor: 'pointer',
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        Menu
      </button>

      {open && (
        <>
          <div
            role="presentation"
            aria-hidden="true"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1001,
              background: 'rgba(0,0,0,0.3)',
            }}
            onClick={() => setOpen(false)}
          />
          <div
            ref={popupRef}
            id={MENU_POPUP_ID}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            style={{
              position: 'fixed',
              top: '3rem',
              left: '0.75rem',
              zIndex: 1002,
              minWidth: 200,
              padding: '0.5rem 0',
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            <nav style={{ display: 'flex', flexDirection: 'column' }}>
              <Link
                to="/"
                onClick={() => closeAndNavigate('/')}
                style={{ padding: '0.5rem 1rem', textDecoration: 'none', color: 'inherit', textAlign: 'left' }}
              >
                Home
              </Link>
              <Link
                to="/browse"
                onClick={() => closeAndNavigate('/browse')}
                style={{ padding: '0.5rem 1rem', textDecoration: 'none', color: 'inherit', textAlign: 'left' }}
              >
                Browse
              </Link>
              {isAuthenticated ? (
                <>
                  <Link
                    to="/routes/me"
                    state={{ openDrawer: true }}
                    onClick={() => setOpen(false)}
                    style={{ padding: '0.5rem 1rem', textDecoration: 'none', color: 'inherit', textAlign: 'left' }}
                  >
                    My routes
                  </Link>
                  <Link
                    to="/routes/create"
                    state={{ openDrawer: true }}
                    onClick={() => setOpen(false)}
                    style={{ padding: '0.5rem 1rem', textDecoration: 'none', color: 'inherit', textAlign: 'left' }}
                  >
                    Create route
                  </Link>
                  <span style={{ padding: '0.5rem 1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                    {user?.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      logout();
                    }}
                    style={{
                      margin: '0.25rem 0.5rem 0',
                      padding: '0.5rem 1rem',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '1rem',
                    }}
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  onClick={() => closeAndNavigate('/login')}
                  style={{ padding: '0.5rem 1rem', textDecoration: 'none', color: 'inherit', textAlign: 'left' }}
                >
                  Sign in
                </Link>
              )}
            </nav>
          </div>
        </>
      )}
    </>
  );
}
