import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "../integrations/supabase/types";
import { useActiveOrg } from "./useActiveOrg";

type MessageRow = Tables<"messages">;

export function useMessages() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const fetchMessages = async (): Promise<MessageRow[]> => {
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
    return data ?? [];
  };

  const query = useQuery({
    queryKey: ["messages", orgId],
    queryFn: fetchMessages,
    enabled: !orgLoading,
    staleTime: 60_000,
    retry: 1,
  });

  return {
    messages: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refresh: async () => {
      await query.refetch();
    },
  };
}
