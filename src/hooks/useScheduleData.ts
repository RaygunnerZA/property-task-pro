import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScheduleItemBase, ScheduleFilters } from "@/types/schedule";
import { ScheduleViewMode } from "@/utils/scheduleRange";
import { useActiveOrg } from "./useActiveOrg";
import { debugLog } from "@/lib/logger";

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

export function useScheduleData({
  viewMode,
  rangeStart,
  rangeEnd,
  filters,
}: UseScheduleDataParams): UseScheduleDataResult {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const [items, setItems] = useState<ScheduleItemBase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // #region agent log
  console.log('[DEBUG] useScheduleData hook called', {orgId, orgLoading, viewMode, rangeStart, rangeEnd});
  debugLog({sessionId:'debug-session',runId:'run1',hypothesisId:'M',location:'useScheduleData.ts:26',message:'useScheduleData hook called',data:{orgId,orgLoading,viewMode,rangeStart,rangeEnd},timestamp:Date.now()});
  // #endregion

  useEffect(() => {
    // #region agent log
    console.log('[DEBUG] useScheduleData effect running', {orgId, orgLoading, rangeStart, rangeEnd, viewMode});
    debugLog({sessionId:'debug-session',runId:'run1',hypothesisId:'B',location:'useScheduleData.ts:31',message:'useScheduleData effect entry',data:{orgId,orgLoading,rangeStart,rangeEnd,viewMode},timestamp:Date.now()});
    // #endregion
    if (!orgId || orgLoading) {
      // #region agent log
      console.log('[DEBUG] useScheduleData early return - orgId missing', {orgId, orgLoading});
      debugLog({sessionId:'debug-session',runId:'run1',hypothesisId:'B',location:'useScheduleData.ts:36',message:'Early return - orgId missing',data:{orgId,orgLoading},timestamp:Date.now()});
      // #endregion
      setItems([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        // #region agent log
        console.log('[DEBUG] useScheduleData fetchData start', {orgId, rangeStart, rangeEnd, viewMode});
        debugLog({sessionId:'debug-session',runId:'run1',hypothesisId:'A',location:'useScheduleData.ts:44',message:'Before queries - date range format',data:{rangeStart,rangeEnd,rangeStartType:typeof rangeStart,rangeEndType:typeof rangeEnd},timestamp:Date.now()});
        // #endregion
        /* --------------------------------------------
           FETCH TASKS (using tasks_view)
        --------------------------------------------- */
        // Use full ISO timestamps for Supabase TIMESTAMPTZ queries
        // getScheduleRange already returns proper ISO strings with correct start/end times
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
        // #region agent log
        debugLog({sessionId:'debug-session',runId:'run1',hypothesisId:'C',location:'useScheduleData.ts:59',message:'Tasks query result',data:{taskCount:rawTasks?.length||0,taskError:taskError?.message||null,firstTask:rawTasks?.[0]||null},timestamp:Date.now()});
        // #endregion
        if (taskError) throw taskError;

        const taskItems: ScheduleItemBase[] =
          (rawTasks ?? []).map((t: any) => {
            // #region agent log
            const dateStr = t.due_date ? t.due_date.slice(0, 10) : "";
            const timeStr = t.due_date ? t.due_date.slice(11, 16) : null;
            if (!t.due_date) {
              debugLog({sessionId:'debug-session',runId:'run1',hypothesisId:'E',location:'useScheduleData.ts:74',message:'Task missing due_date',data:{taskId:t.id,title:t.title,due_date:t.due_date},timestamp:Date.now()});
            }
            // #endregion
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
        // #region agent log
        debugLog({sessionId:'debug-session',runId:'run1',hypothesisId:'C',location:'useScheduleData.ts:104',message:'Signals query result',data:{signalCount:rawSignals?.length||0,signalError:signalError?.message||null,firstSignal:rawSignals?.[0]||null},timestamp:Date.now()});
        // #endregion
        // Gracefully handle missing signals table (table may not exist yet)
        if (signalError && !signalError.message?.includes("Could not find the table")) {
          throw signalError;
        }

        // Only process signals if query succeeded (table exists)
        const signalItems: ScheduleItemBase[] = signalError && signalError.message?.includes("Could not find the table")
          ? []
          : (rawSignals ?? []).map((s: any) => {
            // #region agent log
            const dateStr = s.due_at ? s.due_at.slice(0, 10) : "";
            const timeStr = s.due_at ? s.due_at.slice(11, 16) : null;
            if (!s.due_at) {
              debugLog({sessionId:'debug-session',runId:'run1',hypothesisId:'E',location:'useScheduleData.ts:119',message:'Signal missing due_at',data:{signalId:s.id,title:s.title,due_at:s.due_at},timestamp:Date.now()});
            }
            // #endregion
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

        // #region agent log
        console.log('[DEBUG] useScheduleData merged items', {totalItems:merged.length,taskItems:taskItems.length,signalItems:signalItems.length,firstItem:merged[0]||null,allDates:merged.map(i=>i.date)});
        debugLog({sessionId:'debug-session',runId:'run1',hypothesisId:'A',location:'useScheduleData.ts:169',message:'Merged items before setState',data:{totalItems:merged.length,taskItems:taskItems.length,signalItems:signalItems.length,firstItem:merged[0]||null,allDates:merged.map(i=>i.date)},timestamp:Date.now()});
        // #endregion
        if (!cancelled) {
          setItems(merged);
          // #region agent log
          console.log('[DEBUG] useScheduleData setItems called', {itemsCount:merged.length});
          debugLog({sessionId:'debug-session',runId:'run1',hypothesisId:'A',location:'useScheduleData.ts:175',message:'setItems called',data:{itemsCount:merged.length},timestamp:Date.now()});
          // #endregion
        }
      } catch (err: any) {
        // #region agent log
        debugLog({sessionId:'debug-session',runId:'run1',hypothesisId:'C',location:'useScheduleData.ts:136',message:'Error caught in fetchData',data:{error:err?.message,errorStack:err?.stack,errorName:err?.name},timestamp:Date.now()});
        // #endregion
        if (!cancelled) {
          setError(err.message || "Failed to load schedule");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [viewMode, rangeStart, rangeEnd, filters, orgId, orgLoading]);

  return { items, loading, error };
}
