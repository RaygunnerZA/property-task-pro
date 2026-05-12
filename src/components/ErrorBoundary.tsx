import React from "react";
import { RegionErrorFallback } from "@/components/errors/RegionErrorFallback";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  /** Short label for the wrapped region (used in the default fallback). */
  regionTitle?: string;
  /** Called when the user taps “Try again” before the boundary clears (e.g. `queryClient.invalidateQueries()`). */
  onRetryReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  private handleRetry = () => {
    this.props.onRetryReset?.();
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const title = this.props.regionTitle ?? "Something went wrong";
      const message = this.state.error?.message ?? this.state.error?.toString() ?? "";

      return (
        <RegionErrorFallback
          title={title}
          description={message || "Unexpected error."}
          onRetry={this.handleRetry}
          className="m-3"
        />
      );
    }

    return this.props.children;
  }
}
