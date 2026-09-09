/**
 * knowledge-gap-research — batched official-source discovery for Knowledge gaps.
 * Platform admin only. Returns URLs; does not create or publish Knowledge.
 * Token-efficient: one structured discovery call per batch (max 20 gaps).
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
import {
  buildGapResearchUserPrompt,
  GAP_RESEARCH_PROMPT_VERSION,
  GAP_RESEARCH_SYSTEM,
  parseResearchGapsBody,
  validateDiscoverySources,
  type ResearchSourceHit,
} from "../_shared/knowledgeGapResearch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
};

const PLATFORM_ORG = "00000000-0000-0000-0000-000000000000";
const PROMPT_VERSION = GAP_RESEARCH_PROMPT_VERSION;
const MAX_BODY_BYTES = 16_384;

const SYSTEM = GAP_RESEARCH_SYSTEM;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callGemini(
  system: string,
  user: string,
  withSearch: boolean
): Promise<ExecutorOutput> {
  const key = knowledgeGeminiApiKey();
  if (!key) throw new Error("Gemini API key not set");
  const generationConfig: Record<string, unknown> = { temperature: 0.1 };
  if (!withSearch) generationConfig.responseMimeType = "application/json";
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig,
  };
  if (withSearch) {
    body.tools = [{ google_search: {} }];
  }
  const res = await fetch(geminiGenerateContentUrl(GEMINI_FLASH_MODEL, key), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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

  const rawText = await req.text();
  if (rawText.length > MAX_BODY_BYTES) {
    return json({ ok: false, error: "payload_too_large" }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawText);
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  let gaps;
  try {
    gaps = parseResearchGapsBody(body);
  } catch (e) {
    const code = e instanceof SchemaError ? e.message : "gaps_invalid";
    return json({ ok: false, error: code }, 400);
  }

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

  const allowedIds = new Set(gaps.map((g) => g.id));
  const userPrompt = buildGapResearchUserPrompt(gaps);
  const geminiKey = knowledgeGeminiApiKey();
  const openaiKey = Deno.env.get("OPENAI_API_KEY");

  const run = await runCapability<{ sources: ResearchSourceHit[]; uncovered: string[] }>(
    admin,
    {
      capability: "knowledge_gap_research",
      orgId: PLATFORM_ORG,
      userId: user.id,
      entity: { type: "knowledge_gap_research", id: user.id },
      metadata: { prompt_version: PROMPT_VERSION, gap_count: gaps.length },
      allowFallback: true,
      skipGate: true,
      executors: {
        "model:gemini-2.0-flash": async () => {
          if (!geminiKey) throw new Error("Gemini API key not set");
          try {
            return await callGemini(SYSTEM, userPrompt, true);
          } catch {
            return await callGemini(SYSTEM, userPrompt, false);
          }
        },
        "model:gpt-4o-mini": () => {
          if (!openaiKey) throw new Error("OPENAI_API_KEY not set");
          return callOpenAI(SYSTEM, userPrompt);
        },
      },
      validate: (raw) => validateDiscoverySources(raw, allowedIds),
    }
  );

  if (run.blocked) {
    return json({ ok: false, error: "ai_allowance_exhausted" }, 402);
  }
  if (!run.ok || !run.value) {
    return json({ ok: false, error: run.error ?? "discovery_failed" }, 502);
  }

  return json({
    ok: true,
    sources: run.value.sources,
    uncovered: run.value.uncovered,
    gap_count: gaps.length,
    provenance: {
      prompt_version: PROMPT_VERSION,
      strategy: run.strategy,
    },
  });
});
