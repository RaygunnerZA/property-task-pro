/**
 * compliance-clause-rewrite — AI rewrite for compliance clause review UI.
 * POST { org_id, clause_text, critic_notes? } → { ok, suggestion, reasoning }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { geminiUsage, openAiUsage } from "../_shared/aiObservability.ts";
import {
  runCapability,
  type ExecutorOutput,
  type StrategyExecutor,
} from "../_shared/aiCall.ts";
import { SchemaError, parseJsonLoose } from "../_shared/aiRouting.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

function jsonOk(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonErr(message: string, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildPrompt(clauseText: string, criticNotes?: string | null) {
  const critic = criticNotes?.trim()
    ? `\n\nReviewer / critic notes:\n${criticNotes.trim()}`
    : "";
  return `You are a compliance and legal drafting assistant. Rewrite the clause below to be clearer and more precise while preserving intent and obligations. Do not invent new duties or penalties. Output ONLY valid JSON with keys "suggestion" (string — rewritten clause) and "reasoning" (string — 2–4 sentence rationale). No markdown fences.

Clause:
${clauseText.trim()}${critic}`;
}

interface Rewrite {
  suggestion: string;
  reasoning: string;
}

function validateRewrite(raw: unknown): Rewrite {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new SchemaError("Clause rewrite response was not a JSON object");
  }
  const obj = raw as { suggestion?: unknown; reasoning?: unknown };
  const suggestion = String(obj.suggestion ?? "").trim();
  if (!suggestion) throw new SchemaError("Clause rewrite response had no suggestion");
  return { suggestion, reasoning: String(obj.reasoning ?? "") };
}

function executors(prompt: string): Record<string, StrategyExecutor> {
  return {
    "model:google/gemini-2.0-flash": () => callLovable(prompt),
    "model:gpt-4o-mini": () => callOpenAI(prompt),
    "model:gemini-2.0-flash": () => callGemini(prompt),
  };
}

async function callLovable(prompt: string): Promise<ExecutorOutput> {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not set");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Lovable: ${res.status} ${JSON.stringify(json)}`);
  return { raw: parseJsonLoose(json.choices?.[0]?.message?.content), usage: openAiUsage(json) };
}

async function callOpenAI(prompt: string): Promise<ExecutorOutput> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`OpenAI: ${res.status} ${JSON.stringify(json)}`);
  return { raw: parseJsonLoose(json.choices?.[0]?.message?.content), usage: openAiUsage(json) };
}

async function callGemini(prompt: string): Promise<ExecutorOutput> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Gemini: ${res.status} ${JSON.stringify(json)}`);
  return {
    raw: parseJsonLoose(json.candidates?.[0]?.content?.parts?.[0]?.text),
    usage: geminiUsage(json),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonErr("POST only", 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return jsonErr("Unauthorized", 401);

  let body: { org_id?: string; clause_text?: string; critic_notes?: string | null };
  try {
    body = await req.json();
  } catch {
    return jsonErr("Invalid JSON", 400);
  }

  const orgId = (body.org_id || "").trim();
  const clauseText = (body.clause_text || "").trim();
  if (!orgId) return jsonErr("org_id required", 400);
  if (!clauseText) return jsonErr("clause_text required", 400);

  const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user },
    error: authErr,
  } = await supabaseUser.auth.getUser();
  if (authErr || !user) return jsonErr("Unauthorized", 401);

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return jsonErr("Server misconfigured", 500);
  }

  const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: member } = await service
    .from("organisation_members")
    .select("org_id")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) return jsonErr("Forbidden", 403);

  const run = await runCapability<Rewrite>(service, {
    capability: "compliance_clause_rewrite",
    orgId,
    userId: user.id,
    entity: { type: "compliance_clause", id: null },
    // One provider only: a rewrite is advisory, so a failure is better than
    // silently sending clause text to a second vendor.
    allowFallback: false,
    executors: executors(buildPrompt(clauseText, body.critic_notes)),
    validate: validateRewrite,
  });

  if (run.blocked) {
    return jsonOk({
      ok: false,
      error: "ai_allowance_exhausted",
      message: run.gate?.message,
      suggestion: null,
      reasoning:
        "AI rewrite skipped — allowance reached. Edit the clause manually or add an AI pack.",
    });
  }

  if (!run.ok || !run.value) {
    return jsonOk({
      ok: false,
      error: run.error || "Rewrite failed",
    });
  }

  return jsonOk({
    ok: true,
    suggestion: run.value.suggestion,
    reasoning: run.value.reasoning,
  });
});
