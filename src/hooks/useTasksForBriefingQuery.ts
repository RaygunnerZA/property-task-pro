/**
 * Fetches tasks for the Daily Briefing radial metrics only.
 * Uses the base `tasks` table (not tasks_view) with a dedicated cache key
 * so completion counts are correct: when a task is completed it stays in this list
 * and is counted as "done" instead of disappearing and shrinking "total".
 */
import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "@/integrations/supabase/client";

export interface UseTasksForBriefingQueryOptions {
  enabled?: boolean;
}

export function useTasksForBriefingQuery(
  propertyId?: string,
  options?: UseTasksForBriefingQueryOptions
) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const enabled = options?.enabled !== false;

  return useQuery({
    queryKey: ["tasks-briefing", orgId, propertyId ?? null],
    queryFn: async () => {
      if (!orgId) return [];

      let query = supabase
        .from("tasks")
        .select("id, status, property_id, priority, due_date")
        .eq("org_id", orgId);

      if (propertyId) {
        query = query.eq("property_id", propertyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: enabled && !!orgId && !orgLoading,
    staleTime: 0, // Always refetch when invalidated (e.g. after add/complete task)
  });
}
