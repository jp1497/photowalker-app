/** Circular account icon in top-right: avatar or user icon, dropdown with Sign in, Settings, Sign out only. */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useFocusTrap } from '../../hooks/useFocusTrap';

const ACCOUNT_ICON_ID = 'account-icon-trigger';
const ACCOUNT_MENU_ID = 'account-icon-menu';

function UserIconSvg() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </svg>
  );
}

function getInitials(name: string | undefined): string {
  if (!name || !name.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2);
  }
  return name.slice(0, 2).toUpperCase();
}

const triggerStyle: React.CSSProperties = {
  position: 'fixed',
  top: '0.75rem',
  right: '0.75rem',
  zIndex: 1000,
  width: 40,
  height: 40,
  padding: 0,
  borderRadius: '50%',
  border: '1px solid #e5e7eb',
  background: '#fff',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
};

const menuStyle: React.CSSProperties = {
  position: 'fixed',
  top: '3.5rem',
  right: '0.75rem',
  zIndex: 1002,
  minWidth: 180,
  padding: '0.5rem 0',
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
};

const menuItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '0.5rem 1rem',
  textAlign: 'left',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '1rem',
  textDecoration: 'none',
  color: 'inherit',
  fontFamily: 'inherit',
};

export function AccountIcon() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useFocusTrap(menuRef, { active: open, returnFocusRef: triggerRef });

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

  const handleSignIn = () => {
    setOpen(false);
    navigate('/login');
  };

  const handleSignOut = () => {
    setOpen(false);
    logout();
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={ACCOUNT_ICON_ID}
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={ACCOUNT_MENU_ID}
        aria-label={open ? 'Close account menu' : 'Open account menu'}
        onClick={() => setOpen(!open)}
        style={triggerStyle}
      >
        {isAuthenticated && user ? (
          user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt=""
              width={40}
              height={40}
              style={{ display: 'block', objectFit: 'cover' }}
            />
          ) : (
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
              {getInitials(user.name)}
            </span>
          )
        ) : (
          <span style={{ color: '#6b7280' }}>
            <UserIconSvg />
          </span>
        )}
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
            ref={menuRef}
            id={ACCOUNT_MENU_ID}
            role="menu"
            aria-label="Account menu"
            style={menuStyle}
          >
            {!isAuthenticated ? (
              <button type="button" role="menuitem" style={menuItemStyle} onClick={handleSignIn}>
                Sign in
              </button>
            ) : null}
            <Link
              to="/settings"
              role="menuitem"
              style={menuItemStyle}
              onClick={() => setOpen(false)}
            >
              Settings
            </Link>
            {isAuthenticated ? (
              <button type="button" role="menuitem" style={menuItemStyle} onClick={handleSignOut}>
                Sign out
              </button>
            ) : null}
          </div>
        </>
      )}
    </>
  );
}
