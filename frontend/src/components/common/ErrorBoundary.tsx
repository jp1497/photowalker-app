/** Catches render errors and displays them so they are visible on screen. */
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: '2rem',
            maxWidth: '640px',
            margin: '0 auto',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h1 style={{ color: '#c00', marginTop: 0 }}>Something went wrong</h1>
          <pre
            style={{
              background: '#f5f5f5',
              padding: '1rem',
              overflow: 'auto',
              fontSize: '14px',
            }}
          >
            {this.state.error.message}
          </pre>
          {this.state.error.stack && (
            <details style={{ marginTop: '1rem' }}>
              <summary>Stack trace</summary>
              <pre style={{ fontSize: '12px', overflow: 'auto' }}>{this.state.error.stack}</pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
