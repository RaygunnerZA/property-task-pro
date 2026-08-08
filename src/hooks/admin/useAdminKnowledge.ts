import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  trackKnowledgeCreated,
  trackKnowledgeVerified,
} from "@/lib/knowledge/knowledgeTelemetry";
import type { KnowledgeRow, KnowledgeStatus } from "@/types/knowledge";

export type AdminKnowledgeMetricsRow = {
  org_id: string;
  org_name: string;
  knowledge_created: number;
  knowledge_verified: number;
  knowledge_published: number;
  knowledge_reused: number;
  questions_answered: number;
  automation_created: number;
  time_saved_minutes: number;
};

export function useAdminKnowledgeQueue(statuses: KnowledgeStatus[] = ["candidate", "verified"]) {
  return useQuery({
    queryKey: ["admin-knowledge-queue", statuses.join(",")],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_list_knowledge_review_queue", {
        p_statuses: statuses,
        p_scope: null,
      });
      if (error) throw error;
      return (data ?? []) as KnowledgeRow[];
    },
  });
}

export function useAdminSetKnowledgeStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      knowledgeId,
      status,
    }: {
      knowledgeId: string;
      status: KnowledgeStatus;
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_set_knowledge_status", {
        p_knowledge_id: knowledgeId,
        p_status: status,
      });
      if (error) throw error;
      return data as KnowledgeRow;
    },
    onSuccess: (row, vars) => {
      if (vars.status === "verified" || vars.status === "published") {
        trackKnowledgeVerified({
          org_id: row.org_id,
          knowledge_id: row.id,
          scope: row.scope,
        });
      }
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-queue"] });
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-metrics"] });
    },
  });
}

export function useAdminKnowledgeMetrics() {
  return useQuery({
    queryKey: ["admin-knowledge-metrics"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_knowledge_metrics_snapshot");
      if (error) throw error;
      return (data ?? []) as AdminKnowledgeMetricsRow[];
    },
    staleTime: 60_000,
  });
}

export function useAdminUpsertPlatformKnowledge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      summary?: string;
      body?: string;
      sourceKind?: "filla_curated" | "community_brain";
      cohortSize?: number | null;
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_upsert_platform_knowledge", {
        p_title: input.title,
        p_summary: input.summary ?? null,
        p_body: input.body ?? null,
        p_source_kind: input.sourceKind ?? "filla_curated",
        p_cohort_size: input.cohortSize ?? null,
        p_status: "candidate",
      });
      if (error) throw error;
      return data as KnowledgeRow;
    },
    onSuccess: (row) => {
      trackKnowledgeCreated({
        org_id: row.org_id,
        knowledge_id: row.id,
        scope: row.scope,
        source_kind: row.source_kind,
      });
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-queue"] });
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-metrics"] });
    },
  });
}
