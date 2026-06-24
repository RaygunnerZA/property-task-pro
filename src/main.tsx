import React from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

type MainHotData = {
  root?: Root;
};

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

function getOrCreateRoot(): Root {
  if (import.meta.hot) {
    const data = import.meta.hot.data as MainHotData;
    if (data.root) {
      return data.root;
    }
    const root = createRoot(rootElement);
    data.root = root;
    import.meta.hot.dispose((nextData) => {
      (nextData as MainHotData).root = root;
    });
    return root;
  }
  return createRoot(rootElement);
}

const root = getOrCreateRoot();

function renderApp() {
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}

renderApp();

// bfcache restore can leave a frozen React tree without re-running the entry module.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});

if (import.meta.hot) {
  // #region agent log
  const logHmr = (
    message: string,
    data: Record<string, unknown>,
    hypothesisId: string
  ) => {
    fetch("http://127.0.0.1:7410/ingest/6d369163-f131-49c2-8952-c57e2a819080", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "6c6776",
      },
      body: JSON.stringify({
        sessionId: "6c6776",
        location: "main.tsx:hmr",
        message,
        data,
        hypothesisId,
        timestamp: Date.now(),
        runId: "pre-fix",
      }),
    }).catch(() => {});
  };

  import.meta.hot.on("vite:beforeUpdate", (payload) => {
    logHmr(
      "vite:beforeUpdate",
      {
        updates: payload.updates?.map((u) => ({ path: u.path, type: u.type })),
      },
      "A"
    );
  });
  import.meta.hot.on("vite:beforeFullReload", (payload) => {
    logHmr(
      "vite:beforeFullReload",
      { path: payload.path, triggeredBy: payload.triggeredBy },
      "A"
    );
  });
  import.meta.hot.on("vite:error", (payload) => {
    logHmr("vite:error", { err: String(payload.err) }, "E");
  });
  import.meta.hot.on("vite:invalidate", (payload) => {
    logHmr(
      "vite:invalidate",
      { path: payload.path, message: payload.message },
      "A"
    );
  });
  // #endregion

  import.meta.hot.accept("./App.tsx", () => {
    // #region agent log
    logHmr("app-accepted-rerender", {}, "C");
    // #endregion
    renderApp();
  });
}
