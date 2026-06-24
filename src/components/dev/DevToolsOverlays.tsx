import { useEffect, useState, type ComponentType } from "react";
import { useDevMode } from "@/context/useDevMode";
import { isDevBuild } from "@/context/DevModeContext";

const loadAIDebugPanel = () => import("@/components/dev/AIDebugPanel");
const loadViewportSimulator = () => import("@/components/dev/ViewportSimulator");

async function loadWithRetry<T>(
  loader: () => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await loader();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const isChunkFetchFailure =
        error instanceof TypeError &&
        /Failed to fetch dynamically imported module|Importing a module script failed/i.test(
          message
        );
      if (!isChunkFetchFailure || attempt === maxAttempts - 1) break;
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
  throw lastError;
}

function DevLazyMount({
  enabled,
  load,
  label,
}: {
  enabled: boolean;
  load: () => Promise<{ default: ComponentType }>;
  label: string;
}) {
  const [Component, setComponent] = useState<ComponentType | null>(null);

  useEffect(() => {
    if (!enabled) {
      setComponent(null);
      return;
    }

    let cancelled = false;

    void loadWithRetry(load)
      .then((mod) => {
        if (!cancelled) setComponent(() => mod.default);
      })
      .catch((error) => {
        console.warn(`[DevTools] Failed to load ${label}:`, error);
        if (!cancelled) setComponent(null);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, label, load]);

  if (!Component) return null;
  return <Component />;
}

/**
 * Dev-only overlays — loaded on demand so HMR / dev-server restarts do not
 * break the main app shell.
 */
export function DevToolsOverlays() {
  const devMode = useDevMode();

  return (
    <>
      <DevLazyMount
        enabled={import.meta.env.DEV && devMode.showAIDebugPanel}
        load={loadAIDebugPanel}
        label="AI Debug Panel"
      />
      <DevLazyMount
        enabled={isDevBuild && devMode.showViewportSimulator}
        load={loadViewportSimulator}
        label="Viewport Simulator"
      />
    </>
  );
}
