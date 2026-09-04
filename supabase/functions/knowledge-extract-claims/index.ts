/**
 * knowledge-extract-claims — extract atomic source-backed claims for an existing Knowledge row.
 * Platform admin only. Does not invent facts; missing details become unknown claims.
 * Replaces extracted/unknown/unresolved claims; keeps verified/rejected.
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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
};

const PLATFORM_ORG = "00000000-0000-0000-0000-000000000000";
const PROMPT_VERSION = "knowledge-extract-claims-v1";

const SYSTEM =
  "You extract atomic factual claims for property-compliance Knowledge from linked sources. " +
  "Preserve every materially useful fact the source establishes (scope, duties, frequency, responsibility, " +
  "standards, testing, replacement, evidence, exceptions, consequences, thresholds, deadlines). " +
  "Do NOT invent facts from general knowledge. If an important detail is absent, add a claim with established:false. " +
  "Do not aim for a fixed claim count — include all distinct useful facts; skip duplicates and filler. " +
  "Return JSON only: {\"claims\":[{\"text\":\"...\",\"category\":\"obligation|applicability|responsibility|standard|testing|replacement|evidence|exception|consequence|other\",\"source_location\":\"section or null\",\"established\":true}]}";

type RequestBody = {
  knowledge_id: string;
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

function validateClaims(raw: unknown): { claims: Array<Record<string, unknown>> } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new SchemaError("claims_payload_not_object");
  }
  const claims = (raw as { claims?: unknown }).claims;
  if (!Array.isArray(claims)) throw new SchemaError("claims_missing");
  const out: Array<Record<string, unknown>> = [];
  for (const item of claims) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const text =
      typeof rec.text === "string"
        ? rec.text.trim()
        : typeof rec.claim_text === "string"
          ? rec.claim_text.trim()
          : "";
    if (text.length < 4) continue;
    out.push({
      claim_text: text.slice(0, 500),
      category: typeof rec.category === "string" ? rec.category : "other",
      source_location:
        typeof rec.source_location === "string" ? rec.source_location.slice(0, 240) : null,
      established: rec.established !== false,
      verification_status: rec.established === false ? "unknown" : "extracted",
    });
    if (out.length >= 80) break;
  }
  return { claims: out };
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

  const { data: sourceRows } = await admin
    .from("knowledge_sources")
    .select("id, label, url, source_type, metadata")
    .eq("knowledge_id", knowledgeId);

  const sources = sourceRows ?? [];
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
          text = ct.includes("html") || ct.includes("xml") ? htmlToText(decoded) : decoded.slice(0, 20000);
        }
      } catch (e) {
        console.warn("[knowledge-extract-claims] fetch failed", url, e);
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
    return json({
      ok: false,
      error: "source_content_unavailable",
      message: "No extractable text on linked sources. Attach a document or reachable URL.",
    }, 409);
  }

  const primarySourceId = sourceMaterial[0].source_id;
  const payload = JSON.stringify({
    knowledge: {
      title: row.title,
      summary: row.summary,
      body: row.body,
      attributes: row.attributes,
      applicability: row.applicability,
    },
    sources: sourceMaterial.map((s) => ({
      label: s.label,
      url: s.url,
      text: s.text,
    })),
  });

  const geminiKey = knowledgeGeminiApiKey();
  const openaiKey = Deno.env.get("OPENAI_API_KEY");

  const run = await runCapability<{ claims: Array<Record<string, unknown>> }>(admin, {
    capability: "knowledge_claim_extract" as never,
    orgId: row.org_id ?? PLATFORM_ORG,
    userId: user.id,
    entity: { type: "knowledge", id: knowledgeId },
    metadata: { prompt_version: PROMPT_VERSION },
    allowFallback: true,
    skipGate: row.scope === "platform" || row.org_id == null,
    executors: {
      "model:gemini-2.0-flash": () => {
        if (!geminiKey) throw new Error("Gemini API key not set");
        return callGemini(SYSTEM, payload);
      },
      "model:gpt-4o-mini": () => {
        if (!openaiKey) throw new Error("OPENAI_API_KEY not set");
        return callOpenAI(SYSTEM, payload);
      },
    },
    validate: validateClaims,
  });

  if (run.blocked) {
    return json({ ok: false, error: "ai_allowance_exhausted" }, 402);
  }
  if (!run.ok || !run.value) {
    return json({ ok: false, error: run.error ?? "claim_extraction_failed" }, 502);
  }

  const claimsForRpc = run.value.claims.map((c) => ({
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
    console.error("[knowledge-extract-claims] replace failed", replaceErr);
    return json({ ok: false, error: replaceErr.message }, 500);
  }

  return json({
    ok: true,
    knowledge_id: knowledgeId,
    inserted_count: inserted ?? claimsForRpc.length,
    claims: claimsForRpc,
    provenance: {
      prompt_version: PROMPT_VERSION,
      strategy: run.strategy,
    },
  });
});
