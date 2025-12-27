import { useEffect, useState, useCallback } from "react";
import { useSupabase } from "../integrations/supabase/useSupabase";
import { useActiveOrg } from "./useActiveOrg";

interface DashboardMetrics {
  total_properties: number;
  open_tasks: number;
  overdue_tasks: number;
  expiring_compliance: number;
}

export function useDashboardMetrics() {
  const supabase = useSupabase();
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    total_properties: 0,
    open_tasks: 0,
    overdue_tasks: 0,
    expiring_compliance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    if (!orgId) {
      setMetrics({
        total_properties: 0,
        open_tasks: 0,
        overdue_tasks: 0,
        expiring_compliance: 0,
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
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

      setMetrics({
        total_properties: propertiesResult.count || 0,
        open_tasks: tasksResult.data?.length || 0,
        overdue_tasks: overdueTasks.length,
        expiring_compliance: complianceResult.data?.length || 0,
      });
    } catch (err: any) {
      setError(err.message || "Failed to fetch dashboard metrics");
      setMetrics({
        total_properties: 0,
        open_tasks: 0,
        overdue_tasks: 0,
        expiring_compliance: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [supabase, orgId]);

  useEffect(() => {
    if (!orgLoading) {
      fetchMetrics();
    }
  }, [fetchMetrics, orgLoading]);

  return { metrics, loading, error, refresh: fetchMetrics };
}

