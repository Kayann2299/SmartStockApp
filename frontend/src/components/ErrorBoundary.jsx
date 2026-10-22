import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Uncaught error in UI:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="page-center" style={{ padding: '2rem' }}>
          <div className="card" style={{ maxWidth: 700 }}>
            <h3>Something went wrong</h3>
            <div className="muted" style={{ whiteSpace: 'pre-wrap' }}>{String(this.state.error)}</div>
            <div style={{ marginTop: '1rem' }}>
              <small className="muted">Check the browser console for a full stack trace.</small>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
