import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_WATCH_SETTINGS,
  currentPeriodYm,
  type AutomatedResearchMode,
  type ResearchAllowance,
  type WatchUsage,
} from "@/lib/content/knowledgeWatch";
import { formatEdgeFunctionToast, parseEdgeFunctionError } from "@/lib/edgeFunctionErrors";
import { toast } from "sonner";

export type KnowledgeWatchSettingsPayload = {
  automated_research: AutomatedResearchMode;
  research_allowance: ResearchAllowance;
  updated_at?: string;
  updated_by?: string | null;
  usage: WatchUsage;
  last_run: {
    id: string;
    trigger: string;
    status: string;
    started_at: string;
    finished_at: string | null;
    summary: string | null;
    searches_used: number;
    pages_used: number;
    tokens_used: number;
    subjects_added: number;
    subjects_updated: number;
    skip_reasons: unknown;
  } | null;
};

export type KnowledgeWatchRunRow = {
  id: string;
  trigger: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  summary: string | null;
  sources_checked: unknown;
  subjects_added: number;
  subjects_updated: number;
  searches_used: number;
  pages_used: number;
  tokens_used: number;
  cost_units_used: number;
  skip_reasons: unknown;
  detail: Record<string, unknown>;
  error_message: string | null;
};

function emptyUsage(): WatchUsage {
  return {
    period_ym: currentPeriodYm(),
    searches_used: 0,
    pages_used: 0,
    tokens_used: 0,
    cost_units_used: 0,
  };
}

export function useKnowledgeWatchSettings() {
  return useQuery({
    queryKey: ["admin", "knowledge-watch-settings"],
    queryFn: async (): Promise<KnowledgeWatchSettingsPayload> => {
      const { data, error } = await (supabase as any).rpc("admin_get_knowledge_watch_settings");
      if (error) throw error;
      const payload = data as KnowledgeWatchSettingsPayload | null;
      if (!payload || typeof payload !== "object") {
        return {
          ...DEFAULT_WATCH_SETTINGS,
          usage: emptyUsage(),
          last_run: null,
        };
      }
      return {
        automated_research: payload.automated_research ?? "paused",
        research_allowance: payload.research_allowance ?? "light",
        updated_at: payload.updated_at,
        updated_by: payload.updated_by,
        usage: {
          ...emptyUsage(),
          ...(payload.usage && typeof payload.usage === "object" ? payload.usage : {}),
        },
        last_run: payload.last_run ?? null,
      };
    },
    staleTime: 15_000,
  });
}

export function useSetKnowledgeWatchSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      automated_research?: AutomatedResearchMode;
      research_allowance?: ResearchAllowance;
      reason: string;
    }) => {
      const { data, error } = await (supabase as any).rpc("admin_set_knowledge_watch_settings", {
        p_automated_research: input.automated_research ?? null,
        p_research_allowance: input.research_allowance ?? null,
        p_reason: input.reason,
      });
      if (error) throw error;
      return data as KnowledgeWatchSettingsPayload;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "knowledge-watch-settings"] });
      void qc.invalidateQueries({ queryKey: ["admin", "knowledge-watch-runs"] });
      toast.success("Watch settings saved");
    },
    onError: (e: Error) => {
      toast.error(e?.message || "Couldn't save Watch settings");
    },
  });
}

export function useKnowledgeWatchRuns(limit = 10) {
  return useQuery({
    queryKey: ["admin", "knowledge-watch-runs", limit],
    queryFn: async (): Promise<KnowledgeWatchRunRow[]> => {
      const { data, error } = await (supabase as any).rpc("admin_list_knowledge_watch_runs", {
        p_limit: limit,
      });
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as KnowledgeWatchRunRow[];
    },
    staleTime: 15_000,
  });
}

export function useRunKnowledgeWatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (trigger: "manual" | "scheduled" = "manual") => {
      const { data, error } = await supabase.functions.invoke("knowledge-watch-run", {
        body: { trigger },
      });
      if (error) {
        const parsed = await parseEdgeFunctionError(error, data, "knowledge-watch-run");
        throw new Error(formatEdgeFunctionToast(parsed) || error.message || "Watch run failed");
      }
      const payload = data as { ok?: boolean; error?: string; message?: string; summary?: string } | null;
      if (payload && payload.ok === false) {
        throw new Error(payload.message || payload.error || "Watch run failed");
      }
      return {
        ok: true as const,
        status: (payload && "status" in payload ? String((payload as { status?: string }).status ?? "") : "") || "succeeded",
        run_id: (payload as { run_id?: string } | null)?.run_id ?? "",
        summary: payload?.summary || "Watch run finished",
      };
    },
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["admin", "knowledge-watch-settings"] });
      void qc.invalidateQueries({ queryKey: ["admin", "knowledge-watch-runs"] });
      toast.success(result?.summary || "Watch run finished");
    },
    onError: (e: Error) => {
      toast.error(e?.message || "Watch run failed");
    },
  });
}
