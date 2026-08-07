import { useQuery } from "@tanstack/react-query";
import { useSupabase } from "../integrations/supabase/useSupabase";
import { useActiveOrg } from "./useActiveOrg";
import { formatPersonDisplayName } from "@/lib/formatPersonDisplayName";

export interface OrgMember {
  id: string;
  user_id: string;
  role: string;
  display_name: string;
  email: string | null;
  nickname: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  assigned_properties: string[] | null;
  is_primary_owner: boolean;
}

type UserInfoRow = {
  id: string;
  email: string;
  nickname: string | null;
  avatar_url: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

export function useOrgMembers() {
  const supabase = useSupabase();
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const fetchMembers = async (): Promise<OrgMember[]> => {
    if (!orgId) {
      return [];
    }

    try {
      const { data: memberships, error: err } = await supabase
        .from("organisation_members")
        .select("id, user_id, role, assigned_properties, is_primary_owner")
        .eq("org_id", orgId);

      if (err) {
        throw err;
      }

      if (!memberships || memberships.length === 0) {
        return [];
      }

      const userIds = memberships.map((m) => m.user_id);
      const { data: userData, error: userError } = (await supabase.rpc("get_users_info", {
        user_ids: userIds,
      })) as { data: UserInfoRow[] | null; error: unknown };

      if (userError as unknown) {
        console.error("Error fetching user info:", userError);
        const mapped: OrgMember[] = memberships.map((m) => ({
          id: m.id,
          user_id: m.user_id,
          role: m.role,
          assigned_properties: m.assigned_properties ?? null,
          is_primary_owner: !!(m as { is_primary_owner?: boolean }).is_primary_owner,
          display_name: `User ${m.user_id.slice(0, 8)}`,
          email: null,
          nickname: null,
          first_name: null,
          last_name: null,
          avatar_url: null,
        }));
        return mapped;
      }

      // Dedupe by user_id — unique index should prevent this, but legacy rows can exist.
      const seenUserIds = new Set<string>();
      const mapped: OrgMember[] = [];
      for (const m of memberships) {
        if (seenUserIds.has(m.user_id)) continue;
        seenUserIds.add(m.user_id);
        const user = userData?.find((u) => u.id === m.user_id);
        const first_name = user?.first_name ?? null;
        const last_name = user?.last_name ?? null;
        const nickname = user?.nickname ?? null;
        const email = user?.email ?? null;
        mapped.push({
          id: m.id,
          user_id: m.user_id,
          role: m.role,
          assigned_properties: m.assigned_properties ?? null,
          is_primary_owner: !!(m as { is_primary_owner?: boolean }).is_primary_owner,
          display_name: formatPersonDisplayName({
            first_name,
            last_name,
            nickname,
            email,
            fallback: `User ${m.user_id.slice(0, 8)}`,
          }),
          email,
          nickname,
          first_name,
          last_name,
          avatar_url: user?.avatar_url ?? null,
        });
      }

      return mapped;
    } catch (err: any) {
      throw new Error(err.message || "Failed to fetch members");
    }
  };

  const query = useQuery({
    queryKey: ["org-members", orgId],
    queryFn: fetchMembers,
    enabled: !orgLoading,
    staleTime: 60_000,
    retry: 1,
  });

  return {
    members: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refresh: async () => {
      await query.refetch();
    },
  };
}
