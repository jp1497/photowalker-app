import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary';

const rootEl = document.getElementById('root');
if (!rootEl) {
  document.body.innerHTML = '<pre style="padding:2rem;font-family:monospace">Root element #root not found.</pre>';
} else {
  try {
    const root = createRoot(rootEl, {
      onUncaughtError: (error: unknown) => {
        console.error('React uncaught error:', error);
        const msg = error instanceof Error ? error.message : String(error);
        rootEl.innerHTML = `<div style="padding:2rem;font-family:system-ui"><h1 style="color:#c00">Error</h1><pre>${msg}</pre></div>`;
      },
    });
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    rootEl.innerHTML = `<div style="padding:2rem;font-family:system-ui"><h1 style="color:#c00">Bootstrap error</h1><pre>${message}</pre></div>`;
  }
}
