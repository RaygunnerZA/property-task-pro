/**
 * knowledge-critic — second-model verification for Knowledge candidates.
 * Must use a different provider/model than the extractor that drafted the row.
 * Never auto-publishes. Logs to ai_requests.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { estimateCost, logAiRequest } from "../_shared/aiObservability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CRITIC_PROMPT_VERSION = "knowledge-critic-v1";
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

function pickCriticProvider(extractorProvider?: string | null): {
  provider: string;
  model: string;
  useOpenAI: boolean;
} {
  const ext = (extractorProvider || "").toUpperCase();
  // Prefer OpenAI when extractor was Gemini (or unknown); Gemini when extractor was OpenAI.
  if (ext.includes("OPENAI") || ext.includes("GPT")) {
    return { provider: "GEMINI", model: "gemini-2.0-flash", useOpenAI: false };
  }
  return { provider: "OPENAI", model: "gpt-4o-mini", useOpenAI: true };
}

async function callOpenAICritic(
  apiKey: string,
  title: string,
  summary: string | null,
  body: string | null,
  provenance: Record<string, unknown>
): Promise<{ trust_score: number; notes: string; verified: boolean }> {
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
  const text = data?.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(text);
  return {
    trust_score: Number(parsed.trust_score ?? 0.4),
    notes: String(parsed.notes ?? ""),
    verified: Boolean(parsed.verified),
  };
}

async function callGeminiCritic(
  apiKey: string,
  title: string,
  summary: string | null,
  body: string | null,
  provenance: Record<string, unknown>
): Promise<{ trust_score: number; notes: string; verified: boolean }> {
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
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
  const parsed = JSON.parse(cleaned);
  return {
    trust_score: Number(parsed.trust_score ?? 0.4),
    notes: String(parsed.notes ?? ""),
    verified: Boolean(parsed.verified),
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

  const pick = pickCriticProvider(
    extractor_provider ??
      (row.provenance as Record<string, unknown> | null)?.extractor_provider as string | undefined
  );

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");

  let useOpenAI = pick.useOpenAI;
  if (useOpenAI && !openaiKey && geminiKey) useOpenAI = false;
  if (!useOpenAI && !geminiKey && openaiKey) useOpenAI = true;

  const provider = useOpenAI ? "OPENAI" : "GEMINI";
  const model = useOpenAI ? "gpt-4o-mini" : "gemini-2.0-flash";

  const start = Date.now();
  let status: "success" | "error" | "fallback" = "success";
  let errorMessage: string | null = null;
  let trust = 0.4;
  let notes = "Critic unavailable; default trust retained.";
  let markVerified = false;

  try {
    if (useOpenAI && openaiKey) {
      const result = await callOpenAICritic(
        openaiKey,
        row.title,
        row.summary,
        row.body,
        (row.provenance as Record<string, unknown>) ?? {}
      );
      trust = result.trust_score;
      notes = result.notes;
      markVerified = result.verified && trust >= VERIFIED_TRUST_FLOOR;
    } else if (geminiKey) {
      const result = await callGeminiCritic(
        geminiKey,
        row.title,
        row.summary,
        row.body,
        (row.provenance as Record<string, unknown>) ?? {}
      );
      trust = result.trust_score;
      notes = result.notes;
      markVerified = result.verified && trust >= VERIFIED_TRUST_FLOOR;
      if (pick.useOpenAI) status = "fallback";
    } else {
      status = "error";
      errorMessage = "No critic provider configured";
    }
  } catch (err) {
    status = "error";
    errorMessage = String(err);
  }

  const logOrg =
    org_id ??
    row.org_id ??
    "00000000-0000-0000-0000-000000000000";

  logAiRequest(admin, {
    org_id: logOrg,
    function_name: "knowledge-critic",
    model_used: model,
    provider,
    prompt_version: CRITIC_PROMPT_VERSION,
    latency_ms: Date.now() - start,
    status,
    error_message: errorMessage,
    entity_type: "knowledge",
    entity_id: knowledge_id,
    cost_usd: estimateCost(model, null, null),
    cost_units: 2,
    metadata: { extractor_provider: extractor_provider ?? null },
  });

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
