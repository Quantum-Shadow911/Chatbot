"use client";

import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Render error:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm font-semibold text-red-300">
            Something went wrong while rendering this view.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
