// ai-extract — Semantic Task Extraction Engine with Provider Switch & Ghost-Chip Resolution

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { geminiUsage, openAiUsage } from "../_shared/aiObservability.ts";
import {
  runCapability,
  type ExecutorOutput,
  type StrategyExecutor,
} from "../_shared/aiCall.ts";
import {
  SchemaError,
  TimeoutError,
  normaliseProvider,
  parseJsonLoose,
} from "../_shared/aiRouting.ts";
import { buildTaskExtractionPrompt } from "../_shared/prompts/taskExtraction.ts";

const AI_TIMEOUT_MS = 9000;

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

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ----------------------------------------------------
// Request Handling
// ----------------------------------------------------

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS")
      return new Response(null, { headers: corsHeaders });

    if (req.method !== "POST")
      return jsonErr("POST only", 405);

    let body;
    try {
      body = await req.json();
    } catch {
      return jsonErr("Invalid JSON", 400);
    }

    console.log('Received payload:', JSON.stringify(body));

    const description = (body.description || "").trim();
    const orgId = body.org_id;

    if (!orgId) {
      console.log('Error: Missing org_id');
      return jsonErr("Missing org_id", 400);
    }
    if (!description) {
      console.log('Empty description, returning empty result');
      return jsonOK(emptyResult());
    }

    console.log('Processing AI extraction:', { descriptionLength: description.length, orgId, aiProvider: AI_PROVIDER });

    // 1. Semantic AI Extraction
    let ai: Record<string, unknown>;

    if (!SUPABASE_SERVICE_ROLE_KEY) {
      // Without the service role we cannot gate or meter, so stay on the manual path.
      console.log("[ai-extract] service role missing — rule-based only");
      ai = ruleBased(description);
    } else {
      const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const prompt = buildTaskExtractionPrompt(description);
      const run = await runCapability<Record<string, unknown>>(serviceClient, {
        capability: "task_extraction",
        orgId,
        entity: { type: "task", id: null },
        executors: {
          // Only the configured provider is offered: task text should not be
          // handed to a second vendor just because the first one failed.
          ...providerExecutors(prompt),
          "deterministic:rule-based-task": () =>
            Promise.resolve({ raw: ruleBased(description) }),
        },
        validate: (raw) => {
          if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
            throw new SchemaError("Task extraction response was not a JSON object");
          }
          return raw as Record<string, unknown>;
        },
      });

      if (run.blocked) {
        // Phase 5: allowance exhausted — manual path stays open.
        console.log("[ai-extract] allowance exhausted — rule-based fallback");
        ai = ruleBased(description);
      } else if (run.ok && run.value) {
        ai = run.value;
        console.log("AI extraction successful:", JSON.stringify(ai));
      } else {
        console.log("AI extraction error, falling back to rule-based:", run.error);
        ai = ruleBased(description);
      }
    }

    // 2. Resolve entities using database - WRAP IN TRY/CATCH
    let combined;
    try {
      combined = await resolveEntities(ai, orgId);
      console.log('Final combined result:', JSON.stringify(combined));
    } catch (error) {
      console.log('Error resolving entities, using AI result without resolution:', error);
      // Fallback: return AI result without entity resolution
      // Ensure all fields are safe and defined
      try {
        // Helper to normalize entity arrays with authority
        const normalizeEntityArray = (arr: any[]): Array<{ name: string; exists: boolean; authority?: number }> => {
          if (!Array.isArray(arr)) return [];
          return arr.map((item: any) => {
            if (typeof item === 'string') {
              return { name: item, exists: false, authority: 0.5 };
            }
            return {
              name: String(item.name || item),
              exists: false,
              authority: item.authority ?? 0.5,
            };
          });
        };

        combined = {
          title: ai?.title || '',
          priority: ai?.priority || 'medium',
          date: ai?.date || '',
          yes_no: ai?.yes_no || false,
          signature: ai?.signature || false,
          assets: Array.isArray(ai?.assets) 
            ? ai.assets.map((item: any) => {
                if (typeof item === 'string') return { name: item, authority: 0.5 };
                return { name: item.name || String(item), authority: item.authority ?? 0.5 };
              })
            : [],
          spaces: normalizeEntityArray(ai?.spaces || []),
          people: normalizeEntityArray(ai?.people || []),
          teams: normalizeEntityArray(ai?.teams || []),
          groups: normalizeEntityArray(ai?.groups || []),
          themes: Array.isArray(ai?.themes)
            ? ai.themes.map((t: any) => ({
                name: typeof t === 'string' ? t : t.name,
                exists: false,
                type: typeof t === 'object' ? (t.type || 'category') : 'category',
                authority: typeof t === 'object' ? (t.authority ?? 0.5) : 0.5,
              }))
            : [],
        };
      } catch (fallbackError) {
        console.log('Error in fallback, using empty result:', fallbackError);
        combined = emptyResult();
      }
    }

    // Ensure we always return a valid response
    if (!combined) {
      console.log('Combined result is null/undefined, using empty result');
      combined = emptyResult();
    }

    return jsonOK(combined);
  } catch (error) {
    // Catch-all for any unexpected errors - be extra defensive
    try {
      const errorMessage = error instanceof Error 
        ? error.message 
        : typeof error === 'string' 
        ? error 
        : 'Unknown error';
      console.log('Unexpected error in ai-extract function:', errorMessage, error);
      return jsonErr(`Internal error: ${errorMessage}`, 500);
    } catch (nestedError) {
      // Even the error handler failed - return a safe response
      console.log('Critical error in error handler:', nestedError);
      return new Response(
        JSON.stringify({ ok: false, error: 'Internal server error' }),
        { status: 500, headers: corsHeaders }
      );
    }
  }
});

// ----------------------------------------------------
// AI Provider Switch
// ----------------------------------------------------

/**
 * Executor for the configured provider only. A second vendor is deliberately not
 * offered: on failure this capability falls back to the deterministic extractor,
 * which keeps task text with one provider.
 */
function providerExecutors(prompt: string): Record<string, StrategyExecutor> {
  switch (normaliseProvider(AI_PROVIDER) ?? "LOVABLE") {
    case "OPENAI":
      return { "model:gpt-4o-mini": () => withTimeout(callOpenAI(prompt), AI_TIMEOUT_MS) };
    case "GEMINI":
      return { "model:gemini-2.0-flash": () => withTimeout(callGemini(prompt), AI_TIMEOUT_MS) };
    default:
      return {
        "model:google/gemini-2.0-flash": () => withTimeout(callLovable(prompt), AI_TIMEOUT_MS),
      };
  }
}

async function callLovable(prompt: string): Promise<ExecutorOutput> {
  try {
    const res = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash",
          messages: [{ role: "user", content: prompt }],
        }),
      }
    );

    const json = await res.json();
    console.log('Lovable Response:', JSON.stringify(json));
    
    if (!res.ok) {
      throw new Error(`Lovable API error: ${res.status} - ${JSON.stringify(json)}`);
    }
    
    return { raw: parseJsonLoose(json.choices?.[0]?.message?.content), usage: openAiUsage(json) };
  } catch (error) {
    console.log('Lovable Error:', error);
    throw error;
  }
}

async function callOpenAI(prompt: string): Promise<ExecutorOutput> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const json = await res.json();
    console.log('OpenAI Response:', JSON.stringify(json));
    
    if (!res.ok) {
      throw new Error(`OpenAI API error: ${res.status} - ${JSON.stringify(json)}`);
    }
    
    return { raw: parseJsonLoose(json.choices?.[0]?.message?.content), usage: openAiUsage(json) };
  } catch (error) {
    console.log('OpenAI Error:', error);
    throw error;
  }
}

async function callGemini(prompt: string): Promise<ExecutorOutput> {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    const json = await res.json();
    console.log('Gemini Response:', JSON.stringify(json));
    
    if (!res.ok) {
      throw new Error(`Gemini API error: ${res.status} - ${JSON.stringify(json)}`);
    }
    
    return {
      raw: parseJsonLoose(json.candidates?.[0]?.content?.parts?.[0]?.text),
      usage: geminiUsage(json),
    };
  } catch (error) {
    console.log('Gemini Error:', error);
    throw error;
  }
}

// ----------------------------------------------------
// Entity Resolution
// ----------------------------------------------------

async function resolveEntities(ai: any, orgId: string) {
  // Fetch org entities in parallel — now includes members for person resolution
  const [spacesRes, teamsRes, groupsRes, membersRes] = await Promise.all([
    supabase.from("spaces").select("id,name").eq("org_id", orgId),
    supabase.from("teams").select("id,name").eq("org_id", orgId),
    supabase.from("themes").select("id,name").eq("org_id", orgId).eq("type", "group"),
    supabase.from("organisation_members").select("id,user_id,role").eq("org_id", orgId),
  ]);

  // Build person list: enrich member rows with display names from auth.users
  let membersList: Array<{ id: string; name: string }> = [];
  const memberRows = membersRes.data || [];
  if (memberRows.length > 0) {
    const userIds = memberRows.map((m: any) => m.user_id);
    const { data: usersInfo } = await supabase.rpc("get_users_info", { user_ids: userIds });
    membersList = (usersInfo || []).map((u: any) => ({
      id: u.id,
      name: u.nickname || u.email || u.id,
    }));
  }

  // Helper to normalize assets array (handle both string[] and object[] formats)
  const normalizeAssets = (assets: any[]): Array<{ name: string; authority?: number }> => {
    if (!assets || assets.length === 0) return [];
    return assets.map((item: any) => {
      if (typeof item === 'string') {
        return { name: item, authority: 0.5 }; // Default medium authority for string assets
      }
      return { name: item.name || String(item), authority: item.authority };
    });
  };

  return {
    title: ai.title,
    priority: ai.priority,
    date: ai.date,
    yes_no: ai.yes_no,
    signature: ai.signature,
    assets: normalizeAssets(ai.assets || []),

    spaces: matchWithAuthority(ai.spaces || [], spacesRes.data || []),
    people: matchWithAuthority(ai.people || [], membersList),
    teams: matchWithAuthority(ai.teams || [], teamsRes.data || []),
    groups: matchWithAuthority(ai.groups || [], groupsRes.data || []),
    themes: (ai.themes || []).map((t: any) => ({
      name: typeof t === 'string' ? t : t.name,
      exists: false,
      type: typeof t === 'object' ? (t.type || 'category') : 'category',
      authority: typeof t === 'object' ? (t.authority ?? 0.5) : 0.5,
    })),
  };
}

function matchWithAuthority(list: any[] = [], existing: any[] = []) {
  return list.map((item: any) => {
    // Handle both string and object formats
    const name = typeof item === 'string' ? item : item.name;
    const authority = typeof item === 'object' ? (item.authority ?? 0.5) : 0.5;
    
    const found = existing.find(
      (e) => e.name.toLowerCase() === name.toLowerCase()
    );
    return found
      ? { name, exists: true, id: found.id, authority }
      : { name, exists: false, authority };
  });
}

// ----------------------------------------------------
// Rule-Based Fallback
// ----------------------------------------------------

function ruleBased(text: string) {
  const lower = text.toLowerCase();
  const priority = lower.includes("leak") ? "urgent" : "medium";

  return {
    title: text.slice(0, 50),
    spaces: [],
    people: [],
    teams: [],
    groups: [],
    assets: [],
    themes: [],
    priority,
    date: "",
    yes_no: false,
    signature: false,
  };
}

function emptyResult() {
  return {
    title: "",
    spaces: [],
    people: [],
    teams: [],
    groups: [],
    assets: [],
    themes: [],
    priority: "medium",
    date: "",
    yes_no: false,
    signature: false,
  };
}

// ----------------------------------------------------
// Helpers
// ----------------------------------------------------

const jsonOK = (data: any) =>
  new Response(JSON.stringify({ ok: true, combined: data }), {
    headers: corsHeaders,
  });

const jsonErr = (msg: string, status = 400) =>
  new Response(JSON.stringify({ ok: false, error: msg }), {
    status,
    headers: corsHeaders,
  });

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new TimeoutError());
    }, ms);
    
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((err) => {
        clearTimeout(t); // Clear timeout on rejection too
        reject(err);
      });
  });
}
