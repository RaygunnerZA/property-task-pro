/**
 * compliance-clause-rewrite — AI rewrite for compliance clause review UI.
 * POST { org_id, clause_text, critic_notes? } → { ok, suggestion, reasoning }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  estimateCost,
  logAiRequest,
  type AiRequestStatus,
} from "../_shared/aiObservability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const AI_PROVIDER = (Deno.env.get("AI_PROVIDER") || "LOVABLE").toUpperCase();
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

function parseRewriteJson(raw: string): { suggestion: string; reasoning: string } {
  let s = raw.trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)```$/im);
  if (fence) s = fence[1].trim();
  const obj = JSON.parse(s) as { suggestion?: unknown; reasoning?: unknown };
  return {
    suggestion: String(obj.suggestion ?? ""),
    reasoning: String(obj.reasoning ?? ""),
  };
}

async function callModel(prompt: string): Promise<{ suggestion: string; reasoning: string }> {
  switch (AI_PROVIDER) {
    case "LOVABLE": {
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
      const content = json.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error("Invalid Lovable response");
      return parseRewriteJson(content);
    }
    case "OPENAI": {
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
      const content = json.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error("Invalid OpenAI response");
      return parseRewriteJson(content);
    }
    case "GEMINI": {
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
      const content = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof content !== "string") throw new Error("Invalid Gemini response");
      return parseRewriteJson(content);
    }
    default:
      throw new Error(`Unknown AI_PROVIDER: ${AI_PROVIDER}`);
  }
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

  const prompt = buildPrompt(clauseText, body.critic_notes);
  const modelUsed =
    AI_PROVIDER === "OPENAI"
      ? "gpt-4o-mini"
      : AI_PROVIDER === "GEMINI"
        ? "gemini-2.0-flash"
        : "google/gemini-2.0-flash";
  const started = Date.now();
  let status: AiRequestStatus = "success";
  let errorMessage: string | null = null;
  let suggestion = "";
  let reasoning = "";

  try {
    const out = await callModel(prompt);
    suggestion = out.suggestion;
    reasoning = out.reasoning;
  } catch (e) {
    status = "error";
    errorMessage = e instanceof Error ? e.message : String(e);
  } finally {
    logAiRequest(service, {
      org_id: orgId,
      user_id: user.id,
      function_name: "compliance-clause-rewrite",
      model_used: modelUsed,
      provider: AI_PROVIDER,
      latency_ms: Date.now() - started,
      status,
      error_message: errorMessage,
      entity_type: "compliance_clause",
      entity_id: null,
      cost_usd: estimateCost(modelUsed, null, null),
    });
  }

  if (status !== "success") {
    return jsonOk({
      ok: false,
      error: errorMessage || "Rewrite failed",
    });
  }

  return jsonOk({
    ok: true,
    suggestion,
    reasoning,
  });
});
