/** Toast notifications container. Renders toasts from toastStore. */
import { useStore } from 'zustand';
import { toastStore } from '../../store/toastStore';

export function Toast() {
  const toasts = useStore(toastStore, (s) => s.toasts);
  const dismiss = useStore(toastStore, (s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        maxWidth: 360,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          style={{
            padding: '0.75rem 1rem',
            background: t.type === 'error' ? '#fef2f2' : t.type === 'success' ? '#f0fdf4' : '#f0f9ff',
            color: t.type === 'error' ? '#991b1b' : t.type === 'success' ? '#166534' : '#0c4a6e',
            border: `1px solid ${t.type === 'error' ? '#fecaca' : t.type === 'success' ? '#bbf7d0' : '#bae6fd'}`,
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}
        >
          <span style={{ flex: 1, fontSize: '0.875rem' }}>{t.message}</span>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            {t.retry && (
              <button
                type="button"
                onClick={() => {
                  t.retry?.();
                  dismiss(t.id);
                }}
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  background: 'transparent',
                  color: 'inherit',
                  textDecoration: 'underline',
                }}
              >
                Retry
              </button>
            )}
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              style={{
                padding: '0.25rem',
                fontSize: '0.75rem',
                cursor: 'pointer',
                border: 'none',
                background: 'transparent',
                color: 'inherit',
                opacity: 0.8,
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
