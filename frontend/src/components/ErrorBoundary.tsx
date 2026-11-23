import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

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
    error: null
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
        <div className="min-h-screen bg-[#F7F7F3] flex items-center justify-center p-6 text-[#14243A]">
          <div className="max-w-md w-full bg-white rounded-2xl border border-red-200 shadow-elevated p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-[#C44747] flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#14243A]">Application Interface Notice</h2>
              <p className="text-xs text-[#64748B] mt-1">
                An unexpected component rendering issue occurred.
              </p>
            </div>
            <div className="p-3 bg-red-50 rounded-xl text-xs text-red-800 text-left font-mono break-words">
              {this.state.error?.message || 'Unknown runtime error'}
            </div>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#14243A] text-white hover:bg-[#0C1728] transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Page</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
