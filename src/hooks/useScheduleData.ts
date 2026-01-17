import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScheduleItemBase, ScheduleFilters } from "@/types/schedule";
import { ScheduleViewMode } from "@/utils/scheduleRange";
import { useActiveOrg } from "./useActiveOrg";

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

  useEffect(() => {
    if (!orgId || orgLoading) {
      setItems([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
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

        if (!cancelled) {
          setItems(merged);
        }
      } catch (err: any) {
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
