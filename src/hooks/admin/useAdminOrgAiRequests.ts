import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdminAiRequest {
  id: string;
  user_id: string | null;
  function_name: string;
  model_used: string;
  provider: string;
  status: string;
  latency_ms: number | null;
  cost_usd: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  entity_type: string | null;
  entity_id: string | null;
  error_message: string | null;
  created_at: string;
}

type AiCursor = { created_at: string; id: string };

type AiRpcRow = AdminAiRequest & { has_more: boolean };

function splitAiPage(rows: AiRpcRow[] | null): { entries: AdminAiRequest[]; hasMore: boolean } {
  const list = rows ?? [];
  if (list.length === 0) return { entries: [], hasMore: false };
  const hasMore = Boolean(list[0].has_more);
  const entries = list.map(({ has_more: _h, ...rest }) => rest);
  return { entries, hasMore };
}

export function useAdminOrgAiRequests(orgId: string) {
  const query = useInfiniteQuery({
    queryKey: ["admin-org-ai-requests", orgId],
    initialPageParam: null as AiCursor | null,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc("admin_get_org_ai_requests", {
        p_org_id: orgId,
        p_limit: 100,
        p_after_created_at: pageParam?.created_at ?? null,
        p_after_id: pageParam?.id ?? null,
      });
      if (error) throw error;
      return splitAiPage((data ?? []) as AiRpcRow[]);
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || lastPage.entries.length === 0) return undefined;
      const last = lastPage.entries[lastPage.entries.length - 1];
      return { created_at: last.created_at, id: last.id };
    },
    enabled: !!orgId,
    staleTime: 30000,
  });

  const data = query.data?.pages.flatMap((p) => p.entries) ?? [];

  return {
    data,
    hasNextPage: Boolean(query.hasNextPage),
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isPending,
    error: query.error,
  };
}
