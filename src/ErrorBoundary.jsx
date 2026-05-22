import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
    this.setState({ info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', background: '#f87171', color: 'white', borderRadius: '8px', margin: '20px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold' }}>Something went wrong.</h1>
          <pre style={{ marginTop: '10px', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
            {this.state.error?.toString()}
          </pre>
          <pre style={{ marginTop: '10px', fontSize: '10px', whiteSpace: 'pre-wrap' }}>
            {this.state.info?.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
