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
        combined = {
          title: ai?.title || '',
          priority: ai?.priority || 'medium',
          date: ai?.date || '',
          yes_no: ai?.yes_no || false,
          signature: ai?.signature || false,
          assets: Array.isArray(ai?.assets) ? ai.assets : [],
          spaces: Array.isArray(ai?.spaces) 
            ? ai.spaces.map((n: string) => ({ name: String(n || ''), exists: false })) 
            : [],
          people: Array.isArray(ai?.people) 
            ? ai.people.map((n: string) => ({ name: String(n || ''), exists: false })) 
            : [],
          teams: Array.isArray(ai?.teams) 
            ? ai.teams.map((n: string) => ({ name: String(n || ''), exists: false })) 
            : [],
          groups: Array.isArray(ai?.groups) 
            ? ai.groups.map((n: string) => ({ name: String(n || ''), exists: false })) 
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
Extract structured task metadata. Understand context:

- "fix toilet" → Bathroom
- dirt → Housekeeping
- leak → urgent
- Tuesday → date

Return ONLY JSON:

{
  "title": "",
  "spaces": [],
  "people": [],
  "teams": [],
  "groups": [],
  "assets": [],
  "priority": "low|medium|high|urgent",
  "date": "",
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

  return {
    title: ai.title,
    priority: ai.priority,
    date: ai.date,
    yes_no: ai.yes_no,
    signature: ai.signature,
    assets: ai.assets || [],

    spaces: match(ai.spaces, spacesRes.data || []),
    people: ai.people?.map((n: string) => ({ name: n, exists: false })) || [],
    teams: match(ai.teams, teamsRes.data || []),
    groups: match(ai.groups, groupsRes.data || []),
  };
}

function match(list: string[] = [], existing: any[] = []) {
  return list.map((name) => {
    const found = existing.find(
      (e) => e.name.toLowerCase() === name.toLowerCase()
    );
    return found
      ? { name, exists: true, id: found.id }
      : { name, exists: false };
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
