import React from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="glass-card" style={{ 
          textAlign: 'center', 
          padding: '4rem 2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem'
        }}>
          <div className="icon-wrapper-large" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
            <ShieldAlert size={40} className="text-error" />
          </div>
          <h2 className="text-title" style={{ fontSize: '1.5rem' }}>Something went wrong</h2>
          <p className="text-body-large" style={{ maxWidth: '400px' }}>
            There was an error rendering the content. This is usually due to unexpected data format in the shared feed.
          </p>
          <button 
            className="btn-primary" 
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
          >
            <RefreshCw size={18} />
            Reset Interface
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
