/**
 * ai-batch-poll — apply Gemini Batch results and advance job status.
 * Callable by a platform admin (UI) or with the service-role bearer (cron).
 * Never verifies or publishes Knowledge.
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { applyBatchUsdDiscount, estimateCost, logAiRequest } from "../_shared/aiObservability.ts";
import { isUuid } from "../_shared/aiBatch.ts";
import {
  extractGeminiInlinedResults,
  getGeminiBatch,
  mapGeminiBatchState,
} from "../_shared/geminiBatch.ts";
import { GEMINI_FLASH_MODEL, knowledgeGeminiApiKey } from "../_shared/geminiKeys.ts";
import { validateDiscoverySources } from "../_shared/knowledgeGapResearch.ts";
import { validateDraft } from "../_shared/knowledgeGuidanceDraft.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
};

const PLATFORM_ORG = "00000000-0000-0000-0000-000000000000";
const MAX_JOBS_PER_POLL = 8;
const MAX_BODY_BYTES = 65_536;

type ErrorBody = { ok: false; code: string; message: string; request_id: string };

function newRequestId(): string {
  return crypto.randomUUID();
}

function jsonOk(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonErr(
  status: number,
  code: string,
  message: string,
  requestId: string,
  logDetail?: Record<string, unknown>
) {
  console.error("[ai-batch-poll]", {
    request_id: requestId,
    code,
    status,
    ...logDetail,
  });
  const body: ErrorBody = { ok: false, code, message, request_id: requestId };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aa = enc.encode(a);
  const bb = enc.encode(b);
  if (aa.length !== bb.length) return false;
  let out = 0;
  for (let i = 0; i < aa.length; i++) out |= aa[i] ^ bb[i];
  return out === 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

type BatchJobRow = {
  id: string;
  capability: string;
  mode: string;
  status: string;
  created_by: string;
  provider_batch_id: string | null;
  item_ids: unknown;
  item_count: number;
  metadata: unknown;
  model_used: string | null;
  prompt_version: string | null;
};

async function applyGuidanceJob(
  admin: SupabaseClient,
  job: BatchJobRow,
  geminiKey: string,
  requestId: string
): Promise<{ status: string; succeeded: number; failed: number }> {
  if (!job.provider_batch_id) {
    throw new Error("missing_provider_batch_id");
  }
  const snapshot = await getGeminiBatch(geminiKey, job.provider_batch_id);
  const mapped = mapGeminiBatchState(snapshot.state);

  if (mapped === "submitted" || mapped === "running") {
    if (job.status !== mapped) {
      await admin
        .from("ai_batch_jobs")
        .update({ status: mapped, updated_at: new Date().toISOString() })
        .eq("id", job.id);
    }
    return { status: mapped, succeeded: 0, failed: 0 };
  }

  if (mapped === "failed" || mapped === "cancelled") {
    await admin
      .from("ai_batch_jobs")
      .update({
        status: mapped,
        error_message: String(snapshot.state).slice(0, 200),
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    return { status: mapped, succeeded: 0, failed: job.item_count };
  }

  const results = extractGeminiInlinedResults(snapshot);
  const expected = Array.isArray(job.item_ids)
    ? job.item_ids.filter((id): id is string => typeof id === "string")
    : [];
  const byKey = new Map(results.map((r) => [r.key, r]));
  let succeeded = 0;
  let failed = 0;
  const failures: Array<{ id: string; error: string }> = [];

  for (const knowledgeId of expected) {
    const hit = byKey.get(knowledgeId);
    if (!hit || hit.error) {
      failed += 1;
      failures.push({ id: knowledgeId, error: hit?.error ?? "missing_result" });
      continue;
    }
    let draft;
    try {
      draft = validateDraft(hit.raw);
    } catch (e) {
      failed += 1;
      failures.push({
        id: knowledgeId,
        error: e instanceof Error ? e.message : "invalid_draft",
      });
      logAiRequest(admin, {
        org_id: PLATFORM_ORG,
        user_id: job.created_by,
        function_name: "ai-batch-poll",
        model_used: job.model_used ?? GEMINI_FLASH_MODEL,
        provider: "GEMINI",
        prompt_version: job.prompt_version,
        input_tokens: hit.usage.input_tokens,
        output_tokens: hit.usage.output_tokens,
        cost_usd: applyBatchUsdDiscount(
          estimateCost(job.model_used ?? GEMINI_FLASH_MODEL, hit.usage.input_tokens, hit.usage.output_tokens)
        ),
        cost_units: 1,
        status: "error",
        error_message: e instanceof Error ? e.message : "invalid_draft",
        entity_type: "knowledge",
        entity_id: knowledgeId,
        metadata: {
          capability: "knowledge_guidance_draft",
          batch: true,
          batch_job_id: job.id,
          request_id: requestId,
        },
      });
      continue;
    }

    const { error: applyErr } = await admin.rpc("apply_ai_batch_guidance_result", {
      p_job_id: job.id,
      p_knowledge_id: knowledgeId,
      p_summary: draft.summary,
      p_draft_meta: {
        source: "ai",
        mode: job.mode,
        proposed_at: new Date().toISOString(),
        model: job.model_used,
        provider: "GEMINI",
        unverified: true,
        delivery: "batch",
        batch_job_id: job.id,
        label: "AI-proposed draft",
      },
    });

    if (applyErr) {
      failed += 1;
      failures.push({ id: knowledgeId, error: applyErr.message });
      logAiRequest(admin, {
        org_id: PLATFORM_ORG,
        user_id: job.created_by,
        function_name: "ai-batch-poll",
        model_used: job.model_used ?? GEMINI_FLASH_MODEL,
        provider: "GEMINI",
        prompt_version: job.prompt_version,
        input_tokens: hit.usage.input_tokens,
        output_tokens: hit.usage.output_tokens,
        cost_usd: applyBatchUsdDiscount(
          estimateCost(job.model_used ?? GEMINI_FLASH_MODEL, hit.usage.input_tokens, hit.usage.output_tokens)
        ),
        cost_units: 1,
        status: "error",
        error_message: applyErr.message,
        entity_type: "knowledge",
        entity_id: knowledgeId,
        metadata: {
          capability: "knowledge_guidance_draft",
          batch: true,
          batch_job_id: job.id,
          request_id: requestId,
        },
      });
      continue;
    }

    succeeded += 1;
    logAiRequest(admin, {
      org_id: PLATFORM_ORG,
      user_id: job.created_by,
      function_name: "ai-batch-poll",
      model_used: job.model_used ?? GEMINI_FLASH_MODEL,
      provider: "GEMINI",
      prompt_version: job.prompt_version,
      input_tokens: hit.usage.input_tokens,
      output_tokens: hit.usage.output_tokens,
      cost_usd: applyBatchUsdDiscount(
        estimateCost(job.model_used ?? GEMINI_FLASH_MODEL, hit.usage.input_tokens, hit.usage.output_tokens)
      ),
      cost_units: 1,
      status: "success",
      entity_type: "knowledge",
      entity_id: knowledgeId,
      metadata: {
        capability: "knowledge_guidance_draft",
        batch: true,
        batch_job_id: job.id,
        request_id: requestId,
      },
    });
  }

  const terminal = failed === expected.length && succeeded === 0 ? "failed" : "succeeded";
  await admin
    .from("ai_batch_jobs")
    .update({
      status: terminal,
      succeeded_count: succeeded,
      failed_count: failed,
      error_message:
        failures.length > 0 ? failures.slice(0, 8).map((f) => `${f.id}:${f.error}`).join("; ").slice(0, 500) : null,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: {
        ...asRecord(job.metadata),
        gemini_state: snapshot.state,
        apply_failures: failures.slice(0, 20),
      },
    })
    .eq("id", job.id);

  return { status: terminal, succeeded, failed };
}

async function applyResearchDiscoveryJob(
  admin: SupabaseClient,
  job: BatchJobRow,
  geminiKey: string,
  requestId: string
): Promise<{ status: string; succeeded: number; failed: number }> {
  if (!job.provider_batch_id) throw new Error("missing_provider_batch_id");
  const snapshot = await getGeminiBatch(geminiKey, job.provider_batch_id);
  const mapped = mapGeminiBatchState(snapshot.state);

  if (mapped === "submitted" || mapped === "running") {
    if (job.status !== mapped) {
      await admin
        .from("ai_batch_jobs")
        .update({ status: mapped, updated_at: new Date().toISOString() })
        .eq("id", job.id);
    }
    return { status: mapped, succeeded: 0, failed: 0 };
  }

  if (mapped === "failed" || mapped === "cancelled") {
    await admin
      .from("ai_batch_jobs")
      .update({
        status: mapped,
        error_message: String(snapshot.state).slice(0, 200),
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    return { status: mapped, succeeded: 0, failed: 1 };
  }

  const results = extractGeminiInlinedResults(snapshot);
  const discovery = results.find((r) => r.key === "discovery") ?? results[0];
  const allowedIds = new Set(
    (Array.isArray(job.item_ids) ? job.item_ids : [])
      .map((item) =>
        item && typeof item === "object" && !Array.isArray(item)
          ? String((item as { id?: unknown }).id ?? "")
          : ""
      )
      .filter(Boolean)
  );

  let uncovered: string[] = [...allowedIds];
  let sources: unknown[] = [];
  let parseError: string | null = discovery?.error ?? null;
  if (discovery && !discovery.error) {
    try {
      const validated = validateDiscoverySources(discovery.raw, allowedIds);
      sources = validated.sources;
      uncovered = validated.uncovered;
    } catch (e) {
      parseError = e instanceof Error ? e.message : "discovery_invalid";
    }
  }

  logAiRequest(admin, {
    org_id: PLATFORM_ORG,
    user_id: job.created_by,
    function_name: "ai-batch-poll",
    model_used: job.model_used ?? GEMINI_FLASH_MODEL,
    provider: "GEMINI",
    prompt_version: job.prompt_version,
    input_tokens: discovery?.usage.input_tokens ?? null,
    output_tokens: discovery?.usage.output_tokens ?? null,
    cost_usd: applyBatchUsdDiscount(
      estimateCost(
        job.model_used ?? GEMINI_FLASH_MODEL,
        discovery?.usage.input_tokens ?? null,
        discovery?.usage.output_tokens ?? null
      )
    ),
    cost_units: 1,
    status: parseError || sources.length === 0 ? "error" : "success",
    error_message: parseError,
    entity_type: "knowledge_gap_research",
    entity_id: job.id,
    metadata: {
      capability: "knowledge_gap_research",
      batch: true,
      batch_job_id: job.id,
      request_id: requestId,
      source_count: sources.length,
    },
  });

  if (parseError || sources.length === 0) {
    await admin
      .from("ai_batch_jobs")
      .update({
        status: "failed",
        failed_count: 1,
        error_message: (parseError ?? "No official source URL was found").slice(0, 500),
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: { ...asRecord(job.metadata), uncovered },
      })
      .eq("id", job.id);
    return { status: "failed", succeeded: 0, failed: 1 };
  }

  await admin
    .from("ai_batch_jobs")
    .update({
      status: "intake_pending",
      succeeded_count: 0,
      failed_count: 0,
      updated_at: new Date().toISOString(),
      metadata: {
        ...asRecord(job.metadata),
        sources,
        uncovered,
        gemini_state: snapshot.state,
      },
    })
    .eq("id", job.id);

  return { status: "intake_pending", succeeded: sources.length, failed: 0 };
}

Deno.serve(async (req) => {
  const requestId = newRequestId();
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return jsonErr(405, "method_not_allowed", "POST only.", requestId);
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!serviceKey || !supabaseUrl) {
    return jsonErr(500, "server_misconfigured", "Batch poller is misconfigured.", requestId);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonErr(401, "unauthorized", "Sign in again to check overnight jobs.", requestId);
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return jsonErr(401, "unauthorized", "Sign in again to check overnight jobs.", requestId);
  }

  const isCron = timingSafeEqual(token, serviceKey);
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let userId: string | null = null;
  if (!isCron) {
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) {
      return jsonErr(401, "unauthorized", "Sign in again to check overnight jobs.", requestId);
    }
    userId = userData.user.id;
    const { data: adminRow, error: adminErr } = await admin
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (adminErr) {
      return jsonErr(500, "admin_check_failed", "Could not verify admin permission.", requestId);
    }
    if (!adminRow) {
      return jsonErr(
        403,
        "not_platform_admin",
        "Only platform admins can poll overnight AI jobs.",
        requestId
      );
    }
  }

  let body: Record<string, unknown> = {};
  const rawText = await req.text();
  if (rawText.length > MAX_BODY_BYTES) {
    return jsonErr(413, "payload_too_large", "Request is too large.", requestId);
  }
  if (rawText.trim()) {
    try {
      const parsed = JSON.parse(rawText);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      return jsonErr(400, "invalid_json", "Request body must be JSON.", requestId);
    }
  }

  if (body.claim_research_intake && !isCron && userId) {
    const jobId =
      typeof body.claim_research_intake === "string"
        ? body.claim_research_intake
        : asRecord(body.claim_research_intake).job_id;
    if (!isUuid(jobId)) {
      return jsonErr(400, "job_id_required", "A job id is required.", requestId);
    }
    const { data: existing, error: loadErr } = await admin
      .from("ai_batch_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("capability", "knowledge_gap_research")
      .maybeSingle();
    if (loadErr) {
      return jsonErr(500, "claim_failed", "Could not claim the research job.", requestId, {
        db_error: loadErr.message,
      });
    }
    if (!existing) {
      return jsonErr(404, "batch_job_not_found", "Batch job not found.", requestId);
    }
    if (
      existing.status === "running" &&
      asRecord(existing.metadata).intake_claimed_by === userId
    ) {
      return jsonOk({ ok: true, claimed: true, already: true, job: existing, request_id: requestId });
    }
    if (existing.status !== "intake_pending") {
      return jsonErr(
        409,
        "intake_not_claimable",
        "This research job is not waiting for source fetch, or another session claimed it.",
        requestId
      );
    }
    const merged = {
      ...asRecord(existing.metadata),
      intake_claimed_by: userId,
      intake_claimed_at: new Date().toISOString(),
    };
    const { data: claimed, error: claimErr } = await admin
      .from("ai_batch_jobs")
      .update({
        status: "running",
        metadata: merged,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .eq("status", "intake_pending")
      .select("*")
      .maybeSingle();
    if (claimErr) {
      return jsonErr(500, "claim_failed", "Could not claim the research job.", requestId, {
        db_error: claimErr.message,
      });
    }
    if (!claimed) {
      return jsonErr(
        409,
        "intake_not_claimable",
        "This research job is not waiting for source fetch, or another session claimed it.",
        requestId
      );
    }
    return jsonOk({
      ok: true,
      claimed: true,
      job: claimed,
      request_id: requestId,
    });
  }

  if (body.complete_research_intake && !isCron && userId) {
    const payload = asRecord(body.complete_research_intake);
    if (!isUuid(payload.job_id)) {
      return jsonErr(400, "job_id_required", "A job id is required.", requestId);
    }
    const created = Math.max(0, Math.min(200, Number(payload.created_count) || 0));
    const failed = Math.max(0, Math.min(200, Number(payload.failed_count) || 0));
    const knowledgeIds = Array.isArray(payload.knowledge_ids)
      ? payload.knowledge_ids.filter((id): id is string => isUuid(id)).slice(0, 200)
      : [];
    const { data: job, error: loadErr } = await admin
      .from("ai_batch_jobs")
      .select("*")
      .eq("id", payload.job_id)
      .eq("capability", "knowledge_gap_research")
      .maybeSingle();
    if (loadErr || !job) {
      return jsonErr(404, "batch_job_not_found", "Batch job not found.", requestId);
    }
    if (job.status === "succeeded") {
      return jsonOk({ ok: true, already: true, job, request_id: requestId });
    }
    if (job.status !== "running" && job.status !== "intake_pending") {
      return jsonErr(409, "job_not_completable", "This job cannot be completed now.", requestId);
    }
    const terminal = created > 0 ? "succeeded" : "failed";
    const { data: updated, error: updErr } = await admin
      .from("ai_batch_jobs")
      .update({
        status: terminal,
        succeeded_count: created,
        failed_count: failed,
        error_message:
          created > 0
            ? null
            : String(payload.error ?? "Research did not add any Review candidates").slice(0, 500),
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          ...asRecord(job.metadata),
          intake: {
            created_count: created,
            failed_count: failed,
            knowledge_ids: knowledgeIds,
            failed_sources: Array.isArray(payload.failed_sources)
              ? payload.failed_sources.slice(0, 20)
              : [],
            uncovered: Array.isArray(payload.uncovered) ? payload.uncovered.slice(0, 40) : [],
          },
        },
      })
      .eq("id", payload.job_id)
      .select("*")
      .single();
    if (updErr) {
      return jsonErr(500, "complete_failed", "Could not record intake results.", requestId, {
        db_error: updErr.message,
      });
    }
    return jsonOk({ ok: true, job: updated, request_id: requestId });
  }

  const geminiKey = knowledgeGeminiApiKey();
  if (!geminiKey) {
    return jsonErr(
      500,
      "ai_provider_not_configured",
      "Overnight batch needs Gemini.",
      requestId
    );
  }

  const { data: jobs, error: listErr } = await admin
    .from("ai_batch_jobs")
    .select(
      "id, capability, mode, status, created_by, provider_batch_id, item_ids, item_count, metadata, model_used, prompt_version"
    )
    .in("status", ["queued", "submitted", "running"])
    .not("provider_batch_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(MAX_JOBS_PER_POLL);

  if (listErr) {
    return jsonErr(500, "job_lookup_failed", "Could not list overnight jobs.", requestId, {
      db_error: listErr.message,
    });
  }

  const processed: Array<{
    job_id: string;
    capability: string;
    status: string;
    succeeded?: number;
    failed?: number;
    error?: string;
  }> = [];

  for (const job of (jobs ?? []) as BatchJobRow[]) {
    // Intake-claimed research jobs are status=running without waiting on Gemini.
    if (
      job.capability === "knowledge_gap_research" &&
      job.status === "running" &&
      asRecord(job.metadata).intake_claimed_by
    ) {
      continue;
    }
    try {
      if (job.capability === "knowledge_guidance_draft") {
        const result = await applyGuidanceJob(admin, job, geminiKey, requestId);
        processed.push({ job_id: job.id, capability: job.capability, ...result });
      } else if (job.capability === "knowledge_gap_research") {
        const result = await applyResearchDiscoveryJob(admin, job, geminiKey, requestId);
        processed.push({ job_id: job.id, capability: job.capability, ...result });
      } else {
        await admin
          .from("ai_batch_jobs")
          .update({
            status: "failed",
            error_message: "capability_not_enabled",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
        processed.push({
          job_id: job.id,
          capability: job.capability,
          status: "failed",
          error: "capability_not_enabled",
        });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "poll_failed";
      processed.push({
        job_id: job.id,
        capability: job.capability,
        status: job.status,
        error: message,
      });
    }
  }

  return jsonOk({
    ok: true,
    processed,
    count: processed.length,
    request_id: requestId,
  });
});
