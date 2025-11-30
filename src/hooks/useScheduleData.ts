import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScheduleItemBase, ScheduleFilters } from "@/types/schedule";
import { ScheduleViewMode } from "@/utils/scheduleRange";

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
  const [items, setItems] = useState<ScheduleItemBase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        /* --------------------------------------------
           FETCH TASKS
        --------------------------------------------- */
        let taskQuery = supabase
          .from("tasks")
          .select(`
            id,
            title,
            description,
            due_at,
            property_id,
            priority,
            status,
            properties:properties!inner (
              id,
              org_id
            )
          `)
          .gte("due_at", rangeStart)
          .lte("due_at", rangeEnd);

        if (filters?.propertyId) {
          taskQuery = taskQuery.eq("property_id", filters.propertyId);
        }

        const { data: rawTasks, error: taskError } = await taskQuery;
        if (taskError) throw taskError;

        const taskItems: ScheduleItemBase[] =
          (rawTasks ?? []).map((t: any) => ({
            id: t.id,
            kind: "task",
            title: t.title,
            description: t.description,
            propertyId: t.property_id,
            spaceId: null,
            priority: t.priority,
            status: t.status ?? null,

            // DATE + TIME normalisation
            date: t.due_at ? t.due_at.slice(0, 10) : "",
            time: t.due_at ? t.due_at.slice(11, 16) : null,
          }));

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
          .gte("due_at", rangeStart)
          .lte("due_at", rangeEnd);

        if (filters?.propertyId) {
          signalQuery = signalQuery.eq("property_id", filters.propertyId);
        }

        const { data: rawSignals, error: signalError } = await signalQuery;
        if (signalError) throw signalError;

        const signalItems: ScheduleItemBase[] =
          (rawSignals ?? []).map((s: any) => ({
            id: s.id,
            kind: "signal",
            title: s.title,
            description: s.body,
            propertyId: s.property_id,
            spaceId: null,
            priority: null,
            status: s.status ?? null,

            // DATE + TIME
            date: s.due_at ? s.due_at.slice(0, 10) : "",
            time: s.due_at ? s.due_at.slice(11, 16) : null,
          }));

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
  }, [viewMode, rangeStart, rangeEnd, filters]);

  return { items, loading, error };
}
