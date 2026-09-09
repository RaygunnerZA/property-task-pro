/**
 * ai-batch-submit — enqueue a Gemini Batch job (half-price, up to 24h).
 * Platform admin only. Never verifies or publishes Knowledge.
 * Content capabilities are in the union but return 501 until the processor is wired.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  AI_BATCH_OPEN_STATUSES,
  isAiBatchCapabilityEnabled,
  itemIdsJson,
  parseAiBatchSubmitBody,
} from "../_shared/aiBatch.ts";
import { SchemaError } from "../_shared/aiRouting.ts";
import { createGeminiInlineBatch } from "../_shared/geminiBatch.ts";
import {
  GEMINI_FLASH_MODEL,
  knowledgeGeminiApiKey,
} from "../_shared/geminiKeys.ts";
import {
  buildGapResearchUserPrompt,
  GAP_RESEARCH_PROMPT_VERSION,
  GAP_RESEARCH_SYSTEM,
} from "../_shared/knowledgeGapResearch.ts";
import {
  buildGuidanceUserPayload,
  GUIDANCE_PROMPT_VERSION,
  guidanceSystemForMode,
} from "../_shared/knowledgeGuidanceDraft.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
};

const PLATFORM_ORG = "00000000-0000-0000-0000-000000000000";
const MAX_BODY_BYTES = 262_144;

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
  console.error("[ai-batch-submit]", {
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

function incomingKeys(parsed: ReturnType<typeof parseAiBatchSubmitBody>): string[] {
  if (parsed.capability === "knowledge_guidance_draft") {
    return parsed.items.map((i) => i.knowledge_id);
  }
  if (parsed.capability === "knowledge_gap_research") {
    return parsed.items.map((i) => i.id);
  }
  return parsed.items.map((i) => i.topic_id);
}

function storedItemKeys(itemIds: unknown): string[] {
  if (!Array.isArray(itemIds)) return [];
  const keys: string[] = [];
  for (const item of itemIds) {
    if (typeof item === "string") {
      keys.push(item);
      continue;
    }
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const rec = item as Record<string, unknown>;
      if (typeof rec.knowledge_id === "string") keys.push(rec.knowledge_id);
      else if (typeof rec.id === "string") keys.push(rec.id);
      else if (typeof rec.topic_id === "string") keys.push(rec.topic_id);
    }
  }
  return keys;
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
    return jsonErr(500, "server_misconfigured", "Batch service is misconfigured.", requestId);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonErr(401, "unauthorized", "Sign in again to queue a batch job.", requestId);
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return jsonErr(401, "unauthorized", "Sign in again to queue a batch job.", requestId);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) {
    return jsonErr(401, "unauthorized", "Sign in again to queue a batch job.", requestId, {
      auth_error: userErr?.message ?? "no_user",
    });
  }
  const userId = userData.user.id;

  const { data: adminRow, error: adminErr } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (adminErr) {
    return jsonErr(500, "admin_check_failed", "Could not verify admin permission.", requestId, {
      db_error: adminErr.message,
    });
  }
  if (!adminRow) {
    return jsonErr(
      403,
      "not_platform_admin",
      "Only platform admins can queue overnight AI jobs.",
      requestId
    );
  }

  const rawText = await req.text();
  if (rawText.length > MAX_BODY_BYTES) {
    return jsonErr(413, "payload_too_large", "Batch request is too large.", requestId);
  }
  let body: unknown;
  try {
    body = JSON.parse(rawText);
  } catch {
    return jsonErr(400, "invalid_json", "Request body must be JSON.", requestId);
  }

  let parsed: ReturnType<typeof parseAiBatchSubmitBody>;
  try {
    parsed = parseAiBatchSubmitBody(body);
  } catch (e) {
    const code = e instanceof SchemaError ? e.message : "invalid_body";
    return jsonErr(400, code, "Batch request was not valid.", requestId);
  }

  if (!isAiBatchCapabilityEnabled(parsed.capability)) {
    return jsonErr(
      501,
      "capability_not_enabled",
      "Overnight batch for this Content stage is not wired yet. Use interactive generate, or wait for the content batch processor.",
      requestId,
      { capability: parsed.capability }
    );
  }

  const geminiKey = knowledgeGeminiApiKey();
  if (!geminiKey) {
    return jsonErr(
      500,
      "ai_provider_not_configured",
      "Overnight batch needs Gemini. Interactive generate still works if OpenAI is configured.",
      requestId
    );
  }

  const keys = incomingKeys(parsed);
  const { data: openJobs, error: openErr } = await admin
    .from("ai_batch_jobs")
    .select("id, item_ids")
    .eq("capability", parsed.capability)
    .eq("mode", parsed.mode)
    .in("status", [...AI_BATCH_OPEN_STATUSES]);
  if (openErr) {
    return jsonErr(500, "job_lookup_failed", "Could not check existing batch jobs.", requestId, {
      db_error: openErr.message,
    });
  }
  const incomingSet = new Set(keys);
  const overlapping = (openJobs ?? []).some((job) =>
    storedItemKeys(job.item_ids).some((id) => incomingSet.has(id))
  );
  if (overlapping) {
    return jsonErr(
      409,
      "job_already_open",
      "An overnight job already covers some of these items. Wait for it to finish or check the job banner.",
      requestId
    );
  }

  type GeminiReq = { key: string; system: string; user: string; temperature?: number };
  const geminiRequests: GeminiReq[] = [];
  let itemIds: unknown[] = itemIdsJson(parsed);
  let itemCount = parsed.items.length;
  let promptVersion = GUIDANCE_PROMPT_VERSION;

  if (parsed.capability === "knowledge_guidance_draft") {
    const ids = parsed.items.map((i) => i.knowledge_id);
    const { data: rows, error: loadErr } = await admin
      .from("knowledge")
      .select("id, title, summary, body, attributes, applicability, status, scope, org_id")
      .in("id", ids);
    if (loadErr) {
      return jsonErr(500, "knowledge_load_failed", "Could not load Knowledge.", requestId, {
        db_error: loadErr.message,
      });
    }
    const byId = new Map((rows ?? []).map((r) => [r.id as string, r]));
    const eligible: string[] = [];
    for (const id of ids) {
      const row = byId.get(id);
      if (!row || row.status !== "candidate") continue;
      eligible.push(id);
    }
    if (eligible.length === 0) {
      return jsonErr(
        409,
        "no_eligible_items",
        "None of the selected records are candidates that can receive draft guidance.",
        requestId
      );
    }

    const { data: sourceRows } = await admin
      .from("knowledge_sources")
      .select("knowledge_id, label, url, source_type")
      .in("knowledge_id", eligible);
    const sourcesById = new Map<string, Array<{ label?: string | null; url?: string | null; source_type?: string | null }>>();
    for (const s of sourceRows ?? []) {
      const list = sourcesById.get(s.knowledge_id as string) ?? [];
      if (typeof s.url === "string" && /^https?:\/\//i.test(s.url)) list.push(s);
      sourcesById.set(s.knowledge_id as string, list);
    }

    const system = guidanceSystemForMode(parsed.mode);
    for (const id of eligible) {
      const row = byId.get(id)!;
      geminiRequests.push({
        key: id,
        system,
        user: buildGuidanceUserPayload({
          mode: parsed.mode,
          title: row.title,
          summary: row.summary,
          body: row.body,
          attributes: (row.attributes as Record<string, unknown>) ?? {},
          applicability: row.applicability,
          linkedSources: sourcesById.get(id) ?? [],
        }),
      });
    }
    itemIds = eligible;
    itemCount = eligible.length;
    promptVersion = GUIDANCE_PROMPT_VERSION;
  } else if (parsed.capability === "knowledge_gap_research") {
    promptVersion = GAP_RESEARCH_PROMPT_VERSION;
    geminiRequests.push({
      key: "discovery",
      system: GAP_RESEARCH_SYSTEM,
      user: buildGapResearchUserPrompt(parsed.items),
      temperature: 0.1,
    });
  }

  const { data: job, error: insertErr } = await admin
    .from("ai_batch_jobs")
    .insert({
      capability: parsed.capability,
      mode: parsed.mode,
      status: "queued",
      created_by: userId,
      org_id: PLATFORM_ORG,
      provider: "GEMINI",
      model_used: GEMINI_FLASH_MODEL,
      prompt_version: promptVersion,
      item_ids: itemIds,
      item_count: itemCount,
      metadata: { request_id: requestId, delivery: "batch" },
    })
    .select("*")
    .single();

  if (insertErr || !job) {
    return jsonErr(500, "job_create_failed", "Could not create the batch job.", requestId, {
      db_error: insertErr?.message,
    });
  }

  try {
    const created = await createGeminiInlineBatch({
      apiKey: geminiKey,
      displayName: `${parsed.capability}-${parsed.mode}-${job.id.slice(0, 8)}`,
      requests: geminiRequests,
    });
    const { error: updErr } = await admin
      .from("ai_batch_jobs")
      .update({
        status: "submitted",
        provider_batch_id: created.name,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          ...(typeof job.metadata === "object" && job.metadata ? job.metadata : {}),
          request_id: requestId,
          delivery: "batch",
        },
      })
      .eq("id", job.id);
    if (updErr) {
      return jsonErr(
        500,
        "job_update_failed",
        "The provider accepted the batch but Filla could not store the job id. Check jobs before retrying.",
        requestId,
        { job_id: job.id, db_error: updErr.message, provider_batch_id: created.name }
      );
    }
    return jsonOk({
      ok: true,
      job_id: job.id,
      status: "submitted",
      item_count: itemCount,
      provider_batch_id: created.name,
      request_id: requestId,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "gemini_batch_create_failed";
    await admin
      .from("ai_batch_jobs")
      .update({
        status: "failed",
        error_message: message.slice(0, 500),
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    return jsonErr(
      502,
      "ai_provider_failed",
      "Gemini rejected the overnight batch. Try again later, or use interactive generate.",
      requestId,
      { job_id: job.id, provider_error: message }
    );
  }
});
