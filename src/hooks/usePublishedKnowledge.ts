import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import type { KnowledgeRow } from "@/types/knowledge";

export function usePublishedKnowledge(search?: string) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  return useQuery({
    queryKey: ["published-knowledge", orgId, search ?? ""],
    enabled: Boolean(orgId) && !orgLoading,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("list_published_knowledge", {
        p_org_id: orgId,
        p_query: search?.trim() || null,
      });
      if (error) throw error;
      return (data ?? []) as KnowledgeRow[];
    },
  });
}
