import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "../integrations/supabase/types";
import { useActiveOrg } from "./useActiveOrg";
import { queryKeys } from "@/lib/queryKeys";

type MessageRow = Tables<"messages">;

/**
 * Hook to fetch all messages for the active organization.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * @returns Messages array, loading state, error state, and refresh function
 */
export function useMessages() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data: messages = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: queryKeys.allMessages(orgId ?? undefined),
    queryFn: async (): Promise<MessageRow[]> => {
      if (!orgId) {
        return [];
      }

      const { data, error: err } = await supabase
        .from("messages")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });

      if (err) {
        throw err;
      }

      return (data as MessageRow[]) ?? [];
    },
    enabled: !!orgId && !orgLoading, // Only fetch when we have orgId
    staleTime: 60 * 1000, // 1 minute - messages are relatively fresh data
    retry: 1, // Retry once on error
  });

  // Wrapper for backward compatibility - old refresh() was async and could be awaited
  const refresh = async () => {
    await refetch();
  };

  return {
    messages,
    loading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refresh,
  };
}
