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

const hotData = (import.meta.hot?.data ?? {}) as MainHotData;
let root = hotData.root ?? createRoot(rootElement);
if (import.meta.hot) {
  import.meta.hot.data.root = root;
}

let mountGeneration = 0;
let afterUpdateRemountTimer: ReturnType<typeof setTimeout> | undefined;

function renderApp() {
  mountGeneration += 1;
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App key={mountGeneration} />
      </ErrorBoundary>
    </React.StrictMode>
  );
}

function scheduleRemountAfterHmr() {
  if (afterUpdateRemountTimer) {
    clearTimeout(afterUpdateRemountTimer);
  }
  // Collapse bursts of vite:afterUpdate (Cursor Browser hard reload) into one remount.
  afterUpdateRemountTimer = setTimeout(() => {
    afterUpdateRemountTimer = undefined;
    renderApp();
  }, 50);
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

  import.meta.hot.on("vite:beforeFullReload", () => {
    root.unmount();
  });

  // Cursor Browser "hard reload" often triggers HMR without re-running main.tsx.
  import.meta.hot.on("vite:afterUpdate", () => {
    scheduleRemountAfterHmr();
  });

  import.meta.hot.dispose(() => {
    if (afterUpdateRemountTimer) {
      clearTimeout(afterUpdateRemountTimer);
      afterUpdateRemountTimer = undefined;
    }
    root.unmount();
    delete (import.meta.hot?.data as MainHotData).root;
  });
}
