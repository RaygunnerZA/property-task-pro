/**
 * Property hub — timeline: org-scoped task activity for one property.
 * Merges `tasks` (opened) with `audit_logs` rows for those tasks (`entity_type = 'task'`).
 * Per @Docs/03_Data_Model — uses documented columns only; `useActiveOrg` for `org_id`.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import type { Json } from "@/integrations/supabase/types";

export interface PropertyTimelineEvent {
  id: string;
  /** ISO timestamp for sorting / display */
  date: string;
  type: "task" | "drift" | "compliance" | "inspection";
  description: string;
}

function inferPropertyTimelineType(action: string): PropertyTimelineEvent["type"] {
  const a = action.toLowerCase();
  if (a.includes("drift")) return "drift";
  if (
    a.includes("compliance") ||
    a.includes("document") ||
    a.includes("expir") ||
    a.includes("certificate") ||
    a.includes("filing")
  ) {
    return "compliance";
  }
  if (a.includes("inspect")) return "inspection";
  return "task";
}

function formatAuditDescription(action: string, metadata: Json | null): string {
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

type TimelineQueryData = {
  audits: { id: string; action: string; metadata: Json | null; created_at: string }[];
  tasks: { id: string; title: string; created_at: string }[];
};

export function usePropertyTimeline(propertyId: string | undefined | null) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const query = useQuery({
    queryKey: ["property-timeline", orgId, propertyId],
    queryFn: async (): Promise<TimelineQueryData> => {
      if (!orgId || !propertyId) return { audits: [], tasks: [] };

      const { data: tasks, error: tasksError } = await supabase
        .from("tasks")
        .select("id, title, created_at")
        .eq("org_id", orgId)
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (tasksError) throw tasksError;
      const taskRows = tasks ?? [];
      const taskIds = taskRows.map((t) => t.id);

      if (taskIds.length === 0) {
        return { audits: [], tasks: taskRows };
      }

      const { data: audits, error: auditError } = await supabase
        .from("audit_logs")
        .select("id, action, metadata, created_at")
        .eq("org_id", orgId)
        .eq("entity_type", "task")
        .in("entity_id", taskIds)
        .order("created_at", { ascending: false })
        .limit(150);

      if (auditError) throw auditError;
      return { audits: audits ?? [], tasks: taskRows };
    },
    enabled: !!orgId && !!propertyId && !orgLoading,
    staleTime: 30_000,
  });

  const events: PropertyTimelineEvent[] = useMemo(() => {
    if (!query.data) return [];
    const { audits, tasks } = query.data;
    type Row = PropertyTimelineEvent & { t: number };
    const rows: Row[] = [];

    for (const t of tasks) {
      rows.push({
        id: `task-opened:${t.id}`,
        date: t.created_at,
        type: "task",
        description: `Task opened: ${t.title}`,
        t: new Date(t.created_at).getTime(),
      });
    }

    for (const a of audits) {
      rows.push({
        id: `audit:${a.id}`,
        date: a.created_at,
        type: inferPropertyTimelineType(a.action),
        description: formatAuditDescription(a.action, a.metadata),
        t: new Date(a.created_at).getTime(),
      });
    }

    rows.sort((x, y) => y.t - x.t);
    const out: PropertyTimelineEvent[] = [];
    const limit = 80;
    for (const r of rows) {
      if (out.length >= limit) break;
      out.push({ id: r.id, date: r.date, type: r.type, description: r.description });
    }
    return out;
  }, [query.data]);

  return {
    events,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
