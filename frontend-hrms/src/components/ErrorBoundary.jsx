import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('HRMS Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: 20, textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: 'var(--muted-fg)', marginBottom: 16 }}>An unexpected error occurred. Please try again.</p>
          <button className="btn btn-primary" onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = import.meta.env.BASE_URL; }}>
            Go to Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
