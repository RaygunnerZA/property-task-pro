/**
 * useDevMode hook — extracted for Fast Refresh compatibility.
 *
 * Re-exports the hook from DevModeContext so that DevModeContext.tsx
 * only exports React components (DevModeProvider), satisfying the
 * react-refresh/only-export-components rule.
 */
export { useDevMode } from "./DevModeContext";
