import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const appGlobal = globalThis as typeof globalThis & {
  __fillaRootInstance?: ReturnType<typeof createRoot>;
  __fillaRemoveChildPatched?: boolean;
};

if (!appGlobal.__fillaRemoveChildPatched) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function patchedRemoveChild<T extends Node>(child: T): T {
    try {
      return originalRemoveChild.call(this, child) as T;
    } catch (error) {
      // #region agent log
      fetch("http://127.0.0.1:7242/ingest/d316ba9e-0be2-4ce9-a7ae-7380d7b3193b", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "0d80ed",
        },
        body: JSON.stringify({
          sessionId: "0d80ed",
          runId: "initial",
          hypothesisId: "H5",
          location: "main.tsx:Node.removeChild",
          message: "removeChild failed",
          data: {
            errorName: error instanceof Error ? error.name : "UnknownError",
            errorMessage: error instanceof Error ? error.message : String(error),
            parentTag: this instanceof Element ? this.tagName : this.nodeName,
            childTag: child instanceof Element ? child.tagName : child.nodeName,
            parentChildCount: this.childNodes?.length ?? null,
            parentHasChild: this.contains(child),
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      throw error;
    }
  };
  appGlobal.__fillaRemoveChildPatched = true;
}

// Error boundary for development
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/d316ba9e-0be2-4ce9-a7ae-7380d7b3193b", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "0d80ed",
      },
      body: JSON.stringify({
        sessionId: "0d80ed",
        runId: "initial",
        hypothesisId: "H6",
        location: "main.tsx:ErrorBoundary.componentDidCatch",
        message: "Boundary captured error",
        data: {
          errorName: error.name,
          errorMessage: error.message,
          componentStack: errorInfo.componentStack?.slice(0, 400),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "20px", fontFamily: "monospace" }}>
          <h1>Something went wrong</h1>
          <pre>{this.state.error?.toString()}</pre>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}
const root = appGlobal.__fillaRootInstance ?? createRoot(rootElement);
appGlobal.__fillaRootInstance = root;

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
