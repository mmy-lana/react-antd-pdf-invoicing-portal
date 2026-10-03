import React from 'react';
import { Button, Result } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Rendered instead of the default recovery screen when supplied. */
  fallback?: (reset: () => void, error: Error) => React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Last line of defence for the render tree (ARCH-01).
 *
 * A throw during render, in a lazy route, or inside the PDF layout pass would
 * otherwise unmount the whole application and leave the operator with a blank
 * page and no way back. The boundary catches it, reports it, and offers a
 * recovery action. Because every write is a Dexie transaction, a failure to
 * render never leaves a partially written invoice behind, so reloading is safe.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Unhandled render failure in the invoicing console.', error, errorInfo.componentStack);
  }

  private readonly handleReset = (): void => {
    this.setState({ error: null });
  };

  private readonly handleReload = (): void => {
    window.location.reload();
  };

  override render(): React.ReactNode {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (!error) return children;
    if (fallback) return fallback(this.handleReset, error);

    return (
      <div
        role="alert"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100dvh',
          padding: 24,
        }}
      >
        <Result
          status="error"
          title="Something went wrong"
          subTitle="The console hit an unexpected error and stopped rendering this screen. Your invoices, payments and audit trail are stored transactionally, so nothing was left half-written."
          extra={
            <Button
              type="primary"
              icon={<ReloadOutlined aria-hidden="true" />}
              onClick={this.handleReload}
              style={{ minHeight: 'var(--touch-target-min, 44px)' }}
            >
              Reload the console
            </Button>
          }
        >
          <details style={{ marginTop: 8, textAlign: 'start' }}>
            <summary style={{ cursor: 'pointer', fontSize: 12.5, color: 'var(--color-text-muted)' }}>
              Technical detail
            </summary>
            <pre
              style={{
                marginTop: 8,
                padding: 12,
                maxHeight: 200,
                overflow: 'auto',
                backgroundColor: 'var(--color-bg-sunken)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm, 3px)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {error.message}
            </pre>
          </details>
        </Result>
      </div>
    );
  }
}
