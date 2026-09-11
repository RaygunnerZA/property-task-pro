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
import {
  PLATFORM_AI_ORG_ID,
  proposalsFromDocAnalysis,
  type DocAnalysePayload,
  type KnowledgeSourceProvenance,
  type ProposedKnowledgeCandidate,
} from "@/lib/knowledge/knowledgeDocumentIntake";
import {
  applyGapApplicabilityToProposals,
  uniqueTopicLabel,
} from "@/lib/knowledge/knowledgeGapResearch";
import { MAX_RESEARCH_GAPS } from "@/lib/knowledge/knowledgeCoverage";
import {
  mergeClaimsWithAttributeFallback,
  serializeClaimsForRpc,
} from "@/lib/knowledge/knowledgeClaims";
import type { WorkbookManifest } from "@/lib/knowledge/knowledgeSheetParse";
import {
  formatEdgeFunctionToast,
  parseEdgeFunctionError,
} from "@/lib/edgeFunctionErrors";

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
  claims?: Array<Record<string, unknown>>;
};

async function invokeKnowledgeCritic(knowledgeId: string) {
  const { error } = await supabase.functions.invoke("knowledge-critic", {
    body: { knowledge_id: knowledgeId },
  });
  if (error) throw error;
}

async function invokeKnowledgeExtractClaims(knowledgeId: string) {
  const { data, error } = await supabase.functions.invoke("knowledge-extract-claims", {
    body: { knowledge_id: knowledgeId },
  });
  if (error) throw error;
  const payload = data as { ok?: boolean; error?: string; message?: string; inserted_count?: number };
  if (payload && payload.ok === false) {
    const err = new Error(payload.message || payload.error || "Claim extraction failed");
    (err as Error & { code?: string }).code = payload.error;
    throw err;
  }
  return payload;
}

async function invokeKnowledgeGenerateGuidance(
  knowledgeIds: string[],
  opts?: { mode?: "generate" | "improve"; persist?: boolean }
) {
  const { data, error, response } = await supabase.functions.invoke(
    "knowledge-generate-guidance",
    {
      body:
        knowledgeIds.length === 1
          ? {
              knowledge_id: knowledgeIds[0],
              mode: opts?.mode ?? "generate",
              persist: opts?.persist !== false,
            }
          : {
              knowledge_ids: knowledgeIds,
              mode: opts?.mode ?? "generate",
              persist: opts?.persist !== false,
            },
    }
  );

  if (error) {
    const info = await parseEdgeFunctionError(error, data, "knowledge-generate-guidance");
    if (!info.status && response) info.status = response.status;
    const message = formatEdgeFunctionToast(info);
    const err = new Error(message) as Error & {
      code?: string;
      requestId?: string;
      status?: number;
    };
    err.code = info.code;
    err.requestId = info.requestId;
    err.status = info.status;
    throw err;
  }

  const payload = data as {
    ok: boolean;
    generated: number;
    mode?: string;
    request_id?: string;
    code?: string;
    message?: string;
    results: Array<{
      id: string;
      ok: boolean;
      error?: string;
      code?: string;
      summary?: string;
      persisted?: boolean;
    }>;
  };

  if (payload && payload.ok === false && knowledgeIds.length === 1) {
    const first = payload.results?.[0];
    const info = {
      message:
        payload.message ||
        first?.error ||
        "Guidance could not be improved.",
      code: payload.code || first?.code,
      requestId: payload.request_id,
    };
    throw new Error(formatEdgeFunctionToast(info));
  }

  return payload;
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

/** Canonical sources for one or many knowledge ids (list + detail agreement). */
export function useAdminKnowledgeSources(knowledgeIds: string[]) {
  const key = [...knowledgeIds].sort().join(",");
  return useQuery({
    queryKey: ["admin-knowledge-sources", key],
    enabled: knowledgeIds.length > 0,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_list_knowledge_sources", {
        p_knowledge_ids: knowledgeIds,
      });
      if (error) throw error;
      return (data ?? []) as KnowledgeSourceRow[];
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
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-sources"] });
      void qc.invalidateQueries({ queryKey: ["admin-content-topic"] });
    },
  });
}

export function useAdminRunKnowledgeCritic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (knowledgeId: string) => {
      await invokeKnowledgeCritic(knowledgeId);
    },
    onSuccess: (_data, knowledgeId) => {
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-detail", knowledgeId] });
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-queue"] });
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-sources"] });
    },
  });
}

export function useAdminExtractKnowledgeClaims() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (knowledgeId: string) => invokeKnowledgeExtractClaims(knowledgeId),
    onSuccess: (_data, knowledgeId) => {
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-detail", knowledgeId] });
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-queue"] });
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-sources"] });
    },
  });
}

export function useAdminAddKnowledgeSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      knowledgeId: string;
      url: string;
      label?: string | null;
      sourceType?: string;
    }) => {
      const url = input.url.trim();
      if (!/^https?:\/\//i.test(url)) {
        throw new Error("Enter a valid http(s) URL");
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_add_knowledge_source", {
        p_knowledge_id: input.knowledgeId,
        p_source_type: input.sourceType ?? "url",
        p_label: input.label?.trim() || null,
        p_url: url,
      });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).rpc("knowledge_invalidate_critic", {
        p_knowledge_id: input.knowledgeId,
        p_reason: "source_edit",
      });
      return data as KnowledgeSourceRow;
    },
    onSuccess: (_row, vars) => {
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-detail", vars.knowledgeId] });
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-queue"] });
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-sources"] });
      void qc.invalidateQueries({ queryKey: ["admin-content-topic"] });
    },
  });
}

export function useAdminUpdateKnowledgeSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      sourceId: string;
      knowledgeId: string;
      url?: string;
      label?: string | null;
    }) => {
      if (input.url !== undefined) {
        const url = input.url.trim();
        if (!/^https?:\/\//i.test(url)) {
          throw new Error("Enter a valid http(s) URL");
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_update_knowledge_source", {
        p_source_id: input.sourceId,
        p_url: input.url !== undefined ? input.url.trim() : null,
        // Empty string clears label; omit/undefined keeps existing (sent as null).
        p_label: input.label !== undefined ? input.label.trim() : null,
      });
      if (error) throw error;
      return data as KnowledgeSourceRow;
    },
    onSuccess: (_row, vars) => {
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-detail", vars.knowledgeId] });
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-queue"] });
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-sources"] });
      void qc.invalidateQueries({ queryKey: ["admin-content-topic"] });
    },
  });
}

export function useAdminGenerateKnowledgeGuidance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      knowledgeIds: string[];
      mode?: "generate" | "improve";
      persist?: boolean;
    }) => {
      if (input.knowledgeIds.length === 0) {
        return { ok: true, generated: 0, results: [] };
      }
      return invokeKnowledgeGenerateGuidance(input.knowledgeIds, {
        mode: input.mode,
        persist: input.persist,
      });
    },
    onSuccess: (_data, vars) => {
      if (vars.persist === false) return;
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-queue"] });
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-detail"] });
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-sources"] });
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-missing-guidance"] });
    },
  });
}

export function useAdminMissingGuidanceCount() {
  return useQuery({
    queryKey: ["admin-knowledge-missing-guidance"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_count_knowledge_missing_guidance");
      if (error) throw error;
      return Number(data ?? 0);
    },
    staleTime: 30_000,
  });
}

export function useAdminSetDraftGuidance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      knowledgeId: string;
      summary: string;
      body?: string | null;
      draftMeta?: Record<string, unknown>;
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_set_knowledge_draft_guidance", {
        p_knowledge_id: input.knowledgeId,
        p_summary: input.summary,
        p_body: input.body ?? null,
        p_draft_meta: input.draftMeta ?? {
          source: "human_edit",
          proposed_at: new Date().toISOString(),
          supported_by: ["manual_edit"],
          unverified: true,
        },
      });
      if (error) throw error;
      return data as KnowledgeRow;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-queue"] });
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-detail"] });
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-missing-guidance"] });
    },
  });
}

export function useAdminApplyDeterministicGuidance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (knowledgeIds?: string[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc(
        "admin_apply_deterministic_draft_guidance",
        { p_knowledge_ids: knowledgeIds?.length ? knowledgeIds : null }
      );
      if (error) throw error;
      return data as { updated: number };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-queue"] });
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-detail"] });
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-missing-guidance"] });
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
      columnMapping: Record<string, unknown>;
      sheetNames?: string[];
      batchMetadata?: Record<string, unknown>;
      candidates: Array<{
        title: string;
        summary?: string;
        body?: string;
        applicability: KnowledgeApplicability;
        attributes?: Record<string, string>;
        provenance?: Record<string, string>;
        source_row?: number;
        sheet_name?: string;
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
          p_metadata: {
            sheet_names: input.sheetNames ?? [],
            multi_sheet: (input.sheetNames?.length ?? 0) > 1,
            ...(input.batchMetadata ?? {}),
          },
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
            attributes: c.attributes ?? {},
            provenance: c.provenance ?? {},
            source_row: c.source_row ?? null,
            sheet_name: c.sheet_name ?? null,
          })),
        }
      );
      if (error) throw error;

      const result = data as { batch_id: string; created_count: number; knowledge_ids: string[] };
      // Extract atomic claims from linked sources when possible, then mandatory critic.
      for (const id of result.knowledge_ids ?? []) {
        try {
          await invokeKnowledgeExtractClaims(id);
        } catch (err) {
          // Spreadsheet rows may lack fetchable source text — attribute claims remain.
          console.warn("knowledge-extract-claims skipped/failed for", id, err);
        }
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
      const safe = file.name.replace(/[^\w.-]+/g, "_").slice(0, 120);
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

export type KnowledgeIntakeStorage = {
  bucket: string;
  path: string;
  filename: string;
  mime: string;
};

/** Run ai-doc-analyse in knowledge_intake mode (proposals only — no DB writes). */
export function useAdminAnalyseKnowledgeDocument() {
  return useMutation({
    mutationFn: async (storage: KnowledgeIntakeStorage) => {
      const { data: signed, error: signErr } = await supabase.storage
        .from(storage.bucket)
        .createSignedUrl(storage.path, 3600);
      if (signErr || !signed?.signedUrl) {
        throw signErr ?? new Error("Could not sign storage URL");
      }

      const { data, error } = await supabase.functions.invoke("ai-doc-analyse", {
        body: {
          file_url: signed.signedUrl,
          file_name: storage.filename,
          org_id: PLATFORM_AI_ORG_ID,
          knowledge_intake: true,
        },
      });
      if (error) throw error;

      const payload = (data ?? {}) as DocAnalysePayload;
      if (payload.ok === false || payload.skipped || payload.error === "ai_allowance_exhausted") {
        throw new Error(payload.error ?? "Document analysis skipped");
      }
      return payload;
    },
  });
}

export type KnowledgeUrlIntakeResult = {
  ok: boolean;
  storage: KnowledgeIntakeStorage;
  source: KnowledgeSourceProvenance & { final_url?: string };
  analysis: DocAnalysePayload;
};

async function analyseKnowledgeUrl(url: string): Promise<KnowledgeUrlIntakeResult> {
  const trimmed = url.trim();
  if (!trimmed) throw new Error("URL required");

  const { data, error } = await supabase.functions.invoke("knowledge-intake-url", {
    body: { url: trimmed },
  });
  if (error) {
    const info = await parseEdgeFunctionError(error, data, "knowledge-intake-url");
    throw new Error(formatEdgeFunctionToast(info));
  }

  const payload = data as KnowledgeUrlIntakeResult & { error?: string };
  if (!payload?.ok) throw new Error(payload.error ?? "URL intake failed");
  return payload;
}

async function importPlatformKnowledgeProposals(input: {
  filename: string;
  mime?: string;
  storage: KnowledgeIntakeStorage | null;
  intakeMode: "upload" | "url" | "manual";
  source: KnowledgeSourceProvenance;
  proposals: ProposedKnowledgeCandidate[];
}): Promise<{ batch_id: string; created_count: number; knowledge_ids: string[] }> {
  const selected = input.proposals.filter((p) => p.selected);
  if (!selected.length) throw new Error("No candidates selected");

  for (const p of selected) {
    if (p.applicability.jurisdictions.length === 0 && !p.applicability.unscoped) {
      throw new Error(`Applicability required for “${p.title}”`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: batch, error: batchErr } = await (supabase as any).rpc(
    "admin_create_knowledge_intake_batch",
    {
      p_source_filename: input.filename,
      p_source_mime: input.mime ?? null,
      p_storage_bucket: input.storage?.bucket ?? null,
      p_storage_path: input.storage?.path ?? null,
      p_row_count: selected.length,
      p_column_mapping: {},
      p_metadata: {
        intake_mode: input.intakeMode,
        source: input.source,
      },
    }
  );
  if (batchErr) throw batchErr;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(
    "admin_bulk_create_platform_knowledge_candidates",
    {
      p_batch_id: batch.id,
      p_candidates: selected.map((p) => ({
        title: p.title,
        summary: p.summary || null,
        body: p.body || null,
        applicability: p.applicability,
        attributes: p.attributes,
        claims: serializeClaimsForRpc(
          p.claims?.length ? p.claims : mergeClaimsWithAttributeFallback([], p.attributes)
        ),
        provenance: {
          ...p.provenance,
          ...input.source,
          intake_mode: input.intakeMode,
        },
      })),
    }
  );
  if (error) throw error;

  const result = data as { batch_id: string; created_count: number; knowledge_ids: string[] };
  const ids = result.knowledge_ids ?? [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const claimCount = selected[i]?.claims?.length ?? 0;
    if (claimCount < 4) {
      try {
        await invokeKnowledgeExtractClaims(id);
      } catch (err) {
        console.warn("knowledge-extract-claims skipped/failed for", id, err);
      }
    }
    try {
      await invokeKnowledgeCritic(id);
    } catch (err) {
      console.error("knowledge-critic failed for", id, err);
    }
  }
  return result;
}

export type WorkbookSheetInterpretationResult = {
  sheet_name: string;
  classification: "knowledge_data" | "context" | "exclude";
  confidence: number;
  reason: string;
  row_semantics: string;
  related_sheets: string[];
  should_create_candidates: boolean;
};

export type WorkbookInterpretationResult = {
  ok?: boolean;
  interpretation_status?: "ok" | "fallback";
  interpretation_error?: string | null;
  sheets: WorkbookSheetInterpretationResult[];
};

/** Safe URL fetch + storage + ai-doc-analyse (platform admin only). */
export function useAdminAnalyseKnowledgeUrl() {
  return useMutation({
    mutationFn: analyseKnowledgeUrl,
  });
}

export type KnowledgeGapResearchProgress =
  | { phase: "discovering"; gapCount: number }
  | { phase: "fetching"; index: number; total: number; title: string }
  | { phase: "importing"; candidateCount: number };

export type KnowledgeGapResearchResult = {
  createdCount: number;
  knowledgeIds: string[];
  sourceCount: number;
  uncoveredGapIds: string[];
  failedSources: Array<{ url: string; error: string }>;
};

type GapResearchSource = {
  url: string;
  title?: string;
  publisher?: string;
  covers: string[];
};

export async function ingestResearchSources(input: {
  gaps: Array<{
    id: string;
    topic_key: string;
    topic: string;
    jurisdiction: string;
    status: "missing" | "partial";
  }>;
  sources: GapResearchSource[];
  uncovered?: string[];
  onProgress?: (progress: KnowledgeGapResearchProgress) => void;
}): Promise<KnowledgeGapResearchResult> {
  const gaps = input.gaps;
  const sources = input.sources.filter((s) => typeof s.url === "string");
  if (sources.length === 0) {
    throw new Error("No official source URL was found for the selected gaps");
  }

  const gapsById = new Map(gaps.map((g) => [g.id, g]));
  const failedSources: Array<{ url: string; error: string }> = [];
  let createdCount = 0;
  const knowledgeIds: string[] = [];

  for (let i = 0; i < sources.length; i++) {
    const sourceHit = sources[i];
    input.onProgress?.({
      phase: "fetching",
      index: i + 1,
      total: sources.length,
      title: sourceHit.title || sourceHit.url,
    });

    const covered = sourceHit.covers
      .map((id) => gapsById.get(id))
      .filter((g): g is (typeof gaps)[number] => Boolean(g));
    const jurisdictions = covered.map((g) => g.jurisdiction);
    const topicLabel = uniqueTopicLabel(covered.map((g) => g.topic));

    try {
      const intake = await analyseKnowledgeUrl(sourceHit.url);
      const proposals = applyGapApplicabilityToProposals(
        proposalsFromDocAnalysis(intake.analysis, {
          ...intake.source,
          intake_mode: "url",
        }),
        jurisdictions,
        topicLabel
      ).filter((p) => p.selected);
      if (!proposals.length) {
        failedSources.push({ url: sourceHit.url, error: "no_candidates" });
        continue;
      }
      input.onProgress?.({ phase: "importing", candidateCount: proposals.length });
      const imported = await importPlatformKnowledgeProposals({
        filename: intake.storage.filename,
        mime: intake.storage.mime,
        storage: intake.storage,
        intakeMode: "url",
        source: {
          ...intake.source,
          intake_mode: "url",
        },
        proposals,
      });
      createdCount += imported.created_count;
      knowledgeIds.push(...(imported.knowledge_ids ?? []));
    } catch (err) {
      failedSources.push({
        url: sourceHit.url,
        error: err instanceof Error ? err.message : "intake_failed",
      });
    }
  }

  if (createdCount === 0) {
    const detail = failedSources[0]?.error ?? "intake_failed";
    throw new Error(`Research did not add any Review candidates (${detail})`);
  }

  return {
    createdCount,
    knowledgeIds,
    sourceCount: sources.length,
    uncoveredGapIds: input.uncovered ?? [],
    failedSources,
  };
}

export function useAdminResearchKnowledgeGaps() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      gaps: Array<{
        id: string;
        topic_key: string;
        topic: string;
        jurisdiction: string;
        status: "missing" | "partial";
      }>;
      onProgress?: (progress: KnowledgeGapResearchProgress) => void;
    }): Promise<KnowledgeGapResearchResult> => {
      const gaps = input.gaps.slice(0, MAX_RESEARCH_GAPS);
      if (!gaps.length) throw new Error("Select at least one missing or partial cell");
      input.onProgress?.({ phase: "discovering", gapCount: gaps.length });

      const { data, error } = await supabase.functions.invoke("knowledge-gap-research", {
        body: { gaps },
      });
      if (error) {
        const info = await parseEdgeFunctionError(error, data, "knowledge-gap-research");
        throw new Error(formatEdgeFunctionToast(info));
      }

      const payload = data as {
        ok?: boolean;
        error?: string;
        sources?: GapResearchSource[];
        uncovered?: string[];
      };
      if (!payload?.ok) {
        throw new Error(payload?.error ?? "Source discovery failed");
      }

      return ingestResearchSources({
        gaps,
        sources: payload.sources ?? [],
        uncovered: payload.uncovered,
        onProgress: input.onProgress,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-queue"] });
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-metrics"] });
    },
  });
}

export function useAdminInterpretKnowledgeWorkbook() {
  return useMutation({
    mutationFn: async (manifest: WorkbookManifest) => {
      const { data, error } = await supabase.functions.invoke("ai-doc-analyse", {
        body: {
          org_id: PLATFORM_AI_ORG_ID,
          file_name: "workbook-manifest.json",
          workbook_manifest: manifest,
        },
      });
      if (error) throw error;
      const payload = data as WorkbookInterpretationResult & {
        ok?: boolean;
        skipped?: boolean;
        error?: string;
      };
      if (payload.skipped || payload.error === "ai_allowance_exhausted") {
        throw new Error(payload.error ?? "Workbook interpretation skipped");
      }
      return payload;
    },
  });
}

export function useAdminImportKnowledgeProposals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: importPlatformKnowledgeProposals,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-queue"] });
      void qc.invalidateQueries({ queryKey: ["admin-knowledge-metrics"] });
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
        claims?: Array<Record<string, unknown>>;
      };
    },
  });
}

export function useAdminCreateContentTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      knowledgeId: string;
      title?: string;
      allowDuplicate?: boolean;
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_create_content_topic", {
        p_knowledge_id: input.knowledgeId,
        p_title: input.title ?? null,
        p_allow_duplicate: input.allowDuplicate ?? false,
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
      workflowStatus?: string;
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
        p_workflow_status: input.workflowStatus ?? null,
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

async function invokeContentGenerate(body: {
  topicId: string;
  stage: "seo" | "brief" | "output" | "visual_concept" | "visual_final";
  outputKinds?: ContentOutputKind[];
  regenerate?: boolean;
  /** Same ai_batch_jobs pipeline as Knowledge. Refused until the content processor is enabled. */
  delivery?: "interactive" | "batch";
}) {
  if (body.delivery === "batch") {
    const { contentStageToBatchCapability, isAiBatchCapabilityEnabled } = await import(
      "@/lib/ai/aiBatch"
    );
    const capability = contentStageToBatchCapability(body.stage);
    if (!capability || !isAiBatchCapabilityEnabled(capability)) {
      throw new Error(
        "Overnight batch for Content is reserved on the same job table; the processor is not enabled yet."
      );
    }
  }

  const generatingStatus: Record<typeof body.stage, string> = {
    seo: "generating_seo",
    brief: "generating_brief",
    output: "generating_outputs",
    visual_concept: "visual_concept_review",
    visual_final: "generating_final_assets",
  };

  const nextStatus = generatingStatus[body.stage];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: statusErr } = await (supabase as any).rpc("admin_set_content_topic_workflow_status", {
    p_topic_id: body.topicId,
    p_workflow_status: nextStatus,
    p_generation_error: null,
  });
  if (statusErr) {
    const msg = statusErr.message ?? "Could not start generation";
    throw new Error(
      /could not find the function/i.test(msg)
        ? "Content workflow migration not applied. Run npm run db:push."
        : msg
    );
  }

  let data: unknown;
  let error: unknown;
  let response: Response | undefined;
  try {
    ({ data, error, response } = await supabase.functions.invoke("content-generate", {
      body: {
        topic_id: body.topicId,
        stage: body.stage,
        output_kinds: body.outputKinds,
        regenerate: body.regenerate ?? false,
      },
    }));
  } catch (fetchErr) {
    const info = await parseEdgeFunctionError(fetchErr, data, "content-generate");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).rpc("admin_set_content_topic_workflow_status", {
      p_topic_id: body.topicId,
      p_workflow_status: "generation_failed",
      p_generation_error: info.message.slice(0, 500),
    });
    throw new Error(formatEdgeFunctionToast(info));
  }

  if (error) {
    const info = await parseEdgeFunctionError(error, data, "content-generate");
    if (!info.status && response) info.status = response.status;
    throw new Error(formatEdgeFunctionToast(info));
  }

  const payload = data as { ok?: boolean; code?: string; message?: string; request_id?: string };
  if (payload?.ok === false) {
    throw new Error(
      formatEdgeFunctionToast({
        message: payload.message ?? "Content generation failed",
        code: payload.code,
        requestId: payload.request_id,
      })
    );
  }

  return data;
}

export function useAdminGenerateContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: invokeContentGenerate,
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["admin-content-topic", vars.topicId] });
      void qc.invalidateQueries({ queryKey: ["admin-content-topics"] });
    },
  });
}

export function useAdminApproveContentTopicSeo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { topicId: string; seo?: Record<string, unknown> }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_approve_content_topic_seo", {
        p_topic_id: input.topicId,
        p_seo: input.seo ?? null,
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

export function useAdminRejectContentTopicSeo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { topicId: string; reason?: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_reject_content_topic_seo", {
        p_topic_id: input.topicId,
        p_reason: input.reason ?? null,
      });
      if (error) throw error;
      return data as ContentTopicRow;
    },
    onSuccess: (_row, vars) => {
      void qc.invalidateQueries({ queryKey: ["admin-content-topic", vars.topicId] });
    },
  });
}

export function useAdminApproveContentTopicBrief() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { topicId: string; brief?: Record<string, unknown> }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_approve_content_topic_brief", {
        p_topic_id: input.topicId,
        p_brief: input.brief ?? null,
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

export function useAdminRejectContentTopicBrief() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { topicId: string; reason?: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_reject_content_topic_brief", {
        p_topic_id: input.topicId,
        p_reason: input.reason ?? null,
      });
      if (error) throw error;
      return data as ContentTopicRow;
    },
    onSuccess: (_row, vars) => {
      void qc.invalidateQueries({ queryKey: ["admin-content-topic", vars.topicId] });
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
