import { useQuery } from "@tanstack/react-query";
import { useSupabase } from "../integrations/supabase/useSupabase";
import { useActiveOrg } from "./useActiveOrg";
import { queryKeys } from "@/lib/queryKeys";

interface DashboardMetrics {
  total_properties: number;
  open_tasks: number;
  overdue_tasks: number;
  expiring_compliance: number;
}

/**
 * Hook to fetch dashboard metrics for the active organization.
 * 
 * Uses TanStack Query for caching and automatic refetching.
 * Fetches multiple metrics in parallel: properties count, open tasks, overdue tasks, and expiring compliance.
 */
export function useDashboardMetrics() {
  const supabase = useSupabase();
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data: metrics, isLoading: loading, error, refetch } = useQuery({
    queryKey: queryKeys.dashboardMetrics(orgId ?? undefined),
    queryFn: async (): Promise<DashboardMetrics> => {
      if (!orgId) {
        return {
          total_properties: 0,
          open_tasks: 0,
          overdue_tasks: 0,
          expiring_compliance: 0,
        };
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      thirtyDaysFromNow.setHours(23, 59, 59, 999);

      // Fetch all metrics in parallel
      const [propertiesResult, tasksResult, complianceResult] = await Promise.all([
        // Total properties count
        supabase
          .from("properties")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId),

        // Open tasks (status = 'open' or 'in_progress')
        supabase
          .from("tasks")
          .select("id, due_date, status")
          .eq("org_id", orgId)
          .in("status", ["open", "in_progress"]),

        // Compliance documents expiring in next 30 days
        supabase
          .from("compliance_documents")
          .select("id, expiry_date")
          .eq("org_id", orgId)
          .not("expiry_date", "is", null)
          .gte("expiry_date", today.toISOString().split("T")[0])
          .lte("expiry_date", thirtyDaysFromNow.toISOString().split("T")[0]),
      ]);

      if (propertiesResult.error) throw propertiesResult.error;
      if (tasksResult.error) throw tasksResult.error;
      if (complianceResult.error) throw complianceResult.error;

      // Calculate overdue tasks
      const overdueTasks = (tasksResult.data || []).filter((task) => {
        if (!task.due_date) return false;
        const dueDate = new Date(task.due_date);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate < today;
      });

      return {
        total_properties: propertiesResult.count || 0,
        open_tasks: tasksResult.data?.length || 0,
        overdue_tasks: overdueTasks.length,
        expiring_compliance: complianceResult.data?.length || 0,
      };
    },
    enabled: !!orgId && !orgLoading, // Only fetch when we have orgId
    staleTime: 2 * 60 * 1000, // 2 minutes - dashboard metrics should be relatively fresh
    retry: 1,
  });

  // Wrapper for backward compatibility
  const refresh = async () => {
    await refetch();
  };

  return {
    metrics: metrics ?? {
      total_properties: 0,
      open_tasks: 0,
      overdue_tasks: 0,
      expiring_compliance: 0,
    },
    loading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refresh,
  };
}
