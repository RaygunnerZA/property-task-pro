import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_WATCH_SETTINGS,
  currentPeriodYm,
  type AutomatedResearchMode,
  type ResearchAllowance,
  type WatchUsage,
} from "@/lib/content/knowledgeWatch";
import type { CatalogueReviewReport } from "@/lib/content/officialSourceCatalogue";
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

export type CatalogueSectionRow = {
  id: string;
  jurisdiction: string;
  publisher: string;
  title: string;
  status: "proposed" | "accepted" | "paused";
  last_scan_at: string | null;
  last_scan_ok: boolean | null;
  last_scan_error: string | null;
  tracked_page_count: number;
};

export type CatalogueDetectionRow = {
  id: string;
  catalogue_id: string;
  canonical_path: string;
  source_url: string;
  title: string | null;
  status: string;
  detection: string;
  knowledge_ids: string[];
  public_updated_at: string | null;
  last_checked_at: string | null;
  updated_at: string;
};

export type KnowledgeCataloguePayload = {
  sections: CatalogueSectionRow[];
  review: CatalogueReviewReport | null;
  detections: CatalogueDetectionRow[];
};

export function useKnowledgeCatalogue() {
  return useQuery({
    queryKey: ["admin", "knowledge-source-catalogue"],
    queryFn: async (): Promise<KnowledgeCataloguePayload> => {
      const { data, error } = await (supabase as any).rpc("admin_list_knowledge_source_catalogue");
      if (error) throw error;
      const payload = data as KnowledgeCataloguePayload | null;
      return {
        sections: Array.isArray(payload?.sections) ? payload.sections : [],
        review: payload?.review ?? null,
        detections: Array.isArray(payload?.detections) ? payload.detections : [],
      };
    },
    staleTime: 15_000,
  });
}

export function useAcceptKnowledgeCatalogue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { ids?: string[]; reason: string }) => {
      const { data, error } = await (supabase as any).rpc("admin_accept_knowledge_catalogue", {
        p_ids: input.ids ?? null,
        p_reason: input.reason,
      });
      if (error) throw error;
      return data as KnowledgeCataloguePayload;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "knowledge-source-catalogue"] });
      toast.success("Official catalogue accepted. Watch will monitor those sections — nothing was imported.");
    },
    onError: (e: Error) => {
      toast.error(e?.message || "Couldn't accept the catalogue");
    },
  });
}

export function useSetKnowledgeCatalogueStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: "proposed" | "accepted" | "paused"; reason: string }) => {
      const { data, error } = await (supabase as any).rpc("admin_set_knowledge_catalogue_status", {
        p_id: input.id,
        p_status: input.status,
        p_reason: input.reason,
      });
      if (error) throw error;
      return data as KnowledgeCataloguePayload;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "knowledge-source-catalogue"] });
      toast.success("Catalogue section updated");
    },
    onError: (e: Error) => {
      toast.error(e?.message || "Couldn't update the catalogue section");
    },
  });
}

export function useRunKnowledgeWatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: "manual" | "scheduled" | { trigger?: "manual" | "scheduled"; phase?: "watch" | "catalogue_review" } = "manual") => {
      const trigger = typeof input === "string" ? input : input.trigger ?? "manual";
      const phase = typeof input === "string" ? "watch" : input.phase ?? "watch";
      const { data, error } = await supabase.functions.invoke("knowledge-watch-run", {
        body: { trigger, phase },
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
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-queue"] });
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-metrics"] });
      void qc.invalidateQueries({ queryKey: ["admin", "knowledge-source-catalogue"] });
      toast.success(
        result?.summary
          ? result.summary
          : "Watch run finished"
      );
    },
    onError: (e: Error) => {
      toast.error(e?.message || "Watch run failed");
    },
  });
}
