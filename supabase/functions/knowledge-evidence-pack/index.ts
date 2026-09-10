/**
 * knowledge-evidence-pack — one grounded collect call for Content Tree research.
 * Platform admin only. Requires fetchable source text (discovers + attaches URL when missing).
 * Persists proposed claims as extracted/unknown on the linked knowledge_id.
 * Does NOT verify claims, publish, or approve SEO. Critic is a separate call.
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
import { safeFetchUrl } from "../_shared/safeUrlFetch.ts";
import {
  buildGapResearchUserPrompt,
  GAP_RESEARCH_SYSTEM,
  parseResearchGapsBody,
  validateDiscoverySources,
} from "../_shared/knowledgeGapResearch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
};

const PLATFORM_ORG = "00000000-0000-0000-0000-000000000000";
const PROMPT_VERSION = "knowledge-evidence-pack-v1";

const PACK_SYSTEM =
  "You build a grounded evidence pack for property-compliance Knowledge from PROVIDED source text only. " +
  "Do NOT invent facts, URLs, or page content. Prefer answering the listed evidence_gaps. " +
  "If a gap cannot be answered from the text, list it in remaining_gaps and/or add an established:false claim. " +
  "Return JSON only: {" +
  "\"sources_used\":[\"https://...\"]," +
  "\"claims\":[{\"text\":\"...\",\"category\":\"obligation|applicability|responsibility|standard|testing|replacement|evidence|exception|consequence|other\",\"source_location\":\"section or null\",\"established\":true}]," +
  "\"remaining_gaps\":[\"...\"]" +
  "}";

type RequestBody = {
  knowledge_id: string;
  evidence_gaps?: string[];
  jurisdiction?: string;
  topic_title?: string;
  /** When true and no URL exists, run gap discovery first. */
  allow_discovery?: boolean;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
    if (typeof val === "string" && val.trim().length > 40) return val.trim().slice(0, 20000);
  }
  return null;
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20000);
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean);
}

function validatePack(raw: unknown): {
  sources_used: string[];
  claims: Array<Record<string, unknown>>;
  remaining_gaps: string[];
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new SchemaError("pack_payload_not_object");
  }
  const obj = raw as Record<string, unknown>;
  const claimsRaw = obj.claims;
  if (!Array.isArray(claimsRaw)) throw new SchemaError("claims_missing");
  const claims: Array<Record<string, unknown>> = [];
  for (const item of claimsRaw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const text =
      typeof rec.text === "string"
        ? rec.text.trim()
        : typeof rec.claim_text === "string"
          ? rec.claim_text.trim()
          : "";
    if (text.length < 4) continue;
    claims.push({
      claim_text: text.slice(0, 500),
      category: typeof rec.category === "string" ? rec.category : "other",
      source_location:
        typeof rec.source_location === "string" ? rec.source_location.slice(0, 240) : null,
      established: rec.established !== false,
      verification_status: rec.established === false ? "unknown" : "extracted",
    });
    if (claims.length >= 80) break;
  }
  return {
    sources_used: asStringList(obj.sources_used).slice(0, 8),
    claims,
    remaining_gaps: asStringList(obj.remaining_gaps).slice(0, 40),
  };
}

async function callGemini(system: string, user: string): Promise<ExecutorOutput> {
  const key = knowledgeGeminiApiKey();
  if (!key) throw new Error("Gemini API key not set");
  const res = await fetch(geminiGenerateContentUrl(GEMINI_FLASH_MODEL, key), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return { raw: parseJsonLoose(text), usage: geminiUsage(data) };
}

async function callOpenAI(system: string, user: string): Promise<ExecutorOutput> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY not set");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  return { raw: parseJsonLoose(text), usage: openAiUsage(data) };
}

async function callGeminiSearch(system: string, user: string): Promise<ExecutorOutput> {
  const key = knowledgeGeminiApiKey();
  if (!key) throw new Error("Gemini API key not set");
  const res = await fetch(geminiGenerateContentUrl(GEMINI_FLASH_MODEL, key), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.1 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return { raw: parseJsonLoose(text), usage: geminiUsage(data) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const knowledgeId = body.knowledge_id?.trim();
  if (!knowledgeId) return json({ ok: false, error: "knowledge_id_required" }, 400);

  const evidenceGaps = asStringList(body.evidence_gaps);
  const jurisdiction = (body.jurisdiction ?? "unscoped").trim() || "unscoped";
  const topicTitle = (body.topic_title ?? "").trim();
  const allowDiscovery = body.allow_discovery !== false;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json({ ok: false, error: "server_misconfigured" }, 500);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) return json({ ok: false, error: "unauthorized" }, 401);

  const { data: isAdmin, error: adminErr } = await userClient.rpc("is_platform_admin");
  if (adminErr || !isAdmin) return json({ ok: false, error: "not_platform_admin" }, 403);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: row, error: rowErr } = await admin
    .from("knowledge")
    .select("id, title, summary, body, attributes, applicability, org_id, scope")
    .eq("id", knowledgeId)
    .maybeSingle();
  if (rowErr || !row) return json({ ok: false, error: "knowledge_not_found" }, 404);

  let { data: sourceRows } = await admin
    .from("knowledge_sources")
    .select("id, label, url, source_type, metadata")
    .eq("knowledge_id", knowledgeId);

  let sources = sourceRows ?? [];
  const existingUrls = new Set(
    sources
      .map((s) => (typeof s.url === "string" ? s.url.trim() : ""))
      .filter((u) => /^https?:\/\//i.test(u))
  );

  const attachedUrls: string[] = [];

  const needsDiscovery =
    existingUrls.size === 0 && allowDiscovery && evidenceGaps.length > 0;

  if (needsDiscovery) {
    const gaps = parseResearchGapsBody({
      gaps: evidenceGaps.slice(0, 8).map((text, i) => ({
        id: `content:${knowledgeId}:${i}`,
        topic_key: `content_${knowledgeId.slice(0, 8)}`,
        topic: `${topicTitle || row.title} — ${text}`.slice(0, 200),
        jurisdiction,
        status: "partial",
      })),
    });

    const geminiKey = knowledgeGeminiApiKey();
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const discoveryRun = await runCapability(admin, {
      capability: "knowledge_gap_research" as never,
      orgId: row.org_id ?? PLATFORM_ORG,
      userId: user.id,
      entity: { type: "knowledge", id: knowledgeId },
      metadata: { prompt_version: PROMPT_VERSION, stage: "discovery" },
      allowFallback: true,
      skipGate: row.scope === "platform" || row.org_id == null,
      executors: {
        "model:gemini-2.0-flash": () => {
          if (!geminiKey) throw new Error("Gemini API key not set");
          return callGeminiSearch(GAP_RESEARCH_SYSTEM, buildGapResearchUserPrompt(gaps));
        },
        "model:gpt-4o-mini": () => {
          if (!openaiKey) throw new Error("OPENAI_API_KEY not set");
          return callOpenAI(GAP_RESEARCH_SYSTEM, buildGapResearchUserPrompt(gaps));
        },
      },
      validate: validateDiscoverySources,
    });

    if (discoveryRun.ok && discoveryRun.value) {
      const hits = discoveryRun.value.sources ?? [];
      for (const hit of hits.slice(0, 3)) {
        const url = typeof hit.url === "string" ? hit.url.trim() : "";
        if (!/^https:\/\//i.test(url) || existingUrls.has(url)) continue;
        const { data: inserted, error: insErr } = await admin
          .from("knowledge_sources")
          .insert({
            knowledge_id: knowledgeId,
            source_type: "url",
            label: hit.title || hit.publisher || "Discovered source",
            url,
            metadata: {
              authority: hit.authority,
              publisher: hit.publisher,
              discovered_by: "knowledge-evidence-pack",
            },
          })
          .select("id, label, url, source_type, metadata")
          .single();
        if (insErr || !inserted) {
          console.warn("[knowledge-evidence-pack] attach failed", insErr);
          continue;
        }
        existingUrls.add(url);
        attachedUrls.push(url);
        sources = [...sources, inserted];
      }
    }
  }

  const sourceMaterial: Array<{
    source_id: string;
    label: string | null;
    url: string | null;
    text: string;
  }> = [];

  for (const s of sources) {
    const meta = (s.metadata as Record<string, unknown>) ?? {};
    let text = extractSourceText(meta);
    const url = typeof s.url === "string" ? s.url : null;
    if (!text && url && /^https?:\/\//i.test(url)) {
      try {
        const fetched = await safeFetchUrl(url);
        const ct = fetched.contentType || "";
        if (ct.includes("html") || ct.includes("text") || ct.includes("xml")) {
          const decoded = new TextDecoder().decode(fetched.bytes);
          text =
            ct.includes("html") || ct.includes("xml")
              ? htmlToText(decoded)
              : decoded.slice(0, 20000);
          await admin
            .from("knowledge_sources")
            .update({
              metadata: {
                ...meta,
                snapshot_text: text.slice(0, 20000),
                snapshot_at: new Date().toISOString(),
              },
            })
            .eq("id", s.id);
        }
      } catch (e) {
        console.warn("[knowledge-evidence-pack] fetch failed", url, e);
      }
    }
    if (text && text.length > 40) {
      sourceMaterial.push({
        source_id: s.id,
        label: s.label,
        url,
        text,
      });
    }
  }

  if (sourceMaterial.length === 0) {
    return json(
      {
        ok: false,
        error: "source_content_unavailable",
        message:
          "No extractable source text. Add a reachable official URL, then retry research.",
        attached_urls: attachedUrls,
      },
      409
    );
  }

  const primarySourceId = sourceMaterial[0]!.source_id;
  const packUser = JSON.stringify({
    knowledge: {
      title: row.title,
      summary: row.summary,
      body: row.body,
      attributes: row.attributes,
      applicability: row.applicability,
    },
    evidence_gaps: evidenceGaps,
    sources: sourceMaterial.map((s) => ({
      label: s.label,
      url: s.url,
      text: s.text,
    })),
  });

  const geminiKey = knowledgeGeminiApiKey();
  const openaiKey = Deno.env.get("OPENAI_API_KEY");

  const packRun = await runCapability(admin, {
    capability: "knowledge_evidence_pack" as never,
    orgId: row.org_id ?? PLATFORM_ORG,
    userId: user.id,
    entity: { type: "knowledge", id: knowledgeId },
    metadata: { prompt_version: PROMPT_VERSION },
    allowFallback: true,
    skipGate: row.scope === "platform" || row.org_id == null,
    executors: {
      "model:gemini-2.0-flash": () => {
        if (!geminiKey) throw new Error("Gemini API key not set");
        return callGemini(PACK_SYSTEM, packUser);
      },
      "model:gpt-4o-mini": () => {
        if (!openaiKey) throw new Error("OPENAI_API_KEY not set");
        return callOpenAI(PACK_SYSTEM, packUser);
      },
    },
    validate: validatePack,
  });

  if (packRun.blocked) {
    return json({ ok: false, error: "ai_allowance_exhausted" }, 402);
  }
  if (!packRun.ok || !packRun.value) {
    return json({ ok: false, error: packRun.error ?? "evidence_pack_failed" }, 502);
  }

  const claimsForRpc = packRun.value.claims.map((c) => ({
    ...c,
    source_id: primarySourceId,
  }));

  const { data: inserted, error: replaceErr } = await admin.rpc(
    "replace_knowledge_extracted_claims",
    {
      p_knowledge_id: knowledgeId,
      p_claims: claimsForRpc,
    }
  );
  if (replaceErr) {
    console.error("[knowledge-evidence-pack] replace failed", replaceErr);
    return json({ ok: false, error: replaceErr.message }, 500);
  }

  await admin.rpc("knowledge_invalidate_critic", {
    p_knowledge_id: knowledgeId,
    p_reason: "source_edit",
  });

  return json({
    ok: true,
    knowledge_id: knowledgeId,
    inserted_count: inserted ?? claimsForRpc.length,
    remaining_gaps: packRun.value.remaining_gaps,
    attached_urls: attachedUrls,
    sources_used: packRun.value.sources_used,
    provenance: {
      prompt_version: PROMPT_VERSION,
      strategy: packRun.strategy,
    },
  });
});
