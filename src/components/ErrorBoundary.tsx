import React from "react";

type ErrorBoundaryProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    // Keep it minimal (no noisy logging). If needed, hook into Sentry later.
    // console.error(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="p-4">
            <div className="rounded-[8px] bg-card shadow-e1 border border-border/50 p-4">
              <div className="text-sm font-semibold text-foreground">Something went wrong</div>
              <div className="mt-1 text-xs text-muted-foreground">
                The Schedule panel crashed while rendering.
              </div>
              {this.state.error?.message ? (
                <pre className="mt-3 whitespace-pre-wrap text-[11px] text-muted-foreground/80">
                  {this.state.error.message}
                </pre>
              ) : null}
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

