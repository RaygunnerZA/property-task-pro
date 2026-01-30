// ai-extract — Semantic Task Extraction Engine with Provider Switch & Ghost-Chip Resolution

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
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
    let ai;
    try {
      ai = await withTimeout(callAI(description), 9000); // 9s timeout
      console.log('AI extraction successful:', JSON.stringify(ai));
    } catch (error) {
      console.log('AI extraction error, falling back to rule-based:', error);
      ai = ruleBased(description);
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

async function callAI(description: string) {
  const prompt = buildPrompt(description);

  switch (AI_PROVIDER) {
    case "LOVABLE":
      return callLovable(prompt);
    case "OPENAI":
      return callOpenAI(prompt);
    case "GEMINI":
      return callGemini(prompt);
    default:
      throw new Error("Unknown AI_PROVIDER");
  }
}

async function callLovable(prompt: string) {
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
    
    return JSON.parse(json.choices[0].message.content);
  } catch (error) {
    console.log('Lovable Error:', error);
    throw error;
  }
}

async function callOpenAI(prompt: string) {
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
    
    return JSON.parse(json.choices[0].message.content);
  } catch (error) {
    console.log('OpenAI Error:', error);
    throw error;
  }
}

async function callGemini(prompt: string) {
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
    
    return JSON.parse(json.candidates[0].content.parts[0].text);
  } catch (error) {
    console.log('Gemini Error:', error);
    throw error;
  }
}

// ----------------------------------------------------
// Prompt
// ----------------------------------------------------

function buildPrompt(description: string) {
  return `
You are a task extraction AI. Extract structured metadata from task descriptions with high accuracy.

CONTEXT UNDERSTANDING:
- "fix toilet" → space: "Bathroom" or "Restroom"
- "dirt" or "cleaning" → theme: "Housekeeping" (type: "category")
- "leak" or "broken" → priority: "urgent"
- "Tuesday" or "tomorrow" → date: parse to ISO format
- Person names (e.g., "Frank", "John") → people: explicit mention
- Role references (e.g., "the cleaner", "maintenance") → people: role-based inference
- Team names (e.g., "Maintenance Team", "Housekeeping") → teams
- Asset names (e.g., "HVAC Unit A", "Stove") → assets

AUTHORITY SCORING (0-1) - Be precise:
- Explicit name mentioned (e.g., "Frank", "Kitchen", "HVAC Unit A") → 0.9-1.0 (High confidence)
- Role-based inference (e.g., "the cleaner", "maintenance staff") → 0.5-0.8 (Medium confidence)
- Ambiguous or weak inference → 0.3-0.5 (Low confidence)
- Uncertain or missing → 0.0-0.3 (Very Low - only include if context strongly suggests)

TITLE GENERATION:
- Create a concise, actionable title (3-8 words)
- Use imperative mood when appropriate (e.g., "Fix leak in kitchen")
- Capitalize first letter only
- No trailing punctuation
- Be specific but brief

PRIORITY DETECTION:
- "urgent", "asap", "emergency", "critical" → "urgent"
- "important", "high priority" → "high"
- "normal", "standard" → "medium"
- "low priority", "whenever" → "low"
- Default: "medium"

DATE PARSING:
- Relative: "today", "tomorrow", "next week" → parse to ISO date
- Absolute: "Tuesday", "Jan 15", "2026-01-15" → parse to ISO date
- Time: "9am", "morning", "afternoon" → include in date if mentioned
- Empty string if no date mentioned

THEMES:
- Type can be: "category", "project", "tag", "group"
- Common categories: "Maintenance", "Housekeeping", "Inspection", "Compliance", "Administrative"
- Infer from context (e.g., "fix" → "Maintenance", "clean" → "Housekeeping")

Return ONLY valid JSON (no markdown, no code blocks):

{
  "title": "Concise actionable title",
  "spaces": [{"name": "Kitchen", "authority": 0.9}],
  "people": [{"name": "Frank", "authority": 1.0}, {"name": "the cleaner", "authority": 0.6}],
  "teams": [{"name": "Maintenance Team", "authority": 0.8}],
  "groups": [],
  "assets": [{"name": "HVAC Unit A", "authority": 0.95}],
  "themes": [{"name": "Maintenance", "type": "category", "authority": 0.7}],
  "priority": "low|medium|high|urgent",
  "date": "ISO date string or empty",
  "yes_no": false,
  "signature": false
}

DESCRIPTION:
${description}
`;
}

// ----------------------------------------------------
// Entity Resolution
// ----------------------------------------------------

async function resolveEntities(ai: any, orgId: string) {
  const [spacesRes, teamsRes, groupsRes] = await Promise.all([
    supabase.from("spaces").select("id,name").eq("org_id", orgId),
    supabase.from("teams").select("id,name").eq("org_id", orgId),
    supabase.from("groups").select("id,name").eq("org_id", orgId),
  ]);

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
    people: matchWithAuthority(ai.people || [], []), // People resolution handled in frontend
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
  let priority = lower.includes("leak") ? "urgent" : "medium";

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
      reject(new Error("Timeout"));
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
