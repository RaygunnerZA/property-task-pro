import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  trackKnowledgeCreated,
  trackKnowledgeVerified,
} from "@/lib/knowledge/knowledgeTelemetry";
import type {
  ContentOutputKind,
  ContentOutputRow,
  ContentOutputStatus,
  ContentTopicRow,
  KnowledgeApplicability,
  KnowledgeRow,
  KnowledgeStatus,
} from "@/types/knowledge";

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

export type KnowledgeSourceRow = {
  id: string;
  knowledge_id: string;
  source_type: string;
  label: string | null;
  url: string | null;
  attachment_id: string | null;
  external_ref: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type KnowledgeVerificationEventRow = {
  id: string;
  knowledge_id: string;
  org_id: string | null;
  event_type: string;
  actor_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export type KnowledgeDetailPayload = {
  knowledge: KnowledgeRow;
  sources: KnowledgeSourceRow[];
  verification_events: KnowledgeVerificationEventRow[];
};

async function invokeKnowledgeCritic(knowledgeId: string) {
  const { error } = await supabase.functions.invoke("knowledge-critic", {
    body: { knowledge_id: knowledgeId },
  });
  if (error) throw error;
}

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

export function useAdminKnowledgeDetail(knowledgeId: string | null) {
  return useQuery({
    queryKey: ["admin-knowledge-detail", knowledgeId],
    enabled: Boolean(knowledgeId),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_get_knowledge_detail", {
        p_knowledge_id: knowledgeId,
      });
      if (error) throw error;
      return data as KnowledgeDetailPayload;
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
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-detail"] });
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
      id?: string;
      title: string;
      summary?: string;
      body?: string;
      sourceKind?: "filla_curated" | "community_brain";
      cohortSize?: number | null;
      applicability?: KnowledgeApplicability;
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_upsert_platform_knowledge", {
        p_title: input.title,
        p_summary: input.summary ?? null,
        p_body: input.body ?? null,
        p_source_kind: input.sourceKind ?? "filla_curated",
        p_cohort_size: input.cohortSize ?? null,
        p_id: input.id ?? null,
        p_status: "candidate",
        p_applicability: input.applicability ?? {},
      });
      if (error) throw error;
      const row = data as KnowledgeRow;
      // Critic is mandatory for new/edited candidates
      await invokeKnowledgeCritic(row.id);
      return row;
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
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-detail"] });
    },
  });
}

export function useAdminBulkCreateKnowledgeCandidates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      filename: string;
      mime?: string;
      storageBucket?: string | null;
      storagePath?: string | null;
      columnMapping: Record<string, string>;
      candidates: Array<{
        title: string;
        summary?: string;
        body?: string;
        applicability: KnowledgeApplicability;
        source_row?: number;
      }>;
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: batch, error: batchErr } = await (supabase as any).rpc(
        "admin_create_knowledge_intake_batch",
        {
          p_source_filename: input.filename,
          p_source_mime: input.mime ?? null,
          p_storage_bucket: input.storageBucket ?? null,
          p_storage_path: input.storagePath ?? null,
          p_row_count: input.candidates.length,
          p_column_mapping: input.columnMapping,
          p_metadata: {},
        }
      );
      if (batchErr) throw batchErr;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc(
        "admin_bulk_create_platform_knowledge_candidates",
        {
          p_batch_id: batch.id,
          p_candidates: input.candidates.map((c) => ({
            title: c.title,
            summary: c.summary ?? null,
            body: c.body ?? null,
            applicability: c.applicability,
            source_row: c.source_row ?? null,
          })),
        }
      );
      if (error) throw error;

      const result = data as { batch_id: string; created_count: number; knowledge_ids: string[] };
      // Mandatory critic — sequential to avoid stampeding providers
      for (const id of result.knowledge_ids ?? []) {
        try {
          await invokeKnowledgeCritic(id);
        } catch (err) {
          console.error("knowledge-critic failed for", id, err);
        }
      }
      return result;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-queue"] });
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-metrics"] });
    },
  });
}

export function useAdminUploadKnowledgeIntakeFile() {
  return useMutation({
    mutationFn: async (file: File) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
      const path = `platform/${user.id}/${crypto.randomUUID()}-${safe}`;
      const { error } = await supabase.storage.from("knowledge-intake").upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (error) throw error;
      return { bucket: "knowledge-intake", path, filename: file.name, mime: file.type };
    },
  });
}

export function useAdminContentTopics() {
  return useQuery({
    queryKey: ["admin-content-topics"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_list_content_topics", {
        p_status: null,
      });
      if (error) throw error;
      return (data ?? []) as ContentTopicRow[];
    },
  });
}

export function useAdminContentTopic(topicId: string | null) {
  return useQuery({
    queryKey: ["admin-content-topic", topicId],
    enabled: Boolean(topicId),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_get_content_topic", {
        p_topic_id: topicId,
      });
      if (error) throw error;
      return data as {
        topic: ContentTopicRow;
        knowledge: KnowledgeRow;
        outputs: ContentOutputRow[];
        sources: KnowledgeSourceRow[];
      };
    },
  });
}

export function useAdminCreateContentTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { knowledgeId: string; title?: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_create_content_topic", {
        p_knowledge_id: input.knowledgeId,
        p_title: input.title ?? null,
      });
      if (error) throw error;
      return data as ContentTopicRow;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-content-topics"] });
    },
  });
}

export function useAdminUpsertContentTopicStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      topicId: string;
      seo?: Record<string, unknown>;
      brief?: Record<string, unknown>;
      creative?: Record<string, unknown>;
      publishing?: Record<string, unknown>;
      title?: string;
      status?: string;
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_upsert_content_topic_stage", {
        p_topic_id: input.topicId,
        p_seo: input.seo ?? null,
        p_brief: input.brief ?? null,
        p_creative: input.creative ?? null,
        p_publishing: input.publishing ?? null,
        p_title: input.title ?? null,
        p_status: input.status ?? null,
      });
      if (error) throw error;
      return data as ContentTopicRow;
    },
    onSuccess: (_row, vars) => {
      void qc.invalidateQueries({ queryKey: ["admin-content-topic", vars.topicId] });
      void qc.invalidateQueries({ queryKey: ["admin-content-topics"] });
    },
  });
}

export function useAdminUpsertContentOutput() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      topicId: string;
      outputKind: ContentOutputKind;
      title?: string;
      body?: string;
      structured?: Record<string, unknown>;
      status?: ContentOutputStatus;
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_upsert_content_output", {
        p_topic_id: input.topicId,
        p_output_kind: input.outputKind,
        p_title: input.title ?? null,
        p_body: input.body ?? null,
        p_structured: input.structured ?? null,
        p_status: input.status ?? null,
        p_provenance: null,
      });
      if (error) throw error;
      return data as ContentOutputRow;
    },
    onSuccess: (_row, vars) => {
      void qc.invalidateQueries({ queryKey: ["admin-content-topic", vars.topicId] });
    },
  });
}

export function useAdminSetContentOutputStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { outputId: string; status: ContentOutputStatus; topicId: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_set_content_output_status", {
        p_output_id: input.outputId,
        p_status: input.status,
      });
      if (error) throw error;
      return data as ContentOutputRow;
    },
    onSuccess: (_row, vars) => {
      void qc.invalidateQueries({ queryKey: ["admin-content-topic", vars.topicId] });
    },
  });
}
