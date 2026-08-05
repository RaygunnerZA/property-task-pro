import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { toErrorMessage } from "@/lib/error";
import { formatPersonDisplayName } from "@/lib/formatPersonDisplayName";
import type { Json } from "@/integrations/supabase/types";

export type TaskTimelineEventType =
  | "status_change"
  | "assignment"
  | "comment"
  | "attachment"
  | "checklist"
  | "field_change";

export interface TaskTimelineEvent {
  id: string;
  type: TaskTimelineEventType;
  /** Human summary, e.g. "Due Date changed to 4 July". */
  description: string;
  /** Display name for the actor when known. */
  author?: string;
  timestamp: Date;
  /** Compact single-line activity copy: `2 Dec 12:30 • … • Justin`. */
  line: string;
}

type UserInfoRow = {
  id: string;
  email: string;
  nickname: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

function inferEventType(action: string): TaskTimelineEventType {
  const a = action.toLowerCase();
  if (a.includes("checklist")) return "checklist";
  if (a.includes("assign") || a.includes("assigned") || a.includes("reassign")) {
    return "assignment";
  }
  if (a.includes("comment") || a.includes("message") || a.includes("messag")) {
    return "comment";
  }
  if (a.includes("attach") || a.includes("upload") || a.includes("file")) {
    return "attachment";
  }
  if (a.includes("status")) return "status_change";
  return "field_change";
}

function ordinalDay(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

/** Format a due date for activity copy: "4th July". */
export function formatActivityDueDate(value: string | Date | null | undefined): string {
  if (!value) return "none";

  if (typeof value === "string") {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (dateOnly) {
      const day = Number(dateOnly[3]);
      const monthIndex = Number(dateOnly[2]) - 1;
      const months = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      return `${ordinalDay(day)} ${months[monthIndex] ?? ""}`.trim();
    }
  }

  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "none";
  return `${ordinalDay(d.getUTCDate())} ${format(
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())),
    "MMMM"
  )}`;
}

function formatDescription(action: string, metadata: Json | null): string {
  if (typeof metadata === "object" && metadata !== null && !Array.isArray(metadata)) {
    const m = metadata as Record<string, unknown>;
    const summary = typeof m.summary === "string" ? m.summary.trim() : "";
    if (summary) {
      // Prefer ordinal due-date wording when we have an ISO next value.
      if (m.field === "due_date" && typeof m.next === "string" && m.next) {
        return `Due Date changed to ${formatActivityDueDate(m.next)}`;
      }
      if (m.field === "due_date" && (m.next === null || m.next === undefined)) {
        return "Due Date cleared";
      }
      return summary;
    }
    const detail = typeof m.detail === "string" ? m.detail.trim() : "";
    if (detail) return `${action}: ${detail}`;
    const prev = typeof m.previous === "string" ? m.previous : undefined;
    const next = typeof m.next === "string" ? m.next : undefined;
    if (prev != null || next != null) {
      return `${action}${prev || next ? ` (${String(prev ?? "—")} → ${String(next ?? "—")})` : ""}`;
    }
  }
  return action.replace(/^task\./i, "").replace(/_/g, " ").replace(/\./g, " ") || action;
}

function formatActivityTimestamp(ts: Date): string {
  return format(ts, "d MMM HH:mm");
}

function buildActivityLine(ts: Date, description: string, author?: string): string {
  const parts = [formatActivityTimestamp(ts), description];
  if (author) parts.push(author);
  return parts.join(" • ");
}

/**
 * Loads org-scoped `audit_logs` rows for a task (`entity_type = 'task'`).
 * Ordered oldest → newest (chronological).
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
        .order("created_at", { ascending: true })
        .limit(200);

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && !!taskId && !orgLoading,
    staleTime: 15_000,
  });

  const actorIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of query.data ?? []) {
      if (row.actor_id) ids.add(row.actor_id);
    }
    return [...ids];
  }, [query.data]);

  const actorsQuery = useQuery({
    queryKey: ["task-audit-actors", orgId, actorIds.slice().sort().join(",")],
    queryFn: async (): Promise<Record<string, string>> => {
      if (actorIds.length === 0) return {};
      const { data, error } = (await supabase.rpc("get_users_info", {
        user_ids: actorIds,
      })) as { data: UserInfoRow[] | null; error: unknown };
      if (error) {
        console.warn("[useTaskTimeline] get_users_info failed", error);
        return {};
      }
      const map: Record<string, string> = {};
      for (const u of data ?? []) {
        map[u.id] = formatPersonDisplayName({
          first_name: u.first_name,
          last_name: u.last_name,
          nickname: u.nickname,
          email: u.email,
          fallback: `User ${u.id.slice(0, 8)}`,
        });
        // Prefer first name alone when present (matches activity examples: "Justin").
        const first = u.first_name?.trim();
        if (first) map[u.id] = first;
      }
      return map;
    },
    enabled: !!orgId && actorIds.length > 0 && !orgLoading,
    staleTime: 60_000,
  });

  const data: TaskTimelineEvent[] = useMemo(() => {
    const rows = query.data ?? [];
    const names = actorsQuery.data ?? {};
    return rows.map((row) => {
      const timestamp = new Date(row.created_at);
      const description = formatDescription(row.action, row.metadata);
      const author = row.actor_id ? names[row.actor_id] : undefined;
      return {
        id: row.id,
        type: inferEventType(row.action),
        description,
        author,
        timestamp,
        line: buildActivityLine(timestamp, description, author),
      };
    });
  }, [query.data, actorsQuery.data]);

  return {
    data,
    isLoading: query.isLoading,
    error: query.error ? new Error(toErrorMessage(query.error, "Couldn't load activity")) : null,
    refetch: query.refetch,
  };
}
