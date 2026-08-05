import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import { useDataContext } from "@/contexts/DataContext";
import { supabase } from "@/integrations/supabase/client";
import { memberAccentColor } from "@/lib/userDisplayHelpers";
import {
  isTaskCommentSignalNew,
  TASK_COMMENT_SEEN_EVENT,
} from "@/lib/taskCommentSeen";

export type TaskLatestComment = {
  authorUserId: string | null;
  createdAt: string;
};

export type TaskCommentSignal = {
  accentColor: string;
  authorUserId: string | null;
};

async function fetchLatestTaskComments(
  orgId: string
): Promise<Record<string, TaskLatestComment>> {
  const { data, error } = await supabase
    .from("messages")
    .select("author_user_id, created_at, conversation_id, conversations!inner(task_id)")
    .eq("org_id", orgId)
    .not("conversations.task_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(800);

  if (error) throw error;

  const latestByTask: Record<string, TaskLatestComment> = {};
  for (const row of data ?? []) {
    const rawConv = row.conversations as
      | { task_id?: string | null }
      | { task_id?: string | null }[]
      | null;
    const conv = Array.isArray(rawConv) ? rawConv[0] : rawConv;
    const taskId = conv?.task_id;
    if (!taskId || latestByTask[taskId]) continue;
    if (!row.created_at) continue;
    latestByTask[taskId] = {
      authorUserId: row.author_user_id ?? null,
      createdAt: row.created_at,
    };
  }
  return latestByTask;
}

export function useTaskCommentSignalsMap() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  return useQuery({
    queryKey: ["task-comment-signals", orgId],
    queryFn: () => fetchLatestTaskComments(orgId!),
    enabled: !!orgId && !orgLoading,
    staleTime: 60_000,
  });
}

export function useInvalidateTaskCommentSignals() {
  const queryClient = useQueryClient();
  const { orgId } = useActiveOrg();
  return () =>
    queryClient.invalidateQueries({ queryKey: ["task-comment-signals", orgId] });
}

/** Subscribe to local “seen” updates so cards clear the bubble without a refetch. */
function useTaskCommentSeenTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const onSeen = () => setTick((n) => n + 1);
    window.addEventListener(TASK_COMMENT_SEEN_EVENT, onSeen);
    return () => window.removeEventListener(TASK_COMMENT_SEEN_EVENT, onSeen);
  }, []);
  return tick;
}

/** New-comment badge for one task card (shared org query + local seen state). */
export function useTaskCommentSignal(taskId: string | undefined): TaskCommentSignal | null {
  const { userId } = useDataContext();
  const { data: latestByTask } = useTaskCommentSignalsMap();
  const seenTick = useTaskCommentSeenTick();

  if (!taskId || !latestByTask) return null;
  const latest = latestByTask[taskId];
  if (!latest) return null;

  // seenTick is only used to recompute after markTaskCommentSeen
  void seenTick;

  if (
    !isTaskCommentSignalNew({
      taskId,
      createdAt: latest.createdAt,
      authorUserId: latest.authorUserId,
      currentUserId: userId,
    })
  ) {
    return null;
  }

  return {
    authorUserId: latest.authorUserId,
    accentColor: memberAccentColor(latest.authorUserId),
  };
}
