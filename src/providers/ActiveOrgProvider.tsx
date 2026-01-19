import { createContext, useContext, ReactNode } from "react";
import { useActiveOrgInternal, UseActiveOrgResult } from "@/hooks/useActiveOrg";

// Export context for use in useActiveOrg hook
export const ActiveOrgContext = createContext<UseActiveOrgResult | undefined>(undefined);

/**
 * Internal hook to access ActiveOrg context.
 * Returns undefined if context is not available (provider not mounted).
 */
export function useActiveOrgContext(): UseActiveOrgResult | undefined {
  return useContext(ActiveOrgContext);
}

interface ActiveOrgProviderProps {
  children: ReactNode;
}

/**
 * Provider that calls useActiveOrg once at the root level and provides it via context.
 * This eliminates redundant hook calls throughout the component tree.
 * 
 * OPTIMIZATION: Components can still call useActiveOrg directly - it will prefer 
 * context when available, but will fall back to the hook implementation if context 
 * is not provided (backwards compatible).
 * 
 * This reduces 78+ redundant hook executions across the app, while TanStack Query
 * still handles caching and deduplication at the network level.
 */
export function ActiveOrgProvider({ children }: ActiveOrgProviderProps) {
  // Call useActiveOrgInternal once at the provider level (avoids circular dependency)
  const activeOrg = useActiveOrgInternal();

  return (
    <ActiveOrgContext.Provider value={activeOrg}>
      {children}
    </ActiveOrgContext.Provider>
  );
}
