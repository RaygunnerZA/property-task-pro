/**
 * Debug logging — only active when VITE_DEBUG_LOGGING=true.
 * Use for schedule, tasks, and other development tracing.
 */
export const debug = (...args: unknown[]) => {
  if (import.meta.env.VITE_DEBUG_LOGGING === "true") {
    console.log(...args);
  }
};
