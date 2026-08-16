/**
 * knowledge-critic — second-model verification for Knowledge candidates.
 * Must use a different provider/model than the extractor that drafted the row.
 * Never auto-publishes. Logs to ai_requests.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { geminiUsage, openAiUsage } from "../_shared/aiObservability.ts";
import { runCapability, type ExecutorOutput } from "../_shared/aiCall.ts";
import { SchemaError, parseJsonLoose } from "../_shared/aiRouting.ts";

interface CriticVerdict {
  trust_score: number;
  notes: string;
  verified: boolean;
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
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Prompt version is pinned with the strategy in `CAPABILITIES.knowledge_critique`. */
const VERIFIED_TRUST_FLOOR = 0.7;

interface CriticInput {
  knowledge_id: string;
  org_id?: string | null;
  /** Extractor provider used for the draft — critic must differ. */
  extractor_provider?: string | null;
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callOpenAICritic(
  apiKey: string,
  title: string,
  summary: string | null,
  body: string | null,
  provenance: Record<string, unknown>
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
        {
          role: "system",
          content:
            "You are a strict knowledge critic for a property-operations platform. " +
            "Score draft knowledge for factual safety, specificity, and non-hallucination. " +
            'Return JSON: {"trust_score":0-1,"notes":"string","verified":boolean}. ' +
            "verified=true only if trust_score >= 0.7 and claims are supportable from the draft text.",
        },
        {
          role: "user",
          content: JSON.stringify({ title, summary, body, provenance }),
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI critic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { raw: parseJsonLoose(data?.choices?.[0]?.message?.content), usage: openAiUsage(data) };
}

async function callGeminiCritic(
  apiKey: string,
  title: string,
  summary: string | null,
  body: string | null,
  provenance: Record<string, unknown>
): Promise<ExecutorOutput> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text:
                "You are a strict knowledge critic. Return ONLY JSON " +
                '{"trust_score":0-1,"notes":"string","verified":boolean}. ' +
                "verified=true only if trust_score >= 0.7.\n\n" +
                JSON.stringify({ title, summary, body, provenance }),
            },
          ],
        },
      ],
      generationConfig: { temperature: 0.2 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini critic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return {
    raw: parseJsonLoose(data?.candidates?.[0]?.content?.parts?.[0]?.text),
    usage: geminiUsage(data),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "POST only" }, 405);

  let body: CriticInput;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }

  const { knowledge_id, org_id, extractor_provider } = body;
  if (!knowledge_id) return jsonResponse({ ok: false, error: "knowledge_id required" }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return jsonResponse({ ok: false, error: "Service role not configured" }, 500);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: row, error: loadErr } = await admin
    .from("knowledge")
    .select("id, title, summary, body, provenance, org_id, status")
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

  const logOrg = org_id ?? row.org_id ?? "00000000-0000-0000-0000-000000000000";
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const provenance = (row.provenance as Record<string, unknown>) ?? {};

  // Ch 7: the critic must not reuse the extractor's provider. The boundary enforces
  // that constraint, and resolves to nothing rather than faking a second opinion.
  const run = await runCapability<CriticVerdict>(admin, {
    capability: "knowledge_critique",
    orgId: logOrg,
    mustDifferFrom: extractorProvider,
    entity: { type: "knowledge", id: knowledge_id },
    metadata: { extractor_provider: extractorProvider },
    allowFallback: false,
    executors: {
      "model:gpt-4o-mini": () => {
        if (!openaiKey) throw new Error("OPENAI_API_KEY not set");
        return callOpenAICritic(openaiKey, row.title, row.summary, row.body, provenance);
      },
      "model:gemini-2.0-flash": () => {
        if (!geminiKey) throw new Error("GEMINI_API_KEY not set");
        return callGeminiCritic(geminiKey, row.title, row.summary, row.body, provenance);
      },
    },
    validate: validateVerdict,
  });

  const verdict = run.value;
  const trust = verdict?.trust_score ?? 0.4;
  const notes = verdict?.notes || "Critic unavailable; default trust retained.";
  const markVerified = Boolean(verdict?.verified) && trust >= VERIFIED_TRUST_FLOOR;
  const provider = run.strategy?.provider ?? null;
  const model = run.strategy?.model ?? null;

  if (!run.ok) {
    console.warn("[knowledge-critic] no verdict:", run.error);
  }

  const { data: updated, error: applyErr } = await admin.rpc("apply_knowledge_critic_result", {
    p_knowledge_id: knowledge_id,
    p_trust_score: trust,
    p_critic_notes: notes,
    p_critic_model: model,
    p_critic_provider: provider,
    p_mark_verified: markVerified,
  });

  if (applyErr) {
    return jsonResponse({ ok: false, error: applyErr.message }, 500);
  }

  return jsonResponse({
    ok: true,
    knowledge: updated,
    trust_score: trust,
    verified: markVerified,
    provider,
    model,
  });
});
