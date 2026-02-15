/**
 * assistant-intent — Phase 14 FILLA Assistant Mode
 * Pure rule-based classifier. No DB fetches. No org data. No LLM/OpenAI/Gemini.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Intent =
  | "query"
  | "summarise"
  | "risk"
  | "graph"
  | "recommend"
  | "predictive"
  | "create_task"
  | "link"
  | "unknown";

interface Input {
  query: string;
  context?: { type: string | null; id: string | null };
  org_id: string;
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function classifyIntent(query: string): Intent {
  const q = query.toLowerCase().trim();
  if (!q) return "unknown";

  const patterns: Array<{ re: RegExp; intent: Intent }> = [
    { re: /\b(create|add|new)\s+(a\s+)?task\b/i, intent: "create_task" },
    { re: /\blink\b|\bconnect\b|\battach\b.*\b(compliance|document)\b/i, intent: "link" },
    { re: /\brisk\b|\bexposure\b|\bhazard\b|\bdanger\b/i, intent: "risk" },
    { re: /\bsummarise\b|\bsummary\b|\bsummarize\b|\boverview\b|\bwhat('s| is)\s+here\b/i, intent: "summarise" },
    { re: /\bgraph\b|\bconnected\b|\bshow\s+me\s+(everything\s+)?(connected|linked)\b|\bconnections\b/i, intent: "graph" },
    { re: /\brecommend\b|\bwhat\s+should\b|\bsuggest\b|\badvice\b/i, intent: "recommend" },
    { re: /\bpredictive\b|\bfail\s+soon\b|\bmight\s+fail\b|\bwhat\s+might\s+fail\b/i, intent: "predictive" },
    { re: /\bquery\b|\bwhat\b|\bwhere\b|\bwhich\b|\bhow\s+many\b/i, intent: "query" },
  ];

  for (const { re, intent } of patterns) {
    if (re.test(q)) return intent;
  }

  return "unknown";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "POST only" }, 405);

  let body: Input;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }

  const { query, context, org_id: orgId } = body;
  if (!orgId || typeof query !== "string") {
    return jsonResponse({ ok: false, error: "org_id and query required" }, 400);
  }

  const intent = classifyIntent(query);
  const requiresAction = intent === "create_task" || intent === "link";

  const target = context?.type && context?.id
    ? { type: context.type, id: context.id }
    : null;

  return jsonResponse({
    ok: true,
    intent,
    requires_action: requiresAction,
    filters: {},
    target,
  });
});
