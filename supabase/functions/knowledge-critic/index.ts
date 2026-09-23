/**
 * knowledge-critic — second-model verification for Knowledge candidates.
 * Must use a different provider/model than the extractor that drafted the row.
 * Never auto-publishes or auto-verifies. Logs to ai_requests.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { geminiUsage, openAiUsage } from "../_shared/aiObservability.ts";
import { runCapability, type ExecutorOutput } from "../_shared/aiCall.ts";
import {
  knowledgeGeminiApiKey,
  geminiGenerateContentUrl,
  GEMINI_FLASH_MODEL,
} from "../_shared/geminiKeys.ts";
import { SchemaError, parseJsonLoose } from "../_shared/aiRouting.ts";
import { buildKnowledgeRepairPatch } from "../_shared/knowledgeFieldInference.ts";

interface ClaimReview {
  claim_text: string;
  status: "supported" | "partially_supported" | "unsupported" | "overstated";
  supporting_passage: string;
  legal_strength?: "must" | "should" | "exception" | "explanatory";
  modal_strength_ok?: boolean;
  applicability_ok?: boolean;
  timing_ok?: boolean;
  exceptions_ok?: boolean;
  notes?: string;
}

interface CriticVerdict {
  trust_score: number;
  notes: string;
  verified: boolean;
  claims_checked?: string;
  source_alignment?: string;
  applicability_concerns?: string;
  contradictions?: string;
  required_corrections?: string;
  claim_reviews?: ClaimReview[];
}

const CLAIM_SUPPORT = new Set([
  "supported",
  "partially_supported",
  "unsupported",
  "overstated",
]);

function parseClaimReviews(raw: unknown): ClaimReview[] {
  if (!Array.isArray(raw)) return [];
  const out: ClaimReview[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const text = typeof rec.claim_text === "string" ? rec.claim_text.trim() : "";
    const status = typeof rec.status === "string" ? rec.status.trim().toLowerCase() : "";
    if (!text || !CLAIM_SUPPORT.has(status)) continue;
    const strength =
      rec.legal_strength === "must" ||
      rec.legal_strength === "should" ||
      rec.legal_strength === "exception" ||
      rec.legal_strength === "explanatory"
        ? rec.legal_strength
        : undefined;
    out.push({
      claim_text: text.slice(0, 500),
      status: status as ClaimReview["status"],
      supporting_passage:
        typeof rec.supporting_passage === "string" ? rec.supporting_passage.slice(0, 600) : "",
      legal_strength: strength,
      modal_strength_ok: rec.modal_strength_ok !== false,
      applicability_ok: rec.applicability_ok !== false,
      timing_ok: rec.timing_ok !== false,
      exceptions_ok: rec.exceptions_ok !== false,
      notes: typeof rec.notes === "string" ? rec.notes.slice(0, 400) : undefined,
    });
    if (out.length >= 80) break;
  }
  return out;
}

function validateVerdict(raw: unknown): CriticVerdict {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new SchemaError("Critic response was not a JSON object");
  }
  const parsed = raw as Record<string, unknown>;
  const score = Number(parsed.trust_score ?? 0.4);
  return {
    trust_score: Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : 0.4,
    notes: String(parsed.notes ?? ""),
    verified: Boolean(parsed.verified),
    claims_checked:
      typeof parsed.claims_checked === "string" ? parsed.claims_checked : undefined,
    source_alignment:
      typeof parsed.source_alignment === "string" ? parsed.source_alignment : undefined,
    applicability_concerns:
      typeof parsed.applicability_concerns === "string"
        ? parsed.applicability_concerns
        : undefined,
    contradictions:
      typeof parsed.contradictions === "string" ? parsed.contradictions : undefined,
    required_corrections:
      typeof parsed.required_corrections === "string"
        ? parsed.required_corrections
        : undefined,
    claim_reviews: parseClaimReviews(parsed.claim_reviews),
  };
}

function scrubCriticField(value: string | undefined): string | null {
  if (value == null) return null;
  const t = value.trim();
  if (!t || /^(none\.?|n\/?a\.?|-|—|–)$/i.test(t)) return null;
  return t;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VERIFIED_TRUST_FLOOR = 0.7;

const CRITIC_SYSTEM =
  "You are a strict knowledge critic for a property-operations platform. " +
  "Evaluate EACH structured claim against linked official sources. " +
  "Do not praise writing quality, completeness, or provenance metadata. " +
  "Do not treat spreadsheet filenames as evidence. " +
  "Do not invent missing facts. Unknown claims mean the source did not establish them — that is correct, not a failure by itself. " +
  "Never summarise as 'all claims align' — each claim needs an exact supporting passage and a status: supported, partially_supported, unsupported, or overstated. " +
  "Test modal strength (must vs should vs exception vs explanatory), applicability, timing, and exceptions. " +
  "A recommendation (should) presented as a legal obligation (must) is overstated. " +
  "For empty findings use an empty string — never the word None. " +
  "If there are no contradictions, set contradictions to exactly: No contradictions found. " +
  "Return JSON only: " +
  '{"trust_score":0-1,"verified":boolean,"notes":"one-line summary",' +
  '"claims_checked":"string","source_alignment":"string",' +
  '"applicability_concerns":"string","contradictions":"string",' +
  '"required_corrections":"string",' +
  '"claim_reviews":[{"claim_text":"exact","status":"supported|partially_supported|unsupported|overstated","supporting_passage":"quote","legal_strength":"must|should|exception|explanatory","modal_strength_ok":true,"applicability_ok":true,"timing_ok":true,"exceptions_ok":true,"notes":""}]}. ' +
  "verified=true only if trust_score >= 0.7 AND established claims are supported by linked sources " +
  "AND no material contradictions AND no claim is overstated or unsupported. If sources are missing or guidance is empty/circular, verified must be false.";

interface CriticInput {
  knowledge_id: string;
  org_id?: string | null;
  extractor_provider?: string | null;
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function criticPayload(
  title: string,
  summary: string | null,
  body: string | null,
  attributes: Record<string, unknown>,
  applicability: unknown,
  sources: unknown[],
  claims: unknown[]
) {
  return JSON.stringify({
    title,
    summary,
    body,
    attributes,
    applicability,
    claims,
    linked_sources: sources,
  });
}

async function callOpenAICritic(
  apiKey: string,
  payload: string
): Promise<ExecutorOutput> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: CRITIC_SYSTEM },
        { role: "user", content: payload },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI critic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { raw: parseJsonLoose(data?.choices?.[0]?.message?.content), usage: openAiUsage(data) };
}

async function callGeminiCritic(apiKey: string, payload: string): Promise<ExecutorOutput> {
  const url = geminiGenerateContentUrl(GEMINI_FLASH_MODEL, apiKey);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${CRITIC_SYSTEM}\n\n${payload}` }] }],
      generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) throw new Error(`Gemini critic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return { raw: parseJsonLoose(text), usage: geminiUsage(data) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, 405);
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!serviceKey || !supabaseUrl || !anonKey) {
    return jsonResponse({ ok: false, error: "Server misconfigured" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }
  const { data: isAdmin, error: adminErr } = await userClient.rpc("is_platform_admin");
  if (adminErr || !isAdmin) {
    return jsonResponse({ ok: false, error: "not_platform_admin" }, 403);
  }

  let body: CriticInput;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }

  const { knowledge_id, extractor_provider } = body;
  if (!knowledge_id) {
    return jsonResponse({ ok: false, error: "knowledge_id required" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: row, error: loadErr } = await admin
    .from("knowledge")
    .select("*")
    .eq("id", knowledge_id)
    .maybeSingle();

  if (loadErr || !row) {
    return jsonResponse({ ok: false, error: loadErr?.message ?? "knowledge_not_found" }, 404);
  }

  const extractorProvider =
    extractor_provider ??
    ((row.provenance as Record<string, unknown> | null)?.extractor_provider as
      | string
      | undefined) ??
    null;

  const { data: sourceRows } = await admin
    .from("knowledge_sources")
    .select("label, url, source_type, metadata")
    .eq("knowledge_id", knowledge_id);

  const linkedSources = (sourceRows ?? [])
    .filter((s) => typeof s.url === "string" && /^https?:\/\//i.test(s.url))
    .map((s) => ({
      label: s.label,
      url: s.url,
      source_type: s.source_type,
    }));

  const { data: claimRows } = await admin
    .from("knowledge_claims")
    .select("id, claim_text, category, verification_status, source_location, applicability")
    .eq("knowledge_id", knowledge_id)
    .order("sort_order", { ascending: true });

  const claims = (claimRows ?? []).map((c) => ({
    id: c.id,
    text: c.claim_text,
    category: c.category,
    verification_status: c.verification_status,
    source_location: c.source_location,
  }));

  const logOrg = row.org_id ?? "00000000-0000-0000-0000-000000000000";
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const geminiKey = knowledgeGeminiApiKey();
  const attributes = (row.attributes as Record<string, unknown>) ?? {};
  const payload = criticPayload(
    row.title,
    row.summary,
    row.body,
    attributes,
    row.applicability,
    linkedSources,
    claims
  );

  // Platform Knowledge critic is admin ops — do not burn org AI packs / sentinel quota.
  const isPlatformKnowledge = row.scope === "platform" || row.org_id == null;

  const run = await runCapability<CriticVerdict>(admin, {
    capability: "knowledge_critique",
    orgId: logOrg,
    mustDifferFrom: extractorProvider,
    entity: { type: "knowledge", id: knowledge_id },
    metadata: { extractor_provider: extractorProvider },
    allowFallback: true,
    skipGate: isPlatformKnowledge,
    executors: {
      "model:gpt-4o-mini": () => {
        if (!openaiKey) throw new Error("OPENAI_API_KEY not set");
        return callOpenAICritic(openaiKey, payload);
      },
      "model:gemini-2.0-flash": () => {
        if (!geminiKey) throw new Error("Gemini API key not set");
        return callGeminiCritic(geminiKey, payload);
      },
    },
    validate: validateVerdict,
  });

  const provider = run.strategy?.provider ?? null;
  const model = run.strategy?.model ?? null;

  if (!run.ok || !run.value) {
    console.warn("[knowledge-critic] no verdict:", run.error);
    const { data: updated, error: applyErr } = await admin.rpc("apply_knowledge_critic_result", {
      p_knowledge_id: knowledge_id,
      p_trust_score: 0.4,
      p_critic_notes: `Critic unavailable; ${run.error ?? "no eligible strategy"}`,
      p_critic_model: model,
      p_critic_provider: provider,
      p_mark_verified: false,
      p_critic_passed: false,
      p_critic_result: {
        verified: false,
        claims_checked: null,
        required_corrections: "Run the critic before verification.",
      },
    });
    if (applyErr) {
      return jsonResponse({ ok: false, error: applyErr.message }, 500);
    }
    await admin.rpc("apply_knowledge_claim_critic", {
      p_knowledge_id: knowledge_id,
      p_critic_result: {
        verified: false,
        claims_checked: null,
        required_corrections: "Run the critic before verification.",
      },
      p_passed: false,
    });
    return jsonResponse({
      ok: false,
      knowledge: updated,
      trust_score: 0.4,
      verified: false,
      critic_passed: false,
      error: run.error ?? "critic_unavailable",
      provider,
      model,
    });
  }

  const verdict = run.value;
  const reviews = verdict.claim_reviews ?? [];
  const materialFail = reviews.some(
    (r) => r.status === "overstated" || r.status === "unsupported"
  );
  const trust = verdict.trust_score;
  const criticPassed =
    Boolean(verdict.verified) &&
    trust >= VERIFIED_TRUST_FLOOR &&
    linkedSources.length > 0 &&
    !materialFail;
  const notes =
    verdict.notes ||
    (criticPassed
      ? "Passed structured critic checks."
      : materialFail
        ? "One or more claims are overstated or unsupported."
        : "Critic did not pass.");

  const criticResult = {
    verified: criticPassed,
    claims_checked: scrubCriticField(verdict.claims_checked),
    source_alignment: scrubCriticField(verdict.source_alignment),
    applicability_concerns: scrubCriticField(verdict.applicability_concerns),
    contradictions:
      scrubCriticField(verdict.contradictions) ||
      (criticPassed ? "No contradictions found." : null),
    required_corrections: scrubCriticField(verdict.required_corrections),
    claim_reviews: reviews,
  };

  const { data: updated, error: applyErr } = await admin.rpc("apply_knowledge_critic_result", {
    p_knowledge_id: knowledge_id,
    p_trust_score: trust,
    p_critic_notes: notes,
    p_critic_model: model,
    p_critic_provider: provider,
    p_mark_verified: false,
    p_critic_passed: criticPassed,
    p_critic_result: criticResult,
  });

  if (applyErr) {
    return jsonResponse({ ok: false, error: applyErr.message }, 500);
  }

  const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
  if (reviews.length > 0 && claimRows) {
    for (const claim of claimRows) {
      const text = String(claim.claim_text ?? "");
      const review =
        reviews.find((r) => normalize(r.claim_text) === normalize(text)) ||
        reviews.find((r) => normalize(text).includes(normalize(r.claim_text).slice(0, 80)));
      if (!review) continue;
      const nextStatus =
        claim.verification_status === "unknown" ||
        claim.verification_status === "rejected" ||
        claim.verification_status === "verified"
          ? claim.verification_status
          : review.status === "supported"
            ? claim.verification_status
            : "unresolved";
      await admin
        .from("knowledge_claims")
        .update({
          critic_result: {
            support_status: review.status,
            supporting_passage: review.supporting_passage,
            legal_strength: review.legal_strength ?? null,
            modal_strength_ok: review.modal_strength_ok !== false,
            applicability_ok: review.applicability_ok !== false,
            timing_ok: review.timing_ok !== false,
            exceptions_ok: review.exceptions_ok !== false,
            notes: review.notes ?? null,
          },
          verification_status: nextStatus,
        })
        .eq("id", claim.id);
    }
  } else {
    await admin.rpc("apply_knowledge_claim_critic", {
      p_knowledge_id: knowledge_id,
      p_critic_result: criticResult,
      p_passed: criticPassed,
    });
  }

  const repair = buildKnowledgeRepairPatch({
    title: row.title,
    summary: row.summary,
    attributes: (row.attributes as Record<string, unknown>) ?? {},
    applicability: row.applicability,
    sourceUrl: linkedSources[0]?.url ?? null,
    sourceTitle: linkedSources[0]?.label ?? null,
    claims: (claimRows ?? []).map((c) => ({
      claim_text: c.claim_text,
      category: c.category,
      verification_status: c.verification_status,
      applicability: (c.applicability as Record<string, unknown>) ?? {},
    })),
  });
  if (repair.changed) {
    const patch: Record<string, unknown> = { attributes: repair.attributes };
    if (repair.title && repair.title !== row.title) patch.title = repair.title;
    if (repair.summary && repair.summary !== row.summary) patch.summary = repair.summary;
    const { error: repairErr } = await admin.from("knowledge").update(patch).eq("id", knowledge_id);
    if (repairErr) {
      console.warn("[knowledge-critic] field repair failed", repairErr);
    }
  }

  return jsonResponse({
    ok: true,
    knowledge: updated,
    trust_score: trust,
    verified: false,
    critic_passed: criticPassed,
    critic_result: criticResult,
    provider,
    model,
  });
});
