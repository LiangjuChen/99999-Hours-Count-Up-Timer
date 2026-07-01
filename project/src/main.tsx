import { Component, ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; errorMessage: string }> {
  state = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  private enableLocalMode = () => {
    try {
      localStorage.setItem('forceLocalOnly', 'true');
    } catch {
      // Ignore storage failures and still attempt a refresh.
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4 text-center text-gray-100">
          <div className="max-w-2xl">
            <h1 className="mb-4 text-3xl font-bold">99999 Hours Count Up Timer</h1>
            <p className="mb-4 text-lg text-gray-300">Timer failed to load.</p>
            {this.state.errorMessage && (
              <pre className="mb-6 whitespace-pre-wrap rounded-lg bg-gray-800 p-4 text-left text-sm text-red-200">
                {this.state.errorMessage}
              </pre>
            )}
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="rounded-lg bg-gray-700 px-4 py-2 font-medium text-white transition-colors hover:bg-gray-600"
              >
                Refresh
              </button>
              <button
                onClick={this.enableLocalMode}
                className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition-colors hover:bg-emerald-700"
              >
                Use local mode
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>
);
