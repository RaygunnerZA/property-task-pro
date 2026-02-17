import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScheduleItemBase, ScheduleFilters } from "@/types/schedule";
import { ScheduleViewMode } from "@/utils/scheduleRange";
import { useActiveOrg } from "./useActiveOrg";
import { debug } from "@/lib/debug";

interface UseScheduleDataParams {
  viewMode: ScheduleViewMode;
  rangeStart: string;
  rangeEnd: string;
  filters?: ScheduleFilters;
}

interface UseScheduleDataResult {
  items: ScheduleItemBase[];
  loading: boolean;
  error: string | null;
}

function mapTaskToItem(t: Record<string, unknown>): ScheduleItemBase {
  const dateStr = t.due_date ? String(t.due_date).slice(0, 10) : "";
  const timeStr = t.due_date ? String(t.due_date).slice(11, 16) : null;
  return {
    id: t.id as string,
    kind: "task",
    title: t.title as string,
    description: (t.description as string) ?? null,
    propertyId: t.property_id as string | null,
    spaceId: null,
    priority: t.priority as string | null,
    status: (t.status as string) ?? null,
    date: dateStr,
    time: timeStr,
  };
}

function mapSignalToItem(s: Record<string, unknown>): ScheduleItemBase {
  const dateStr = s.due_at ? String(s.due_at).slice(0, 10) : "";
  const timeStr = s.due_at ? String(s.due_at).slice(11, 16) : null;
  return {
    id: s.id as string,
    kind: "signal",
    title: s.title as string,
    description: (s.body as string) ?? null,
    propertyId: s.property_id as string | null,
    spaceId: null,
    priority: null,
    status: (s.status as string) ?? null,
    date: dateStr,
    time: timeStr,
  };
}

export function useScheduleData({
  viewMode,
  rangeStart,
  rangeEnd,
  filters,
}: UseScheduleDataParams): UseScheduleDataResult {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ["schedule", orgId, viewMode, rangeStart, rangeEnd, filters?.propertyId],
    queryFn: async () => {
      if (!orgId) return [];

      debug("[useScheduleData] fetch start", { orgId, rangeStart, rangeEnd, viewMode });

      let taskQuery = supabase
        .from("tasks_view")
        .select("*")
        .eq("org_id", orgId)
        .gte("due_date", rangeStart)
        .lte("due_date", rangeEnd);

      if (filters?.propertyId) {
        taskQuery = taskQuery.eq("property_id", filters.propertyId);
      }

      const { data: rawTasks, error: taskError } = await taskQuery;
      if (taskError) throw taskError;

      const taskItems = (rawTasks ?? []).map((t) => mapTaskToItem(t as Record<string, unknown>));

      let signalQuery = supabase
        .from("signals")
        .select(`
          id,
          title,
          body,
          type,
          status,
          due_at,
          property_id,
          properties:properties!inner (
            id,
            org_id
          )
        `)
        .eq("organisation_id", orgId)
        .gte("due_at", rangeStart)
        .lte("due_at", rangeEnd);

      if (filters?.propertyId) {
        signalQuery = signalQuery.eq("property_id", filters.propertyId);
      }

      const { data: rawSignals, error: signalError } = await signalQuery;
      if (signalError && !signalError.message?.includes("Could not find the table")) {
        throw signalError;
      }

      const signalItems =
        signalError?.message?.includes("Could not find the table")
          ? []
          : (rawSignals ?? []).map((s) => mapSignalToItem(s as Record<string, unknown>));

      const merged = [...taskItems, ...signalItems];
      merged.sort((a, b) => {
        const dateA = `${a.date} ${a.time ?? "00:00"}`;
        const dateB = `${b.date} ${b.time ?? "00:00"}`;
        return dateA.localeCompare(dateB);
      });

      debug("[useScheduleData] fetch done", { total: merged.length, tasks: taskItems.length, signals: signalItems.length });
      return merged;
    },
    enabled: !!orgId && !orgLoading,
    staleTime: 60000,
  });

  return {
    items,
    loading: isLoading,
    error: error ? (error as Error).message : null,
  };
}
