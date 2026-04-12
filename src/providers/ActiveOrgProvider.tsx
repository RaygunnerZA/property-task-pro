import type { ReactNode } from "react";
import { ActiveOrgContext } from "@/contexts/ActiveOrgContext";
import { useActiveOrgInternal } from "@/hooks/useActiveOrg";

/**
 * Runs the active-org React Query stack once and shares it via context so
 * descendants do not each subscribe / re-execute the same logic.
 */
export function ActiveOrgProvider({ children }: { children: ReactNode }) {
  const activeOrg = useActiveOrgInternal();
  return <ActiveOrgContext.Provider value={activeOrg}>{children}</ActiveOrgContext.Provider>;
}
