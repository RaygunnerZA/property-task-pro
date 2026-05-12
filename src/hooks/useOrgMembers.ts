import { useQuery } from "@tanstack/react-query";
import { useSupabase } from "../integrations/supabase/useSupabase";
import { useActiveOrg } from "./useActiveOrg";

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
}

export function useOrgMembers() {
  const supabase = useSupabase();
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const fetchMembers = async (): Promise<OrgMember[]> => {
    if (!orgId) {
      return [];
    }

    try {
      // Fetch memberships
      const { data: memberships, error: err } = await supabase
        .from("organisation_members")
        .select("id, user_id, role, assigned_properties")
        .eq("org_id", orgId);

      if (err) {
        throw err;
      }

      if (!memberships || memberships.length === 0) {
        return [];
      }

      // Fetch user data via RPC function
      const userIds = memberships.map(m => m.user_id);
      const { data: userData, error: userError } = await supabase.rpc(
        'get_users_info',
        { user_ids: userIds }
      ) as { data: Array<{ id: string; email: string; nickname: string; avatar_url: string; first_name?: string | null; last_name?: string | null }> | null; error: unknown };

      if (userError as unknown) {
        console.error("Error fetching user info:", userError);
        // Fallback to basic info if RPC fails
        const mapped: OrgMember[] = memberships.map((m) => ({
          id: m.id,
          user_id: m.user_id,
          role: m.role,
          assigned_properties: (m as any).assigned_properties ?? null,
          display_name: `User ${m.user_id.slice(0, 8)}`,
          email: null,
          nickname: null,
          first_name: null,
          last_name: null,
          avatar_url: null,
        }));
        return mapped;
      }

      // Map members with user data
      const mapped: OrgMember[] = memberships.map((m) => {
        const user = userData?.find((u: any) => u.id === m.user_id);
        return {
          id: m.id,
          user_id: m.user_id,
          role: m.role,
          assigned_properties: (m as any).assigned_properties ?? null,
          display_name: user?.nickname || user?.email || `User ${m.user_id.slice(0, 8)}`,
          email: user?.email || null,
          nickname: user?.nickname || null,
          first_name: user?.first_name ?? null,
          last_name: user?.last_name ?? null,
          avatar_url: user?.avatar_url || null,
        };
      });

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
