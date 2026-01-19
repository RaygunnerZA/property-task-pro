import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "../integrations/supabase/types";
import { useActiveOrg } from "./useActiveOrg";
import { queryKeys } from "@/lib/queryKeys";

type SignalRow = Tables<"signals">;

/**
 * Hook to fetch reminders (signals with type='reminder') for the active organization.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * @returns Reminders array, loading state, error state, and refresh function
 */
export function useReminders() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data: reminders = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: queryKeys.reminders(orgId ?? undefined),
    queryFn: async (): Promise<SignalRow[]> => {
      if (!orgId) {
        return [];
      }

      const { data, error: err } = await supabase
        .from("signals")
        .select("*")
        .eq("org_id", orgId)
        .eq("type", "reminder")
        .order("due_at", { ascending: true });

      if (err) {
        throw err;
      }

      return (data as SignalRow[]) ?? [];
    },
    enabled: !!orgId && !orgLoading, // Only fetch when we have orgId
    staleTime: 60 * 1000, // 1 minute - reminders are relatively fresh data
    retry: 1, // Retry once on error
  });

  // Wrapper for backward compatibility - old refresh() was async and could be awaited
  const refresh = async () => {
    await refetch();
  };

  return {
    reminders,
    loading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refresh,
  };
}
