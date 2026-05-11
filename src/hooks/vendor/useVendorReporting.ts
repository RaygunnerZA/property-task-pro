import { useQuery } from "@tanstack/react-query";
import { useDataContext } from "@/contexts/DataContext";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, addWeeks } from "date-fns";

export interface VendorPerformance {
  score: number;
  onTime: number;
}

export interface VendorSLA {
  within: number;
  late: number;
  critical: number;
  /** Tasks in waiting_review — vendor submitted, manager sign-off pending */
  awaitingReview: number;
}

export interface VendorDrift {
  resolved: number;
  avgTime: number;
}

export const useVendorReporting = () => {
  const { userId } = useDataContext();

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-reporting", userId],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("tasks_view")
        .select("id, status, priority, due_date, created_at, updated_at")
        .eq("assigned_user_id", userId!);

      if (error) throw error;

      const tasks = rows ?? [];
      const completed = tasks.filter((t) => t.status === "completed");
      const active = tasks.filter(
        (t) => t.status !== "completed" && t.status !== "archived"
      );
      const total = completed.length + active.length;

      // Performance score: % completed
      const score = total > 0 ? Math.round((completed.length / total) * 100) : 0;

      // On-time: completed before or on due_date
      const onTimeCount = completed.filter((t) => {
        if (!t.due_date || !t.updated_at) return false;
        return new Date(t.updated_at) <= new Date(t.due_date);
      }).length;
      const onTime =
        completed.length > 0 ? Math.round((onTimeCount / completed.length) * 100) : 0;

      const awaitingReview = tasks.filter((t) => t.status === "waiting_review").length;

      // SLA breakdown by priority among all non-archived tasks
      const urgentTasks = tasks.filter(
        (t) => (t.priority === "urgent") && t.status !== "archived" && t.status !== "waiting_review"
      );
      const sla: VendorSLA = {
        within: tasks.filter(
          (t) =>
            t.status === "completed" &&
            t.due_date &&
            t.updated_at &&
            new Date(t.updated_at) <= new Date(t.due_date)
        ).length,
        late: tasks.filter(
          (t) =>
            t.status === "completed" &&
            t.due_date &&
            t.updated_at &&
            new Date(t.updated_at) > new Date(t.due_date)
        ).length,
        critical: urgentTasks.length,
        awaitingReview,
      };

      // Weekly completion chart — last 4 weeks
      const now = new Date();
      const completion = Array.from({ length: 4 }).map((_, i) => {
        const weekStart = startOfWeek(addWeeks(now, -(3 - i)));
        const weekEnd = addWeeks(weekStart, 1);
        const count = completed.filter((t) => {
          if (!t.updated_at) return false;
          const d = new Date(t.updated_at);
          return d >= weekStart && d < weekEnd;
        }).length;
        return { date: format(weekStart, "yyyy-MM-dd"), completed: count };
      });

      // Avg resolution time in days (created → completed)
      const withTimes = completed
        .filter((t) => t.created_at && t.updated_at)
        .map((t) => {
          const msPerDay = 86400000;
          return (
            (new Date(t.updated_at!).getTime() -
              new Date(t.created_at!).getTime()) /
            msPerDay
          );
        })
        .filter((d) => d >= 0);

      const avgTime =
        withTimes.length > 0
          ? Math.round(
              (withTimes.reduce((a, b) => a + b, 0) / withTimes.length) * 10
            ) / 10
          : 0;

      return {
        performance: { score, onTime } satisfies VendorPerformance,
        sla,
        completion,
        drift: { resolved: completed.length, avgTime } satisfies VendorDrift,
      };
    },
    enabled: !!userId,
    staleTime: 60000,
  });

  return {
    performance: data?.performance ?? { score: 0, onTime: 0 },
    sla: data?.sla ?? { within: 0, late: 0, critical: 0, awaitingReview: 0 },
    completion: data?.completion ?? [],
    drift: data?.drift ?? { resolved: 0, avgTime: 0 },
    isLoading,
  };
};
