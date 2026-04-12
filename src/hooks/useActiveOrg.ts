import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useContext, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ActiveOrgContext, type UseActiveOrgResult } from "@/contexts/ActiveOrgContext";

export type { UseActiveOrgResult };

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

  const fetchActiveOrg = useCallback(async () => {
    if (!userId) {
      return null;
    }

    const { data: memberships, error: membershipsError } = await supabase
      .from("organisation_members")
      .select("org_id, created_at, organisations(org_type)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (membershipsError) {
      const isAbortError =
        membershipsError.message.includes("AbortError") ||
        membershipsError.details?.includes("AbortError");
      if (isAbortError) {
        const cachedOrgId = queryClient.getQueryData<string | null>(["activeOrg", userId]) ?? null;
        return cachedOrgId;
      }

      console.error("[useActiveOrg] Query error:", {
        message: membershipsError.message,
        code: membershipsError.code,
        details: membershipsError.details,
        hint: membershipsError.hint,
      });
      throw membershipsError;
    }

    if (!memberships || memberships.length === 0) return null;

    const nonPersonal = memberships.find((m) => (m.organisations as { org_type?: string } | null)?.org_type !== "personal");
    const selectedOrgId = (nonPersonal ?? memberships[0]).org_id;
    return selectedOrgId;
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

  const { data: orgId, isLoading: orgQueryLoading, error } = useQuery({
    queryKey: ["activeOrg", userId],
    queryFn: fetchActiveOrg,
    enabled: !!userId,
    staleTime: 10_000,
    retry: false,
  });

  return {
    orgId: orgId ?? null,
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
