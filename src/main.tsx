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
  import.meta.hot.accept("./App.tsx", () => {
    renderApp();
  });
}
