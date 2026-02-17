/**
 * assistant-reasoner — Phase 14 FILLA Assistant Mode
 * Handles intent classification + reasoning in one function.
 * Accepts { query, context?, org_id }; computes intent internally.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const intentToCalls: Record<string, string[]> = {
  summarise: ["compliance", "assets"],
  query: ["graph"],
  risk: ["graph-insight", "compliance"],
  recommend: ["compliance"],
  predictive: ["filla-brain-infer"],
  graph: ["graph"],
  create_task: [],
  link: [],
  unknown: ["compliance"],
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

interface ReasonerInput {
  query: string;
  context?: { type: string | null; id: string | null } | null;
  org_id: string;
  /** Legacy: if provided, use instead of classifying from query */
  intent?: string;
  target?: { type: string; id: string } | null;
  filters?: Record<string, unknown>;
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function invokeFunction(
  baseUrl: string,
  serviceKey: string,
  name: string,
  body: unknown
): Promise<unknown> {
  const res = await fetch(`${baseUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${name}: ${text}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "POST only" }, 405);

  let body: ReasonerInput;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }

  const { query, context, org_id: orgId, intent: intentOverride, target: targetOverride, filters: filtersOverride } = body;
  if (!orgId || typeof query !== "string") {
    return jsonResponse({ ok: false, error: "org_id and query required" }, 400);
  }

  const intent = (intentOverride as Intent) ?? classifyIntent(query);
  const target = targetOverride ?? (context?.type && context?.id ? { type: context.type, id: context.id } : null);
  const filters = filtersOverride ?? {};

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const start = target || (context?.type && context?.id ? { type: context.type, id: context.id } : null);
    const calls = intentToCalls[intent] ?? intentToCalls.unknown;

    let answer = "";
    const sources: string[] = [];

    if (intent === "create_task") {
      const propId = context?.type === "property" ? context.id : null;
      return jsonResponse({
        ok: true,
        answer: "I can create a task for you. Please confirm to proceed.",
        sources: [],
        proposed_action: {
          type: "task",
          payload: {
            title: query.trim() || "New task",
            property_id: propId,
            space_ids: [],
            priority: "medium",
            description: null,
          },
        },
      });
    }

    if (intent === "link") {
      const attachmentId = context?.type === "document" ? context.id : null;
      return jsonResponse({
        ok: true,
        answer: "I can link this document to a compliance item. Please select the compliance document and confirm.",
        sources: [],
        proposed_action: attachmentId
          ? { type: "link", payload: { attachment_id: attachmentId, compliance_document_id: null } }
          : null,
      });
    }

    if (intent === "predictive") {
      const { data: settings } = await supabase
        .from("org_settings")
        .select("automated_intelligence, data_sharing_level")
        .eq("org_id", orgId)
        .maybeSingle();
      if (settings?.automated_intelligence === "off" || settings?.data_sharing_level === "minimal") {
        return jsonResponse({
          ok: true,
          answer: "Predictive insights are disabled for this organisation.",
          sources: [],
          proposed_action: null,
        });
      }
    }

    if (calls.includes("graph") && start) {
      const data = await invokeFunction(supabaseUrl, serviceKey, "graph-query", {
        org_id: orgId,
        start,
        depth: intent === "graph" ? 2 : 3,
      }) as { ok?: boolean; nodes?: Array<{ type: string; name?: string }>; edges?: unknown[] };
      if (data?.ok && data.nodes) {
        sources.push("graph-query");
        const nodeSummary = data.nodes
          .filter((n) => n.type !== start.type)
          .slice(0, 10)
          .map((n) => `${n.type}: ${n.name || n.type}`)
          .join(", ");
        answer += `Connected entities: ${nodeSummary || "none"}.\n`;
      }
    }

    if (calls.includes("graph-insight") && start) {
      const data = await invokeFunction(supabaseUrl, serviceKey, "graph-insight", {
        org_id: orgId,
        start,
        depth: 2,
      }) as { ok?: boolean; hazardExposure?: number; complianceInfluence?: number; riskPaths?: string[][] };
      if (data?.ok) {
        sources.push("graph-insight");
        answer += `Hazard exposure: ${data.hazardExposure ?? 0}. Compliance influence: ${data.complianceInfluence ?? 0}.`;
        if (data.riskPaths?.length) {
          answer += ` ${data.riskPaths.length} risk path(s) identified.`;
        }
        answer += "\n";
      }
    }

    if (calls.includes("compliance")) {
      const { data: compliance } = await supabase
        .from("compliance_portfolio_view")
        .select("id, title, expiry_state, document_type")
        .eq("org_id", orgId)
        .limit(20);
      if (compliance?.length) {
        sources.push("compliance_portfolio_view");
        const expired = compliance.filter((c: { expiry_state?: string }) => c.expiry_state === "expired");
        const expiring = compliance.filter((c: { expiry_state?: string }) => c.expiry_state === "expiring");
        answer += `Compliance: ${compliance.length} items. ${expired.length} expired, ${expiring.length} expiring soon.\n`;
      }
    }

    if (calls.includes("assets")) {
      const { data: assets } = await supabase
        .from("assets_view")
        .select("id, name, asset_type")
        .eq("org_id", orgId)
        .limit(20);
      if (assets?.length) {
        sources.push("assets_view");
        answer += `Assets: ${assets.length} in scope.\n`;
      }
    }

    if (calls.includes("filla-brain-infer")) {
      const { data: compliance } = await supabase
        .from("compliance_portfolio_view")
        .select("document_type")
        .eq("org_id", orgId)
        .limit(5);
      const { data: assets } = await supabase
        .from("assets_view")
        .select("asset_type, condition_score, install_date")
        .eq("org_id", orgId)
        .limit(5);
      const compVecs = (compliance ?? []).map((c: { document_type?: string }) => ({
        document_type: (c.document_type || "").toLowerCase().replace(/\s+/g, "_"),
      })).filter((v: { document_type: string }) => v.document_type);
      const assetVecs = (assets ?? []).map((a: { asset_type?: string; condition_score?: number; install_date?: string }) => ({
        asset_type: a.asset_type,
        condition_score: a.condition_score,
        install_date: a.install_date,
      }));
      const data = await invokeFunction(supabaseUrl, serviceKey, "filla-brain-infer", {
        assets: assetVecs,
        compliance_documents: compVecs,
      }) as { ok?: boolean; predictions?: { assets: unknown[]; compliance: unknown[] } };
      if (data?.ok && data.predictions) {
        sources.push("filla-brain-infer");
        const preds = data.predictions;
        const assetRisks = (preds.assets ?? []).slice(0, 3);
        answer += "Predictive insights: ";
        if (assetRisks.length) {
          answer += assetRisks.map((a: { risk_score?: number }) => `risk ${a.risk_score ?? 0}%`).join(", ");
        } else {
          answer += "no high-risk assets in sample.";
        }
        answer += "\n";
      }
    }

    if (!answer.trim()) {
      answer = "No data available for this query.";
    }

    return jsonResponse({
      ok: true,
      answer: answer.trim(),
      sources,
      proposed_action: null,
    });
  } catch (err: unknown) {
    console.error("assistant-reasoner error:", err);
    return jsonResponse(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      500
    );
  }
});
