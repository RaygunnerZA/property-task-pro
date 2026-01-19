import { useQuery } from "@tanstack/react-query";
import { useSupabase } from "../integrations/supabase/useSupabase";
import { useActiveOrg } from "./useActiveOrg";
import { queryKeys } from "@/lib/queryKeys";

export interface OrgMember {
  id: string;
  user_id: string;
  role: string;
  display_name: string;
  email: string | null;
  nickname: string | null;
  avatar_url: string | null;
}

/**
 * Hook to fetch organization members for the active organization.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * Fetches memberships and then enriches with user data via RPC function.
 * 
 * @returns Members array, loading state, error state, and refresh function
 */
export function useOrgMembers() {
  const supabase = useSupabase();
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data: members = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: queryKeys.orgMembers(orgId ?? undefined),
    queryFn: async (): Promise<OrgMember[]> => {
      if (!orgId) {
        return [];
      }

      // Fetch memberships
      const { data: memberships, error: err } = await supabase
        .from("organisation_members")
        .select("id, user_id, role")
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
      );

      if (userError) {
        console.error("Error fetching user info:", userError);
        // Fallback to basic info if RPC fails
        return memberships.map((m) => ({
          id: m.id,
          user_id: m.user_id,
          role: m.role,
          display_name: `User ${m.user_id.slice(0, 8)}`,
          email: null,
          nickname: null,
          avatar_url: null,
        }));
      }

      // Map members with user data
      return memberships.map((m) => {
        const user = userData?.find((u: any) => u.id === m.user_id);
        return {
          id: m.id,
          user_id: m.user_id,
          role: m.role,
          display_name: user?.nickname || user?.email || `User ${m.user_id.slice(0, 8)}`,
          email: user?.email || null,
          nickname: user?.nickname || null,
          avatar_url: user?.avatar_url || null,
        };
      });
    },
    enabled: !!orgId && !orgLoading, // Only fetch when we have orgId
    staleTime: 2 * 60 * 1000, // 2 minutes - members change moderately
    retry: 1,
  });

  // Wrapper for backward compatibility
  const refresh = async () => {
    await refetch();
  };

  return {
    members,
    loading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refresh,
  };
}
