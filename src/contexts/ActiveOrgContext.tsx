import { createContext } from "react";

/** Active org snapshot from membership query (see `useActiveOrgInternal`). */
export interface UseActiveOrgResult {
  orgId: string | null;
  isLoading: boolean;
  error: string | null;
}

export const ActiveOrgContext = createContext<UseActiveOrgResult | undefined>(undefined);
