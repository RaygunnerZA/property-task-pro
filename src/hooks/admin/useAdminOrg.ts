import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdminOrgDetail {
  org_id: string;
  org_name: string;
  org_type: string;
  created_at: string;
  created_by: string;
}

export interface AdminOrgMember {
  user_id: string;
  email: string;
  role: string;
  joined_at: string;
  last_sign_in_at: string | null;
}

export interface AdminAuditEntry {
  id: string;
  actor_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

type ActivityCursor = { created_at: string; id: string };

type ActivityRpcRow = AdminAuditEntry & { has_more: boolean };

function splitActivityPage(rows: ActivityRpcRow[] | null): {
  entries: AdminAuditEntry[];
  hasMore: boolean;
} {
  const list = rows ?? [];
  if (list.length === 0) return { entries: [], hasMore: false };
  const hasMore = Boolean(list[0].has_more);
  const entries = list.map(({ has_more: _h, ...rest }) => rest);
  return { entries, hasMore };
}

export function useAdminOrg(orgId: string) {
  const orgQuery = useQuery({
    queryKey: ["admin-org", orgId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_get_org", { p_org_id: orgId });
      if (error) throw error;
      return (data?.[0] ?? null) as AdminOrgDetail | null;
    },
    enabled: !!orgId,
    staleTime: 60000,
  });

  const membersQuery = useQuery({
    queryKey: ["admin-org-members", orgId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_list_org_members", {
        p_org_id: orgId,
      });
      if (error) throw error;
      return (data ?? []) as AdminOrgMember[];
    },
    enabled: !!orgId,
    staleTime: 60000,
  });

  const activityQuery = useInfiniteQuery({
    queryKey: ["admin-org-activity", orgId],
    initialPageParam: null as ActivityCursor | null,
    queryFn: async ({ pageParam }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_get_org_activity", {
        p_org_id: orgId,
        p_limit: 50,
        p_after_created_at: pageParam?.created_at ?? null,
        p_after_id: pageParam?.id ?? null,
      });
      if (error) throw error;
      return splitActivityPage((data ?? []) as ActivityRpcRow[]);
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || lastPage.entries.length === 0) return undefined;
      const last = lastPage.entries[lastPage.entries.length - 1];
      return { created_at: last.created_at, id: last.id };
    },
    enabled: !!orgId,
    staleTime: 60000,
  });

  const activity =
    activityQuery.data?.pages.flatMap((p) => p.entries) ?? [];

  return {
    org: orgQuery.data ?? null,
    members: membersQuery.data ?? [],
    activity,
    activityHasNextPage: Boolean(activityQuery.hasNextPage),
    fetchNextActivity: activityQuery.fetchNextPage,
    isFetchingNextActivity: activityQuery.isFetchingNextPage,
    isLoading:
      orgQuery.isLoading ||
      membersQuery.isLoading ||
      activityQuery.isPending,
    error: orgQuery.error ?? membersQuery.error ?? activityQuery.error,
  };
}
