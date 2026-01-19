import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useActiveOrg } from "./useActiveOrg";
import { queryKeys } from "@/lib/queryKeys";
import { ENABLE_GROUPS_FEATURE } from "@/lib/featureFlags";

type GroupRow = Tables<"groups">;

/**
 * Hook to fetch groups for the active organization.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * @returns Groups array, loading state, error state, and refresh function
 */
export function useGroups() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data: groups = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: queryKeys.groups(orgId ?? undefined),
    queryFn: async (): Promise<GroupRow[]> => {
      if (!ENABLE_GROUPS_FEATURE || !orgId) {
        return [];
      }

      const { data, error: err } = await supabase
        .from("groups")
        .select("*")
        .eq("org_id", orgId)
        .eq("is_archived", false)
        .order("display_order", { ascending: true });

      // 404 is expected if groups table doesn't exist or has no data - don't treat as error
      if (err) {
        if (err.code === 'PGRST116' || err.status === 404 || err.message?.includes('404')) {
          return [];
        }
        throw err;
      }

      return (data as GroupRow[]) ?? [];
    },
    enabled: !!orgId && !orgLoading && ENABLE_GROUPS_FEATURE,
    staleTime: 5 * 60 * 1000, // 5 minutes - groups change infrequently
    retry: 1,
  });

  // Wrapper for backward compatibility
  const refresh = async () => {
    await refetch();
  };

  return {
    groups,
    loading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refresh,
  };
}

/**
 * Hook to fetch group members for a specific group.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * @param groupId - The group ID to fetch members for
 * @returns Group members array, loading state, error state, and refresh function
 */
export function useGroupMembers(groupId?: string) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data: members = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: queryKeys.groupMembers(orgId ?? undefined, groupId),
    queryFn: async (): Promise<Tables<"group_members">[]> => {
      if (!orgId || !groupId) {
        return [];
      }

      const { data, error: err } = await supabase
        .from("group_members")
        .select("*")
        .eq("group_id", groupId)
        .eq("is_deleted", false);

      if (err) {
        throw err;
      }

      return (data as Tables<"group_members">[]) ?? [];
    },
    enabled: !!orgId && !!groupId && !orgLoading,
    staleTime: 2 * 60 * 1000, // 2 minutes
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

/**
 * Hook to fetch task groups (groups linked to a task).
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * @param taskId - The task ID to fetch groups for
 * @returns Task groups array, loading state, error state, and refresh function
 */
export function useTaskGroups(taskId?: string) {
  const { data: taskGroups = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: queryKeys.taskGroups(taskId),
    queryFn: async (): Promise<Tables<"task_groups">[]> => {
      if (!taskId) {
        return [];
      }

      const { data, error: err } = await supabase
        .from("task_groups")
        .select("*")
        .eq("task_id", taskId);

      if (err) {
        throw err;
      }

      return (data as Tables<"task_groups">[]) ?? [];
    },
    enabled: !!taskId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 1,
  });

  // Wrapper for backward compatibility
  const refresh = async () => {
    await refetch();
  };

  return {
    taskGroups,
    loading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refresh,
  };
}
