import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import {
  type AutoArchiveIntervalId,
  isCompletedPastArchiveWindow,
} from "@/lib/autoArchive";
import { archiveTask } from "@/services/tasks/taskMutations";

type ArchiveableTask = {
  id: string;
  status?: string | null;
  completed_at?: string | null;
  updated_at?: string | null;
};

/**
 * When an interval is selected, archive completed tasks older than that window.
 * Uses existing archive_task RPC (Trash path). Client-side sweep; no new columns.
 */
export function useAutoArchiveRunner(
  tasks: ArchiveableTask[] | undefined,
  intervalId: AutoArchiveIntervalId | null
) {
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();
  const inFlightRef = useRef(false);
  const archivedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!orgId || !intervalId || !tasks?.length || inFlightRef.current) return;

    const due = tasks.filter(
      (task) =>
        task.status === "completed" &&
        !archivedIdsRef.current.has(task.id) &&
        isCompletedPastArchiveWindow(task.completed_at, task.updated_at, intervalId)
    );

    if (due.length === 0) return;

    let cancelled = false;
    inFlightRef.current = true;

    void (async () => {
      try {
        const results = await Promise.allSettled(
          due.map((task) => archiveTask(task.id, orgId))
        );
        results.forEach((result, index) => {
          if (result.status === "fulfilled") {
            archivedIdsRef.current.add(due[index].id);
          }
        });
        if (!cancelled && results.some((r) => r.status === "fulfilled")) {
          await queryClient.invalidateQueries({ queryKey: ["tasks"] });
          await queryClient.invalidateQueries({ queryKey: ["trashed-tasks"] });
        }
      } finally {
        inFlightRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orgId, intervalId, tasks, queryClient]);
}
