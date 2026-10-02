import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    // Send to error tracking service in production
    if (import.meta.env.PROD) {
      // Example: Sentry.captureException(error);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="empty-state">
          <div className="icon">⚠️</div>
          <h3>Something went wrong</h3>
          <p style={{ marginTop: 8 }}>{this.state.error?.message}</p>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 16 }} onClick={() => window.location.reload()}>
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
