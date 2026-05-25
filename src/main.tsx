import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const DEBUG_RUN_ID = "hard-reload-pre-fix";
const DEBUG_STORAGE_KEY = "filla-debug-9e499e";

const appGlobal = globalThis as typeof globalThis & {
  __fillaRootInstance?: ReturnType<typeof createRoot>;
  __fillaRemoveChildPatched?: boolean;
  __fillaBootCount?: number;
};

// #region agent log
const debugLog = (
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown>
) => {
  const payload = JSON.stringify({
    sessionId: "9e499e",
    runId: DEBUG_RUN_ID,
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  });
  fetch("http://127.0.0.1:7489/ingest/d316ba9e-0be2-4ce9-a7ae-7380d7b3193b", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "9e499e",
    },
    body: payload,
  }).catch(() => {});
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    navigator.sendBeacon(
      "http://127.0.0.1:7489/ingest/d316ba9e-0be2-4ce9-a7ae-7380d7b3193b",
      new Blob([payload], { type: "application/json" })
    );
  }
};

const readDebugSession = (): Record<string, unknown> | null => {
  try {
    const raw = sessionStorage.getItem(DEBUG_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const writeDebugSession = (patch: Record<string, unknown>) => {
  try {
    const prev = readDebugSession() ?? {};
    sessionStorage.setItem(DEBUG_STORAGE_KEY, JSON.stringify({ ...prev, ...patch }));
  } catch {
    /* ignore */
  }
};
// #endregion

appGlobal.__fillaBootCount = (appGlobal.__fillaBootCount ?? 0) + 1;
const previousSession = readDebugSession();
const reloadGeneration =
  typeof previousSession?.reloadGeneration === "number"
    ? previousSession.reloadGeneration + 1
    : 1;

writeDebugSession({
  reloadGeneration,
  lastEvent: "boot",
  bootAt: Date.now(),
  hasExistingRootOnBoot: Boolean(appGlobal.__fillaRootInstance),
  hasRemoveChildPatchOnBoot: Boolean(appGlobal.__fillaRemoveChildPatched),
});

// #region agent log
debugLog("H1", "main.tsx:boot", "main.tsx module executed", {
  bootCount: appGlobal.__fillaBootCount,
  reloadGeneration,
  previousSession,
  hasExistingRoot: Boolean(appGlobal.__fillaRootInstance),
  hasRemoveChildPatch: Boolean(appGlobal.__fillaRemoveChildPatched),
  hasViteHot: Boolean(import.meta.hot),
  navigationType:
    typeof performance !== "undefined" && "navigation" in performance
      ? (performance as Performance & { navigation?: { type?: number } }).navigation?.type
      : null,
});
// #endregion

if (!appGlobal.__fillaRemoveChildPatched) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function patchedRemoveChild<T extends Node>(child: T): T {
    return originalRemoveChild.call(this, child) as T;
  };
  appGlobal.__fillaRemoveChildPatched = true;
}

// #region agent log
window.addEventListener("pageshow", (event) => {
  debugLog("H3", "main.tsx:pageshow", "pageshow event", {
    persisted: event.persisted,
    bootCount: appGlobal.__fillaBootCount,
    reloadGeneration,
    hasExistingRoot: Boolean(appGlobal.__fillaRootInstance),
  });
});

window.addEventListener("pagehide", () => {
  writeDebugSession({
    lastEvent: "pagehide",
    pagehideAt: Date.now(),
    reloadGeneration,
    hasExistingRootOnHide: Boolean(appGlobal.__fillaRootInstance),
  });
  debugLog("H6", "main.tsx:pagehide", "pagehide event", {
    reloadGeneration,
    hasExistingRoot: Boolean(appGlobal.__fillaRootInstance),
  });
});

if (import.meta.hot) {
  import.meta.hot.on("vite:beforeFullReload", () => {
    debugLog("H6", "main.tsx:viteBeforeFullReload", "vite beforeFullReload", {
      reloadGeneration,
      hasExistingRoot: Boolean(appGlobal.__fillaRootInstance),
    });
  });
  import.meta.hot.on("vite:afterUpdate", () => {
    debugLog("H6", "main.tsx:viteAfterUpdate", "vite afterUpdate", {
      reloadGeneration,
      hasExistingRoot: Boolean(appGlobal.__fillaRootInstance),
    });
  });
}
// #endregion

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

const reusingRoot = Boolean(appGlobal.__fillaRootInstance);
const rootHasReactContainer = Boolean(
  (rootElement as HTMLElement & { _reactRootContainer?: unknown })._reactRootContainer
);

// #region agent log
debugLog("H4", "main.tsx:beforeCreateRoot", "about to create or reuse root", {
  reusingRoot,
  rootHasReactContainer,
  rootChildCount: rootElement.childElementCount,
  bootCount: appGlobal.__fillaBootCount,
});
// #endregion

const root = appGlobal.__fillaRootInstance ?? createRoot(rootElement);
appGlobal.__fillaRootInstance = root;

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// #region agent log
debugLog("H5", "main.tsx:afterRender", "root.render completed", {
  reusingRoot,
  bootCount: appGlobal.__fillaBootCount,
  reloadGeneration,
  rootChildCount: rootElement.childElementCount,
});

requestAnimationFrame(() => {
  debugLog("H5", "main.tsx:afterRenderRaf", "root committed (raf)", {
    reloadGeneration,
    rootChildCount: rootElement.childElementCount,
    rootHasReactContainer: Boolean(
      (rootElement as HTMLElement & { _reactRootContainer?: unknown })._reactRootContainer
    ),
  });
});
// #endregion

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    // #region agent log
    debugLog("H2", "main.tsx:dispose", "vite HMR dispose fired", {
      bootCount: appGlobal.__fillaBootCount,
      hadRoot: Boolean(appGlobal.__fillaRootInstance),
    });
    // #endregion
    root.unmount();
    appGlobal.__fillaRootInstance = undefined;
  });
}
