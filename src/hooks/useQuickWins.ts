import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { markTaskCompleted } from "@/lib/completeTask";
import { isOnboardingDemoTask } from "@/lib/onboardingEducation";
import {
  QUICK_WIN_COMPLETE_EVENT,
  QUICK_WIN_DEMO_TASK_TITLE,
  QUICK_WIN_IDS,
  markQuickWinComplete,
  readCompletedQuickWins,
  type QuickWinCompleteDetail,
  type QuickWinId,
} from "@/lib/quickWins";
import type { QueryClient } from "@tanstack/react-query";

async function completeMatchingDemoTask(
  queryClient: QueryClient,
  propertyId: string,
  title: string
) {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, description, status")
    .eq("property_id", propertyId)
    .eq("title", title)
    .limit(8);
  if (error || !data?.length) return;
  const open = data.find(
    (row) =>
      isOnboardingDemoTask(row) &&
      String(row.status ?? "").toLowerCase() !== "completed" &&
      String(row.status ?? "").toLowerCase() !== "archived"
  );
  if (!open?.id) return;
  try {
    await markTaskCompleted(queryClient, open.id, { optimistic: true });
  } catch {
    /* demo-task close is best-effort */
  }
}

export function useQuickWins(propertyId: string | null | undefined) {
  const queryClient = useQueryClient();
  const [completed, setCompleted] = useState<Set<QuickWinId>>(() =>
    propertyId ? readCompletedQuickWins(propertyId) : new Set()
  );

  useEffect(() => {
    setCompleted(propertyId ? readCompletedQuickWins(propertyId) : new Set());
  }, [propertyId]);

  useEffect(() => {
    const onComplete = (event: Event) => {
      const detail = (event as CustomEvent<QuickWinCompleteDetail>).detail;
      if (!detail?.propertyId || detail.propertyId !== propertyId) return;
      setCompleted(readCompletedQuickWins(detail.propertyId));
      if (!detail.fresh) return;
      const demoTitle = QUICK_WIN_DEMO_TASK_TITLE[detail.id];
      if (demoTitle) {
        void completeMatchingDemoTask(queryClient, detail.propertyId, demoTitle);
      }
    };
    window.addEventListener(QUICK_WIN_COMPLETE_EVENT, onComplete);
    return () => window.removeEventListener(QUICK_WIN_COMPLETE_EVENT, onComplete);
  }, [propertyId, queryClient]);

  const remainingCount = QUICK_WIN_IDS.length - completed.size;
  const allDone = remainingCount === 0 && completed.size > 0;

  const isComplete = useCallback((id: QuickWinId) => completed.has(id), [completed]);

  const complete = useCallback(
    (id: QuickWinId) => markQuickWinComplete(id, propertyId),
    [propertyId]
  );

  return useMemo(
    () => ({ completed, remainingCount, allDone, isComplete, complete }),
    [completed, remainingCount, allDone, isComplete, complete]
  );
}
