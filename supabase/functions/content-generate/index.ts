/**
 * content-generate — SEO, editorial brief, outputs, and visual concept for Content Tree.
 * Uses verified Knowledge + linked authoritative sources. Never publishes.
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

const PROMPT_VERSION = "content-tree-claims-v1";
const PLATFORM_ORG = "00000000-0000-0000-0000-000000000000";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
};

type GenerateStage = "seo" | "brief" | "output" | "visual_concept" | "visual_final";

type RequestBody = {
  topic_id: string;
  stage: GenerateStage;
  output_kinds?: string[];
  regenerate?: boolean;
};

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
  console.error("[content-generate]", { request_id: requestId, code, status, ...logDetail });
  return new Response(
    JSON.stringify({ ok: false, code, message, request_id: requestId }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

function extractSourceText(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null;
  for (const key of [
    "extracted_text",
    "text",
    "snapshot_text",
    "plain_text",
    "body_text",
    "content",
  ]) {
    const val = metadata[key];
    if (typeof val === "string" && val.trim().length > 40) return val.trim().slice(0, 12000);
  }
  return null;
}

function normalizeEnvelope(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { approval_status: "none", stale: false, current: {}, versions: [] };
  }
  const obj = raw as Record<string, unknown>;
  if ("approval_status" in obj || "current" in obj) return obj;
  return {
    approval_status: Object.keys(obj).length > 0 ? "pending" : "none",
    stale: false,
    current: obj,
    approved: null,
    versions: [],
  };
}

function appendVersion(
  envelope: Record<string, unknown>,
  payload: Record<string, unknown>,
  provenance: Record<string, unknown>
): Record<string, unknown> {
  const versions = Array.isArray(envelope.versions) ? [...envelope.versions] : [];
  versions.push({
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    status: "draft",
    provenance,
    payload,
  });
  return {
    ...envelope,
    approval_status: "pending",
    current: payload,
    versions,
    last_error: null,
  };
}

async function callOpenAI(system: string, payload: string): Promise<ExecutorOutput> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: payload },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return { raw: parseJsonLoose(data?.choices?.[0]?.message?.content), usage: openAiUsage(data) };
}

async function callGemini(system: string, payload: string): Promise<ExecutorOutput> {
  const apiKey = knowledgeGeminiApiKey();
  if (!apiKey) throw new Error("Gemini API key not set");
  const url = geminiGenerateContentUrl(GEMINI_FLASH_MODEL, apiKey);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${system}\n\n${payload}` }] }],
      generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return { raw: parseJsonLoose(text), usage: geminiUsage(data) };
}

const SEO_SYSTEM =
  "You are an SEO strategist for UK/EU property compliance content. " +
  "Package the verified Knowledge claims for search. Prefer structured claims over inventing facts. " +
  "The short approved guidance is a headline — claims are the factual basis. " +
  "Do NOT invent legal duties, deadlines, standards, or penalties. " +
  "If a needed detail is absent from established claims, list it in evidence_gaps (a Knowledge gap). " +
  "Include claim_gaps (unknown/unresolved Knowledge claims) in evidence_gaps. " +
  "If source text is missing and no established claims exist, set source_content_unavailable true. " +
  "Return JSON only with keys: primary_search_theme, primary_keyword, secondary_keywords (array), " +
  "search_intent, target_audience, user_problem, jurisdiction, content_angle, source_coverage_summary, " +
  "evidence_gaps (array), research_warnings (array), source_content_unavailable (boolean).";

const BRIEF_SYSTEM =
  "You are an editorial strategist for homeowner property compliance content. " +
  "Use approved SEO, verified Knowledge claims, applicability, guidance, and sources. " +
  "Do NOT invent facts beyond established claims and sources. Missing claim details are Knowledge gaps. " +
  "Return JSON only with keys: " +
  "content_angle, working_title, intended_reader, reader_outcome, proposed_sections (array), " +
  "questions_to_answer (array), legal_factual_distinctions (array), required_source_points (array), " +
  "cautious_claims (array), suggested_cta, recommended_output_types (array), visual_concept_suggestion, " +
  "source_content_unavailable (boolean).";

const OUTPUT_SYSTEM =
  "You write editorial content for a property compliance platform. " +
  "Stay consistent with verified Knowledge claims and authoritative sources. Do not invent legal requirements. " +
  "Return JSON only: {\"title\":\"...\",\"body\":\"markdown or plain text\"}.";

const VISUAL_BRIEF_SYSTEM =
  "You create visual art direction for Filla content using a layered paper-cut illustration style. " +
  "No rendered text in images. Use the approved editorial brief. Return JSON: " +
  "{\"concept_summary\":\"...\",\"subject\":\"...\",\"palette\":\"...\",\"composition_notes\":\"...\", " +
  "\"thumbnail_prompt\":\"image gen prompt, no text\", \"test_square_prompt\":\"image gen prompt, no text\", " +
  "\"master_square_prompt\":\"...\", \"portrait_derivative_prompt\":\"subject upper, quiet lower text-safe area\", " +
  "\"landscape_derivative_prompt\":\"subject right, quiet left text-safe area\"}.";

function buildKnowledgePayload(
  knowledge: Record<string, unknown>,
  sources: Array<Record<string, unknown>>,
  claims: Array<Record<string, unknown>> = [],
  seoApproved?: Record<string, unknown>,
  briefApproved?: Record<string, unknown>
) {
  const attrs = (knowledge.attributes as Record<string, unknown>) ?? {};
  const sourceMaterial = sources.map((s) => {
    const meta = (s.metadata as Record<string, unknown>) ?? {};
    const text = extractSourceText(meta);
    return {
      label: s.label,
      url: s.url,
      source_type: s.source_type,
      text_available: Boolean(text),
      text: text ?? null,
    };
  });
  const anyText = sourceMaterial.some((s) => s.text_available);
  const established = claims
    .filter((c) => {
      const status = String(c.verification_status ?? "");
      return status === "verified" || status === "extracted";
    })
    .map((c) => ({
      text: c.claim_text,
      category: c.category,
      source_location: c.source_location ?? null,
    }));
  const unknown = claims
    .filter((c) => {
      const status = String(c.verification_status ?? "");
      return status === "unknown" || status === "unresolved";
    })
    .map((c) => ({
      text: c.claim_text,
      category: c.category,
    }));
  return {
    knowledge: {
      title: knowledge.title,
      summary: knowledge.summary,
      body: knowledge.body,
      applicability: knowledge.applicability,
      attributes: {
        legal_status: attrs.legal_status ?? attrs.classification ?? null,
        applies_when: attrs.applies_when ?? null,
        action: attrs.action ?? null,
        evidence: attrs.evidence ?? null,
        frequency: attrs.frequency ?? null,
        risk_or_consequence: attrs.risk_or_consequence ?? null,
      },
      version: knowledge.version,
    },
    claims: {
      established,
      unknown_or_unresolved: unknown,
    },
    sources: sourceMaterial,
    source_content_unavailable: !anyText && established.length === 0,
    approved_seo: seoApproved ?? null,
    approved_brief: briefApproved ?? null,
  };
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function asFlag(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true" || value === "1";
  return false;
}

function strategyIdOf(strategy: unknown): string | null {
  if (typeof strategy === "string" && strategy.trim()) return strategy.trim();
  if (strategy && typeof strategy === "object" && !Array.isArray(strategy)) {
    const id = (strategy as { id?: unknown }).id;
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  return null;
}

function validateSeo(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new SchemaError("SEO response was not a JSON object");
  }
  const p = raw as Record<string, unknown>;
  const primary_search_theme = asText(p.primary_search_theme);
  const primary_keyword = asText(p.primary_keyword);
  if (!primary_keyword && !primary_search_theme) {
    throw new SchemaError("SEO proposal missing primary keyword or theme");
  }
  return {
    primary_search_theme,
    primary_keyword,
    secondary_keywords: asList(p.secondary_keywords),
    search_intent: asText(p.search_intent),
    target_audience: asText(p.target_audience),
    user_problem: asText(p.user_problem),
    jurisdiction: asText(p.jurisdiction),
    content_angle: asText(p.content_angle),
    source_coverage_summary: asText(p.source_coverage_summary),
    evidence_gaps: asList(p.evidence_gaps),
    research_warnings: asList(p.research_warnings),
    source_content_unavailable: asFlag(p.source_content_unavailable),
  };
}

function validateBrief(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new SchemaError("Brief response was not a JSON object");
  }
  const p = raw as Record<string, unknown>;
  const title = String(p.working_title ?? p.title ?? "").trim();
  if (!title) throw new SchemaError("Brief missing working title");
  return p;
}

function validateOutput(raw: unknown): { title: string; body: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new SchemaError("Output response was not a JSON object");
  }
  const p = raw as Record<string, unknown>;
  const body = String(p.body ?? "").trim();
  if (body.length < 20) throw new SchemaError("Output body too short");
  return {
    title: String(p.title ?? "").trim(),
    body,
  };
}

function validateVisualBrief(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new SchemaError("Visual brief was not a JSON object");
  }
  const p = raw as Record<string, unknown>;
  if (!String(p.concept_summary ?? "").trim()) {
    throw new SchemaError("Visual brief missing concept summary");
  }
  return p;
}

function generationProvenance(
  strategy: unknown,
  knowledgeVersion: number,
  extra?: Record<string, unknown>
) {
  const rec = strategy && typeof strategy === "object" && !Array.isArray(strategy)
    ? (strategy as { id?: unknown; model?: unknown; provider?: unknown })
    : null;
  const strategyId = strategyIdOf(strategy);
  return {
    model: typeof rec?.model === "string" ? rec.model : "unknown",
    provider: typeof rec?.provider === "string" ? rec.provider : null,
    strategy_id: strategyId,
    strategy: strategyId,
    prompt_version: PROMPT_VERSION,
    knowledge_version: knowledgeVersion,
    generated_at: new Date().toISOString(),
    ...(extra ?? {}),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const requestId = newRequestId();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!serviceKey || !supabaseUrl || !anonKey) {
    return jsonErr(500, "server_misconfigured", "Server misconfigured.", requestId);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonErr(401, "unauthorized", "Sign in to generate content.", requestId);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) {
    return jsonErr(401, "unauthorized", "Sign in again to generate content.", requestId);
  }

  const { data: adminRow } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (!adminRow) {
    return jsonErr(403, "not_platform_admin", "Only platform admins can generate content.", requestId);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  async function adminWriteRpc(fn: string, args: Record<string, unknown>) {
    const { error } = await userClient.rpc(fn, args);
    if (error) {
      throw new Error(
        error.message.includes("Could not find the function")
          ? `${fn} is unavailable — apply the content workflow migration (db:push).`
          : error.message
      );
    }
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonErr(400, "invalid_json", "Request body must be JSON.", requestId);
  }

  const { topic_id, stage } = body;
  if (!topic_id || !stage) {
    return jsonErr(400, "invalid_request", "topic_id and stage are required.", requestId);
  }

  const { data: topic, error: topicErr } = await admin
    .from("content_topics")
    .select("*")
    .eq("id", topic_id)
    .maybeSingle();

  if (topicErr || !topic) {
    return jsonErr(404, "topic_not_found", "Content topic not found.", requestId);
  }

  const { data: knowledge, error: kErr } = await admin
    .from("knowledge")
    .select("*")
    .eq("id", topic.knowledge_id)
    .maybeSingle();

  if (kErr || !knowledge) {
    return jsonErr(404, "knowledge_not_found", "Linked Knowledge not found.", requestId);
  }

  const { data: sourceRows } = await admin
    .from("knowledge_sources")
    .select("*")
    .eq("knowledge_id", topic.knowledge_id);

  const sources = (sourceRows ?? []) as Array<Record<string, unknown>>;

  const { data: claimRows } = await admin
    .from("knowledge_claims")
    .select("claim_text, category, verification_status, source_location, sort_order")
    .eq("knowledge_id", topic.knowledge_id)
    .order("sort_order", { ascending: true });

  const claims = (claimRows ?? []) as Array<Record<string, unknown>>;
  const seoEnv = normalizeEnvelope(topic.seo);
  const briefEnv = normalizeEnvelope(topic.brief);
  const seoApproved = (seoEnv.approved as Record<string, unknown>) ?? null;
  const briefApproved = (briefEnv.approved as Record<string, unknown>) ?? null;

  const generatingStatus: Record<GenerateStage, string> = {
    seo: "generating_seo",
    brief: "generating_brief",
    output: "generating_outputs",
    visual_concept: "visual_concept_review",
    visual_final: "generating_final_assets",
  };

  try {
    await adminWriteRpc("admin_set_content_topic_workflow_status", {
      p_topic_id: topic_id,
      p_workflow_status: generatingStatus[stage],
      p_generation_error: null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Workflow update failed";
    return jsonErr(500, "workflow_rpc_failed", message, requestId, { topic_id, stage });
  }

  const geminiKey = knowledgeGeminiApiKey();
  const openaiKey = Deno.env.get("OPENAI_API_KEY");

  try {
    if (stage === "seo") {
      const knowledgePayload = buildKnowledgePayload(knowledge, sources, claims);
      const payload = JSON.stringify(knowledgePayload);
      const run = await runCapability<Record<string, unknown>>(admin, {
        capability: "content_seo_draft" as never,
        orgId: PLATFORM_ORG,
        userId: userData.user.id,
        entity: { type: "content_topic", id: topic_id },
        metadata: { stage, request_id: requestId },
        allowFallback: true,
        skipGate: true,
        executors: {
          "model:gemini-2.0-flash": () => {
            if (!geminiKey) throw new Error("Gemini API key not set");
            return callGemini(SEO_SYSTEM, payload);
          },
          "model:gpt-4o-mini": () => callOpenAI(SEO_SYSTEM, payload),
        },
        validate: validateSeo,
      });

      if (run.blocked) {
        return jsonErr(402, "ai_allowance_exhausted", "AI allowance exhausted.", requestId);
      }
      if (!run.ok || !run.value) {
        throw new Error(run.error ?? "SEO generation failed");
      }

      if (knowledgePayload.source_content_unavailable) {
        run.value.source_content_unavailable = true;
      }

      const claimGaps = (knowledgePayload.claims.unknown_or_unresolved as Array<{ text: string }>)
        .map((g) => g.text)
        .filter(Boolean);
      const gaps = new Set([
        ...asList(run.value.evidence_gaps),
        ...claimGaps,
      ]);
      run.value.evidence_gaps = [...gaps];

      const provenance = generationProvenance(run.strategy, knowledge.version as number, {
        source_coverage_summary: asText(run.value.source_coverage_summary),
        source_content_unavailable: asFlag(run.value.source_content_unavailable),
      });

      const nextSeo = appendVersion(seoEnv, run.value, provenance);
      await adminWriteRpc("admin_upsert_content_topic_stage", {
        p_topic_id: topic_id,
        p_seo: nextSeo,
        p_workflow_status: "seo_review",
      });

      return jsonOk({ ok: true, stage, request_id: requestId, seo: run.value, provenance });
    }

    if (stage === "brief") {
      if (seoEnv.approval_status !== "approved") {
        return jsonErr(409, "seo_not_approved", "Approve SEO before generating the brief.", requestId);
      }

      const payload = JSON.stringify(
        buildKnowledgePayload(knowledge, sources, claims, seoApproved ?? undefined)
      );
      const run = await runCapability<Record<string, unknown>>(admin, {
        capability: "content_brief_draft" as never,
        orgId: PLATFORM_ORG,
        userId: userData.user.id,
        entity: { type: "content_topic", id: topic_id },
        metadata: { stage, request_id: requestId },
        allowFallback: true,
        skipGate: true,
        executors: {
          "model:gemini-2.0-flash": () => {
            if (!geminiKey) throw new Error("Gemini API key not set");
            return callGemini(BRIEF_SYSTEM, payload);
          },
          "model:gpt-4o-mini": () => callOpenAI(BRIEF_SYSTEM, payload),
        },
        validate: validateBrief,
      });

      if (!run.ok || !run.value) throw new Error(run.error ?? "Brief generation failed");

      const provenance = generationProvenance(run.strategy, knowledge.version as number, {
        source_content_unavailable: Boolean(run.value.source_content_unavailable),
      });

      const nextBrief = appendVersion(briefEnv, run.value, provenance);
      await adminWriteRpc("admin_upsert_content_topic_stage", {
        p_topic_id: topic_id,
        p_brief: nextBrief,
        p_workflow_status: "brief_review",
      });

      return jsonOk({ ok: true, stage, request_id: requestId, brief: run.value, provenance });
    }

    if (stage === "output") {
      if (briefEnv.approval_status !== "approved") {
        return jsonErr(409, "brief_not_approved", "Approve the brief before generating outputs.", requestId);
      }

      const kinds = (body.output_kinds ?? []).filter(Boolean);
      if (kinds.length === 0) {
        return jsonErr(400, "output_kinds_required", "Select at least one output type.", requestId);
      }

      const validKinds = [
        "core_article", "faq", "in_app_tip", "newsletter", "social_post", "reel_script",
      ];
      const results: Array<{ kind: string; ok: boolean; error?: string }> = [];

      for (const kind of kinds) {
        if (!validKinds.includes(kind)) {
          results.push({ kind, ok: false, error: "invalid_output_kind" });
          continue;
        }

        const outputPrompt =
          OUTPUT_SYSTEM +
          `\nOutput type: ${kind}. Follow the approved brief structure and tone.`;

        const payload = JSON.stringify({
          ...buildKnowledgePayload(knowledge, sources, claims, seoApproved ?? undefined, briefApproved ?? undefined),
          output_kind: kind,
        });

        try {
          const run = await runCapability<{ title: string; body: string }>(admin, {
            capability: "content_output_draft" as never,
            orgId: PLATFORM_ORG,
            userId: userData.user.id,
            entity: { type: "content_topic", id: topic_id },
            metadata: { stage, output_kind: kind, request_id: requestId },
            allowFallback: true,
            skipGate: true,
            executors: {
              "model:gemini-2.0-flash": () => {
                if (!geminiKey) throw new Error("Gemini API key not set");
                return callGemini(outputPrompt, payload);
              },
              "model:gpt-4o-mini": () => callOpenAI(outputPrompt, payload),
            },
            validate: validateOutput,
          });

          if (!run.ok || !run.value) throw new Error(run.error ?? "Output generation failed");

          const provenance = generationProvenance(run.strategy, knowledge.version as number, {
            output_kind: kind,
          });

          await adminWriteRpc("admin_upsert_content_output", {
            p_topic_id: topic_id,
            p_output_kind: kind,
            p_title: run.value.title || null,
            p_body: run.value.body,
            p_status: "draft",
            p_provenance: provenance,
          });

          results.push({ kind, ok: true });
        } catch (e) {
          results.push({
            kind,
            ok: false,
            error: e instanceof Error ? e.message : "generation_failed",
          });
        }
      }

      await adminWriteRpc("admin_set_content_topic_workflow_status", {
        p_topic_id: topic_id,
        p_workflow_status: "output_review",
      });

      return jsonOk({ ok: true, stage, request_id: requestId, results });
    }

    if (stage === "visual_concept" || stage === "visual_final") {
      if (briefEnv.approval_status !== "approved") {
        return jsonErr(409, "brief_not_approved", "Approve the brief before creative work.", requestId);
      }

      const payload = JSON.stringify(
        buildKnowledgePayload(knowledge, sources, claims, seoApproved ?? undefined, briefApproved ?? undefined)
      );

      const run = await runCapability<Record<string, unknown>>(admin, {
        capability: "content_visual_brief" as never,
        orgId: PLATFORM_ORG,
        userId: userData.user.id,
        entity: { type: "content_topic", id: topic_id },
        metadata: { stage, request_id: requestId },
        allowFallback: true,
        skipGate: true,
        executors: {
          "model:gemini-2.0-flash": () => {
            if (!geminiKey) throw new Error("Gemini API key not set");
            return callGemini(VISUAL_BRIEF_SYSTEM, payload);
          },
          "model:gpt-4o-mini": () => callOpenAI(VISUAL_BRIEF_SYSTEM, payload),
        },
        validate: validateVisualBrief,
      });

      if (!run.ok || !run.value) throw new Error(run.error ?? "Visual brief generation failed");

      const creative = (topic.creative as Record<string, unknown>) ?? {};
      const provenance = generationProvenance(run.strategy, knowledge.version as number);

      const nextCreative = {
        ...creative,
        visual_brief: run.value,
        provenance,
        test_assets: stage === "visual_concept"
          ? {
              thumbnail_prompt: run.value.thumbnail_prompt,
              test_square_prompt: run.value.test_square_prompt,
              status: "pending_review",
            }
          : creative.test_assets,
        final_assets: stage === "visual_final"
          ? {
              master_square_prompt: run.value.master_square_prompt,
              portrait_prompt: run.value.portrait_derivative_prompt,
              landscape_prompt: run.value.landscape_derivative_prompt,
              status: "generated",
            }
          : creative.final_assets,
      };

      const nextStatus = stage === "visual_final" ? "ready_for_publishing" : "visual_concept_review";

      await adminWriteRpc("admin_upsert_content_topic_stage", {
        p_topic_id: topic_id,
        p_creative: nextCreative,
        p_workflow_status: nextStatus,
      });

      return jsonOk({ ok: true, stage, request_id: requestId, creative: nextCreative });
    }

    return jsonErr(400, "invalid_stage", "Unknown generation stage.", requestId);
  } catch (e) {
    const message = e instanceof SchemaError
      ? e.message
      : e instanceof Error
        ? e.message
        : "Content generation failed";

    await adminWriteRpc("admin_set_content_topic_workflow_status", {
      p_topic_id: topic_id,
      p_workflow_status: "generation_failed",
      p_generation_error: message.slice(0, 500),
    }).catch(() => {
      /* best-effort status update */
    });

    return jsonErr(502, "generation_failed", message, requestId, {
      stage,
      topic_id,
    });
  }
});
