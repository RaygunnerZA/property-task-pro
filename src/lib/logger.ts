export const log = {
  info: (...args: any[]) => console.log('[INFO]', ...args),
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args),
};

/**
 * Silent debug logging to ndjson ingest server
 * Handles connection errors gracefully without polluting console
 * 
 * Strategy: Only enabled when VITE_DEBUG_LOGGING=true is set
 * Otherwise, silently skip all requests to prevent console errors
 */
const DEBUG_SERVER_ENABLED = 
  import.meta.env.VITE_DEBUG_LOGGING === 'true' && 
  import.meta.env.DEV && 
  typeof window !== 'undefined';
let serverAvailable: boolean | null = null;
let pendingCheck: Promise<boolean> | null = null;

/**
 * Debug log to ndjson ingest server (silent if server unavailable or disabled)
 * Prevents console errors when debug server is not running
 * 
 * To enable: Set VITE_DEBUG_LOGGING=true in your .env file
 */
export function debugLog(payload: {
  location: string;
  message: string;
  data?: any;
  timestamp?: number;
  sessionId?: string;
  runId?: string;
  hypothesisId?: string;
}): void {
  // Only attempt if explicitly enabled via environment variable
  if (!DEBUG_SERVER_ENABLED) return;

  // If we've determined server is unavailable, skip all requests
  if (serverAvailable === false) return;

  // Batch multiple rapid calls by using a pending check promise
  const attemptLog = async () => {
    if (serverAvailable === false) return;

    try {
      // Use AbortController with very short timeout to fail fast
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 150);

      const response = await fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          timestamp: payload.timestamp ?? Date.now(),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      // If first request succeeds, mark server as available
      if (serverAvailable === null) {
        serverAvailable = response.ok;
      }
    } catch (err: any) {
      // On first failure, mark server as unavailable to prevent future attempts
      if (serverAvailable === null) {
        serverAvailable = false;
        // Suppress the error - don't propagate or log
      }
      // Silently ignore subsequent failures
    }
  };

  // If we have a pending check, wait for it; otherwise start a new one
  if (pendingCheck) {
    pendingCheck.then(() => attemptLog());
  } else {
    pendingCheck = attemptLog().then(() => true).catch(() => false);
    // Reset pending check after a delay to allow batching
    setTimeout(() => {
      pendingCheck = null;
    }, 100);
  }
}
