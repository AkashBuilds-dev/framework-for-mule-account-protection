/**
 * ==============================================================================
 * MuleShield (SIH26184) - Forensic-Grade Error Boundary (ADDITION 5)
 * ==============================================================================
 * Prevents catastrophic UI crashes, logs diagnostic stacktraces, and renders
 * a graceful recovery interface with "Reload Telemetry" action.
 * ==============================================================================
 */

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0A0E1A] text-slate-200 flex flex-col items-center justify-center p-6">
          <div className="max-w-lg w-full bg-[#111827] border border-red-500/30 rounded-xl p-8 shadow-2xl text-center">
            <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-5 text-red-400">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h2 className="text-xl font-semibold text-white tracking-tight">
              Investigator UI Module Interrupted
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              A subsystem encountered an unexpected state. The background telemetry and WebSocket connection remain active.
            </p>

            <div className="bg-[#0A0E1A] border border-slate-800 rounded-lg p-3 text-left font-mono text-xs text-red-300/80 my-5 overflow-auto max-h-36">
              {this.state.error?.toString() || 'Unknown runtime exception'}
            </div>

            <button
              onClick={this.handleReset}
              className="inline-flex items-center justify-center space-x-2 w-full py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition duration-150 shadow-lg shadow-cyan-600/20"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Command Hub</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
