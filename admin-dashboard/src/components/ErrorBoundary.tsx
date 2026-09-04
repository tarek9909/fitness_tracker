import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './ui';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: 'var(--bg-primary, #09090b)',
          color: 'var(--text-primary, #f4f4f5)',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}>
          <div style={{
            maxWidth: '500px',
            width: '100%',
            background: 'var(--bg-secondary, #111113)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px',
            padding: '32px',
            textAlign: 'center',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          }}>
            <div style={{
              display: 'inline-flex',
              padding: '16px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              marginBottom: '16px',
            }}>
              <AlertTriangle size={36} />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary, #94a3b8)', marginBottom: '24px', lineHeight: 1.5 }}>
              An unexpected error occurred in this view. Your session and backend data remain safe.
            </p>
            {this.state.error && (
              <pre style={{
                textAlign: 'left',
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#f87171',
                overflowX: 'auto',
                marginBottom: '24px',
              }}>
                {this.state.error.message}
              </pre>
            )}
            <Button
              variant="primary"
              icon={<RefreshCw size={16} />}
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
            >
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
