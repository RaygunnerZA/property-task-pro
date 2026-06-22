import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useContext, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ActiveOrgContext,
  type ActiveOrgSnapshot,
  type ActiveOrgType,
  type UseActiveOrgResult,
} from "@/contexts/ActiveOrgContext";
import { isDevBuild } from "@/context/DevModeContext";
import { TEST_PERSONA_ORG_STORAGE_KEY } from "@/lib/dev/testPersonas";

export type { UseActiveOrgResult, ActiveOrgSnapshot, ActiveOrgType };

/** Disambiguates PostgREST embed when multiple FKs exist to `organisations` (legacy DBs). */
const ORG_MEMBER_ORG_EMBED = "organisations!organisation_members_org_id_fkey";

const EMPTY_ACTIVE_ORG: ActiveOrgSnapshot = {
  orgId: null,
  role: null,
  orgType: null,
};

type MembershipRow = {
  org_id: string;
  role: string;
  created_at: string;
  organisations: { org_type?: string } | null;
};

function parseOrgType(value: string | undefined): ActiveOrgType | null {
  if (value === "personal" || value === "business" || value === "contractor") {
    return value;
  }
  return null;
}

function snapshotFromMembership(row: MembershipRow): ActiveOrgSnapshot {
  return {
    orgId: row.org_id,
    role: row.role,
    orgType: parseOrgType(row.organisations?.org_type),
  };
}

function pickActiveMembership(memberships: MembershipRow[]): MembershipRow {
  const nonPersonal = memberships.find(
    (m) => parseOrgType(m.organisations?.org_type) !== "personal"
  );
  return nonPersonal ?? memberships[0];
}

let activeOrgSubscriptionRefCount = 0;
let activeOrgAuthSubscription: { unsubscribe: () => void } | null = null;
let activeOrgInvalidateQueries: (() => void) | null = null;

/**
 * Internal: org membership query + auth invalidation. Used only by
 * `ActiveOrgProvider` so the hook runs once per tree.
 */
export function useActiveOrgInternal(): UseActiveOrgResult {
  const queryClient = useQueryClient();

  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: ["auth", "user"],
    queryFn: async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error) throw error;
      return user;
    },
    staleTime: Infinity,
    retry: false,
  });

  const userId = userData?.id;

  const fetchActiveOrg = useCallback(async (): Promise<ActiveOrgSnapshot> => {
    if (!userId) {
      return EMPTY_ACTIVE_ORG;
    }

    const { data: memberships, error: membershipsError } = await supabase
      .from("organisation_members")
      .select(`org_id, role, created_at, ${ORG_MEMBER_ORG_EMBED}(org_type)`)
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (membershipsError) {
      const isAbortError =
        membershipsError.message.includes("AbortError") ||
        membershipsError.details?.includes("AbortError");
      if (isAbortError) {
        const cached =
          queryClient.getQueryData<ActiveOrgSnapshot>(["activeOrg", userId]) ??
          EMPTY_ACTIVE_ORG;
        return cached;
      }

      console.error("[useActiveOrg] Query error:", {
        message: membershipsError.message,
        code: membershipsError.code,
        details: membershipsError.details,
        hint: membershipsError.hint,
      });
      throw membershipsError;
    }

    if (!memberships || memberships.length === 0) {
      return EMPTY_ACTIVE_ORG;
    }

    const rows = memberships as MembershipRow[];

    if (isDevBuild && typeof sessionStorage !== "undefined") {
      const pinnedOrgId = sessionStorage.getItem(TEST_PERSONA_ORG_STORAGE_KEY);
      if (pinnedOrgId) {
        const pinned = rows.find((m) => m.org_id === pinnedOrgId);
        if (pinned) {
          return snapshotFromMembership(pinned);
        }
      }
    }

    return snapshotFromMembership(pickActiveMembership(rows));
  }, [queryClient, userId]);

  useEffect(() => {
    activeOrgSubscriptionRefCount += 1;
    activeOrgInvalidateQueries = () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
      queryClient.invalidateQueries({ queryKey: ["activeOrg"] });
    };

    if (!activeOrgAuthSubscription) {
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
          activeOrgInvalidateQueries?.();
        }
      });
      activeOrgAuthSubscription = data.subscription;
    }

    return () => {
      activeOrgSubscriptionRefCount -= 1;
      if (activeOrgSubscriptionRefCount <= 0) {
        activeOrgAuthSubscription?.unsubscribe();
        activeOrgAuthSubscription = null;
        activeOrgInvalidateQueries = null;
        activeOrgSubscriptionRefCount = 0;
      }
    };
  }, [queryClient]);

  const { data: snapshot, isLoading: orgQueryLoading, error } = useQuery({
    queryKey: ["activeOrg", userId],
    queryFn: fetchActiveOrg,
    enabled: !!userId,
    staleTime: 10_000,
    retry: false,
  });

  return {
    orgId: snapshot?.orgId ?? null,
    role: snapshot?.role ?? null,
    orgType: snapshot?.orgType ?? null,
    isLoading: userLoading || (!!userId && orgQueryLoading),
    error: error ? (error as Error).message : null,
  };
}

/**
 * Active organisation for the current user. Must be used under
 * `ActiveOrgProvider` (see `App.tsx`).
 */
export function useActiveOrg(): UseActiveOrgResult {
  const ctx = useContext(ActiveOrgContext);
  if (ctx === undefined) {
    throw new Error("useActiveOrg must be used within ActiveOrgProvider");
  }
  return ctx;
}
