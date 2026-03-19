import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const appGlobal = globalThis as typeof globalThis & {
  __fillaRootInstance?: ReturnType<typeof createRoot>;
  __fillaRemoveChildPatched?: boolean;
  __fillaGlobalErrorPatched?: boolean;
};

if (!appGlobal.__fillaRemoveChildPatched) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function patchedRemoveChild<T extends Node>(child: T): T {
    try {
      return originalRemoveChild.call(this, child) as T;
    } catch (error) {
      throw error;
    }
  };
  appGlobal.__fillaRemoveChildPatched = true;
}

if (!appGlobal.__fillaGlobalErrorPatched) {
  window.addEventListener("error", (event) => {
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/d316ba9e-0be2-4ce9-a7ae-7380d7b3193b", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "0d80ed",
      },
      body: JSON.stringify({
        sessionId: "0d80ed",
        runId: "post-fix-2",
        hypothesisId: "H12",
        location: "main.tsx:window.error",
        message: "Global error event",
        data: {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          errorName: event.error instanceof Error ? event.error.name : null,
          errorMessage: event.error instanceof Error ? event.error.message : null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  });

  window.addEventListener("unhandledrejection", (event) => {
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/d316ba9e-0be2-4ce9-a7ae-7380d7b3193b", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "0d80ed",
      },
      body: JSON.stringify({
        sessionId: "0d80ed",
        runId: "post-fix-2",
        hypothesisId: "H12",
        location: "main.tsx:window.unhandledrejection",
        message: "Global unhandled rejection",
        data: {
          reason:
            event.reason instanceof Error
              ? { name: event.reason.name, message: event.reason.message }
              : String(event.reason),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  });

  appGlobal.__fillaGlobalErrorPatched = true;
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
const reusedExistingRoot = !!appGlobal.__fillaRootInstance;
const root = appGlobal.__fillaRootInstance ?? createRoot(rootElement);
appGlobal.__fillaRootInstance = root;
// #region agent log
fetch("http://127.0.0.1:7242/ingest/d316ba9e-0be2-4ce9-a7ae-7380d7b3193b", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Debug-Session-Id": "0d80ed",
  },
  body: JSON.stringify({
    sessionId: "0d80ed",
    runId: "post-fix-2",
    hypothesisId: "H13",
    location: "main.tsx:root",
    message: "Root render cycle",
    data: { reusedExistingRoot },
    timestamp: Date.now(),
  }),
}).catch(() => {});
// #endregion

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
