import { createContext } from "react";

export type ActiveOrgType = "personal" | "business" | "contractor";

/** Cached membership snapshot — single query, shared across the app. */
export interface ActiveOrgSnapshot {
  orgId: string | null;
  role: string | null;
  orgType: ActiveOrgType | null;
}

/** Active org snapshot from membership query (see `useActiveOrgInternal`). */
export interface UseActiveOrgResult extends ActiveOrgSnapshot {
  isLoading: boolean;
  error: string | null;
}

export const ActiveOrgContext = createContext<UseActiveOrgResult | undefined>(undefined);
