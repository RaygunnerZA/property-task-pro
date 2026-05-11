import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import type { Json } from "@/integrations/supabase/types";

export type TaskTimelineEventType = "status_change" | "assignment" | "comment" | "attachment";

export interface TaskTimelineEvent {
  id: string;
  type: TaskTimelineEventType;
  description: string;
  /** Short actor hint (no profiles table wire-up yet). */
  author?: string;
  timestamp: Date;
}

function inferEventType(action: string): TaskTimelineEventType {
  const a = action.toLowerCase();
  if (a.includes("assign") || a.includes("assigned") || a.includes("reassign")) {
    return "assignment";
  }
  if (a.includes("comment") || a.includes("message") || a.includes("messag")) {
    return "comment";
  }
  if (a.includes("attach") || a.includes("upload") || a.includes("file")) {
    return "attachment";
  }
  return "status_change";
}

function formatDescription(action: string, metadata: Json | null): string {
  if (typeof metadata === "object" && metadata !== null && !Array.isArray(metadata)) {
    const m = metadata as Record<string, unknown>;
    const summary = typeof m.summary === "string" ? m.summary.trim() : "";
    if (summary) return summary;
    const detail = typeof m.detail === "string" ? m.detail.trim() : "";
    if (detail) return `${action}: ${detail}`;
    const prev = typeof m.previous === "string" ? m.previous : undefined;
    const next = typeof m.next === "string" ? m.next : undefined;
    if (prev != null || next != null) {
      return `${action}${prev || next ? ` (${String(prev ?? "—")} → ${String(next ?? "—")})` : ""}`;
    }
  }
  return action.replace(/^task\./i, "").replace(/\./g, " ") || action;
}

function actorLabel(actorId: string | null): string | undefined {
  if (!actorId) return undefined;
  return `User ${actorId.slice(0, 8)}…`;
}

/**
 * Loads org-scoped `audit_logs` rows for a task (`entity_type = 'task'`).
 * RLS: `org_id = current_org_id()` on `audit_logs`.
 */
export function useTaskTimeline(taskId: string | undefined | null) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const query = useQuery({
    queryKey: ["task-audit-log", orgId, taskId],
    queryFn: async () => {
      if (!orgId || !taskId) return [];

      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action, actor_id, metadata, created_at")
        .eq("org_id", orgId)
        .eq("entity_type", "task")
        .eq("entity_id", taskId)
        .order("created_at", { ascending: false })
        .limit(150);

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && !!taskId && !orgLoading,
    staleTime: 30_000,
  });

  const data: TaskTimelineEvent[] = useMemo(() => {
    const rows = query.data ?? [];
    return rows.map((row) => ({
      id: row.id,
      type: inferEventType(row.action),
      description: formatDescription(row.action, row.metadata),
      author: actorLabel(row.actor_id),
      timestamp: new Date(row.created_at),
    }));
  }, [query.data]);

  return {
    data,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
