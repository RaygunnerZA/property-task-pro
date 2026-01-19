import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScheduleItemBase, ScheduleFilters } from "@/types/schedule";
import { ScheduleViewMode } from "@/utils/scheduleRange";
import { useActiveOrg } from "./useActiveOrg";
import { queryKeys } from "@/lib/queryKeys";

interface UseScheduleDataParams {
  viewMode: ScheduleViewMode;
  rangeStart: string; // "YYYY-MM-DD"
  rangeEnd: string;   // "YYYY-MM-DD"
  filters?: ScheduleFilters;
}

interface UseScheduleDataResult {
  items: ScheduleItemBase[];
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch schedule data (tasks + signals) for a date range.
 * 
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * Fetches tasks and signals in parallel, then merges and sorts them.
 * 
 * @param params - Schedule data parameters including viewMode, rangeStart, rangeEnd, and optional filters
 * @returns Schedule items array, loading state, and error state
 */
export function useScheduleData({
  viewMode,
  rangeStart,
  rangeEnd,
  filters,
}: UseScheduleDataParams): UseScheduleDataResult {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  // Create a stable key for filters to include in query key
  const filterKey = filters?.propertyId || 'all';

  const { data: items = [], isLoading: loading, error } = useQuery({
    queryKey: queryKeys.schedule(orgId ?? undefined, rangeStart, rangeEnd, filterKey),
    queryFn: async (): Promise<ScheduleItemBase[]> => {
      if (!orgId) {
        return [];
      }

      /* --------------------------------------------
         FETCH TASKS (using tasks_view)
      --------------------------------------------- */
      // Use full ISO timestamps for Supabase TIMESTAMPTZ queries
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

      const taskItems: ScheduleItemBase[] =
        (rawTasks ?? []).map((t: any) => {
          const dateStr = t.due_date ? t.due_date.slice(0, 10) : "";
          const timeStr = t.due_date ? t.due_date.slice(11, 16) : null;
          return {
            id: t.id,
            kind: "task",
            title: t.title,
            description: t.description,
            propertyId: t.property_id,
            spaceId: null,
            priority: t.priority,
            status: t.status ?? null,
            // DATE + TIME normalisation
            date: dateStr,
            time: timeStr,
          };
        });

      /* --------------------------------------------
         FETCH SIGNALS (REMINDERS)
      --------------------------------------------- */
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
      
      // Gracefully handle missing signals table (table may not exist yet)
      if (signalError && !signalError.message?.includes("Could not find the table")) {
        throw signalError;
      }

      // Only process signals if query succeeded (table exists)
      const signalItems: ScheduleItemBase[] = signalError && signalError.message?.includes("Could not find the table")
        ? []
        : (rawSignals ?? []).map((s: any) => {
          const dateStr = s.due_at ? s.due_at.slice(0, 10) : "";
          const timeStr = s.due_at ? s.due_at.slice(11, 16) : null;
          return {
            id: s.id,
            kind: "signal",
            title: s.title,
            description: s.body,
            propertyId: s.property_id,
            spaceId: null,
            priority: null,
            status: s.status ?? null,
            // DATE + TIME (signals use due_at, not due_date)
            date: dateStr,
            time: timeStr,
          };
        });

      /* --------------------------------------------
         MERGE + SORT
      --------------------------------------------- */
      const merged = [...taskItems, ...signalItems];
      merged.sort((a, b) => {
        const dateA = `${a.date} ${a.time ?? "00:00"}`;
        const dateB = `${b.date} ${b.time ?? "00:00"}`;
        return dateA.localeCompare(dateB);
      });

      return merged;
    },
    enabled: !!orgId && !orgLoading, // Only fetch when we have orgId
    staleTime: 60 * 1000, // 1 minute - schedule data should be relatively fresh
    retry: 1,
  });

  return { 
    items, 
    loading, 
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
  };
}
