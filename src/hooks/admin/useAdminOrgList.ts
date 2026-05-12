import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdminOrg {
  org_id: string;
  org_name: string;
  org_type: string;
  created_at: string;
  member_count: number;
  property_count: number;
  task_count: number;
  last_activity: string | null;
}

const PAGE_LIMIT = 25;

export function useAdminOrgList() {
  const query = useInfiniteQuery({
    queryKey: ["admin-orgs"],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_list_orgs", {
        p_cursor: pageParam ?? null,
        p_limit: PAGE_LIMIT,
      });
      if (error) throw error;
      const rows = (data ?? []) as Array<AdminOrg & { has_more: boolean }>;
      return {
        orgs: rows as AdminOrg[],
        hasMore: rows.length > 0 && rows[rows.length - 1]?.has_more === true,
        nextCursor: rows.length > 0 ? rows[rows.length - 1].org_id : null,
      };
    },
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    staleTime: 60_000,
  });

  // Flatten pages into a single array
  const orgs: AdminOrg[] = query.data?.pages.flatMap((p) => p.orgs) ?? [];

  return {
    orgs,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
  };
}
