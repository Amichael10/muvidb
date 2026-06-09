import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-red-500 bg-red-100/10 rounded-lg">
          <h2 className="text-xl font-bold mb-4">Something went wrong.</h2>
          <pre className="text-xs overflow-auto p-4 bg-black/50 rounded">{this.state.error?.toString()}</pre>
          <pre className="text-[10px] mt-4 overflow-auto p-4 bg-black/50 rounded">{this.state.errorInfo?.componentStack}</pre>
          <button 
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded font-bold"
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
