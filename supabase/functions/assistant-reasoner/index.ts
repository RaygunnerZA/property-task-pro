/**
 * assistant-reasoner — Phase 14 FILLA Assistant Mode
 * Handles intent classification + reasoning in one function.
 * Accepts { query, context?, org_id }; computes intent internally.
 *
 * Resilience contract:
 * - Individual data-source failures are caught and skipped; they never kill the response.
 * - The function ALWAYS returns HTTP 200. Errors are surfaced as { ok: false, error }.
 *   Returning 5xx causes supabase.functions.invoke() to throw "non-2xx" which is
 *   meaningless to the user. Returning 200 lets useAssistant display the actual message.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const intentToCalls: Record<string, string[]> = {
  summarise: ["tasks", "compliance", "assets"],
  query: ["tasks", "graph"],
  risk: ["graph-insight", "compliance"],
  recommend: ["compliance"],
  predictive: ["filla-brain-infer"],
  graph: ["graph"],
  create_task: [],
  link: [],
  unknown: ["tasks", "compliance", "assets"],
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

function buildTaskFollowUp(filteredCount: number, queryLower: string) {
  if (filteredCount === 0) {
    return "Try: show open tasks, overdue tasks, or high priority tasks.";
  }
  if (/\boverdue\b|\bpast due\b|\blate\b/.test(queryLower)) {
    return "You can ask: show only unassigned overdue tasks.";
  }
  if (/\bhigh priority\b|\burgent\b|\bcritical\b/.test(queryLower)) {
    return "You can ask: split these into overdue vs due this week.";
  }
  if (/\bcompleted\b|\bdone\b|\bfinished\b/.test(queryLower)) {
    return "You can ask: compare completed vs active by property.";
  }
  return "You can ask: which of these are overdue?";
}

function formatPriority(priority: string | null) {
  if (!priority) return "normal";
  const p = priority.toLowerCase();
  if (p === "urgent") return "urgent";
  if (p === "high") return "high";
  if (p === "medium") return "normal";
  if (p === "low") return "low";
  return p;
}

function formatDueLabel(value: string | null) {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  const hasTime = value.includes("T");
  const time = hasTime
    ? ` ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date)}`
    : "";

  if (diffDays === 0) return `Today${time}`;
  if (diffDays === 1) return `Tomorrow${time}`;
  if (diffDays > 1 && diffDays <= 7) {
    const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(date);
    return `${weekday}${time}`;
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    ...(hasTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  }).format(date);
}

function buildPropertyScopeFollowUp(
  target: { type: string; id: string } | null,
  queryLower: string,
  taskRows: Array<{ property_id: string | null; property_name: string | null }>
) {
  if (target?.type === "property") {
    return "I can keep drilling into this property - for example: 'show overdue tasks here' or 'show unassigned tasks here'.";
  }

  const distinctProperties = new Set(
    taskRows
      .filter((t) => t.property_id)
      .map((t) => t.property_name || t.property_id || "unknown")
  ).size;

  const asksProperty = /\bproperty\b|\bbuilding\b|\bsite\b/.test(queryLower);
  if (distinctProperties > 1 || asksProperty) {
    return "Do you want this across all properties, or should I focus on one property?";
  }

  return "";
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

interface ReasonerInput {
  query: string;
  context?: { type: string | null; id: string | null } | null;
  org_id: string;
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

/** Call a sibling edge function. Returns null (and logs) on failure instead of throwing. */
async function invokeFunction(
  baseUrl: string,
  serviceKey: string,
  name: string,
  body: unknown
): Promise<unknown | null> {
  try {
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
      console.error(`[assistant-reasoner] ${name} returned ${res.status}: ${text}`);
      return null;
    }
    return res.json();
  } catch (err) {
    console.error(`[assistant-reasoner] ${name} threw:`, err);
    return null;
  }
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

  const { query, context, org_id: orgId, intent: intentOverride, target: targetOverride } = body;
  if (!orgId || typeof query !== "string") {
    return jsonResponse({ ok: false, error: "org_id and query required" }, 400);
  }

  const intent = (intentOverride as Intent) ?? classifyIntent(query);
  const target = targetOverride ?? (context?.type && context?.id ? { type: context.type, id: context.id } : null);
  const telemetry: {
    graphAttempted: boolean;
    graphNodesCount: number | null;
    graphInsightAttempted: boolean;
    hazardExposure: number | null;
    tasksCount: number | null;
    taskMatchesCount: number | null;
    complianceCount: number | null;
    assetsCount: number | null;
  } = {
    graphAttempted: false,
    graphNodesCount: null,
    graphInsightAttempted: false,
    hazardExposure: null,
    tasksCount: null,
    taskMatchesCount: null,
    complianceCount: null,
    assetsCount: null,
  };

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5837fa'},body:JSON.stringify({sessionId:'5837fa',runId:'pre-fix',hypothesisId:'H2',location:'supabase/functions/assistant-reasoner/index.ts:128',message:'reasoner classified intent',data:{queryLength:query.length,intent,targetType:target?.type ?? null,targetIdPresent:!!target?.id},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ ok: false, error: "Server configuration error" });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Immediate returns for action intents ──────────────────────────────────

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

  // ── Gather data from sources ──────────────────────────────────────────────

  let answer = "";
  const sources: string[] = [];
  const proposedAction: { type: string; payload: Record<string, unknown> } | null = null;
  const calls = intentToCalls[intent] ?? intentToCalls.unknown;
  const queryLower = query.toLowerCase();

  // Predictive gate: check org settings
  if (intent === "predictive") {
    try {
      const { data: settings } = await supabase
        .from("org_settings")
        .select("automated_intelligence, data_sharing_level")
        .eq("org_id", orgId)
        .maybeSingle();
      if (
        settings?.automated_intelligence === "off" ||
        settings?.data_sharing_level === "minimal"
      ) {
        return jsonResponse({
          ok: true,
          answer: "Predictive insights are disabled for this organisation.",
          sources: [],
          proposed_action: null,
        });
      }
    } catch (err) {
      console.error("[assistant-reasoner] org_settings query failed:", err);
    }
  }

  // Graph query (only when we have a starting entity)
  if (calls.includes("graph") && target) {
    telemetry.graphAttempted = true;
    const data = await invokeFunction(supabaseUrl, serviceKey, "graph-query", {
      org_id: orgId,
      start: target,
      depth: intent === "graph" ? 2 : 3,
    }) as { ok?: boolean; nodes?: Array<{ type: string; name?: string }> } | null;
    if (data?.ok && data.nodes) {
      telemetry.graphNodesCount = data.nodes.length;
      sources.push("graph-query");
      const nodeSummary = data.nodes
        .filter((n) => n.type !== target.type)
        .slice(0, 10)
        .map((n) => `${n.type}: ${n.name || n.type}`)
        .join(", ");
      answer += `Connected entities: ${nodeSummary || "none"}.\n`;
    }
  }

  // Tasks portfolio view
  if (calls.includes("tasks")) {
    try {
      type TaskRow = {
        id: string | null;
        title: string | null;
        status: string | null;
        priority: string | null;
        due_date: string | null;
        assigned_user_id: string | null;
        property_id: string | null;
        property_name: string | null;
      };

      const { data: tasks } = await supabase
        .from("tasks_view")
        .select("id, title, status, priority, due_date, assigned_user_id, property_id, property_name")
        .eq("org_id", orgId)
        .order("updated_at", { ascending: false })
        .limit(50);

      const taskRows = (tasks ?? []) as TaskRow[];
      telemetry.tasksCount = taskRows.length;

      const now = new Date();
      const dayMs = 24 * 60 * 60 * 1000;
      const toDaysFromNow = (value: string | null): number | null => {
        if (!value) return null;
        const parsed = Date.parse(value);
        if (Number.isNaN(parsed)) return null;
        return Math.floor((parsed - now.getTime()) / dayMs);
      };

      let filtered = taskRows;
      const asksAboutTaskStatus = /\b(task|tasks|todo|to-do)\b/.test(queryLower);
      const wantsOverdue = /\boverdue\b|\bpast due\b|\blate\b/.test(queryLower);
      const wantsDueSoon = /\bdue soon\b|\bupcoming\b|\bthis week\b|\bnext week\b/.test(queryLower);
      const wantsCompleted = /\bcompleted\b|\bdone\b|\bfinished\b/.test(queryLower);
      const wantsOpen = /\bopen\b|\bin progress\b|\bin_progress\b|\bpending\b/.test(queryLower);
      const wantsHighPriority = /\bhigh priority\b|\burgent\b|\bcritical\b/.test(queryLower);
      const wantsUnassigned = /\bunassigned\b|\bno owner\b/.test(queryLower);
      const wantsImportant = /\bimportant\b|\bpriority\b|\burgent\b|\bcritical\b|\bhigh\b/.test(queryLower);
      const wantsWeekWindow = /\bdue this week\b|\bnext week\b|\bthis week\b|\bnext 7 days\b|\b7 days\b/.test(queryLower);
      const wantsDue = /\bdue\b/.test(queryLower);

      if (target?.type === "property" && target.id) {
        filtered = filtered.filter((t) => t.property_id === target.id);
      }
      if (wantsImportant && wantsWeekWindow) {
        filtered = filtered.filter((t) => {
          const p = (t.priority ?? "").toLowerCase();
          const isImportant = p === "high" || p === "urgent";
          const days = toDaysFromNow(t.due_date);
          const inNextWeek = days !== null && days >= 0 && days <= 7;
          return isImportant && inNextWeek && t.status !== "completed" && t.status !== "archived";
        });
      }
      if (wantsOverdue) {
        filtered = filtered.filter((t) => {
          const days = toDaysFromNow(t.due_date);
          return days !== null && days < 0 && t.status !== "completed" && t.status !== "archived";
        });
      }
      if (wantsDueSoon || (wantsDue && wantsWeekWindow)) {
        filtered = filtered.filter((t) => {
          const days = toDaysFromNow(t.due_date);
          return days !== null && days >= 0 && days <= 14 && t.status !== "completed" && t.status !== "archived";
        });
      }
      if (wantsCompleted) {
        filtered = filtered.filter((t) => t.status === "completed");
      }
      if (wantsOpen) {
        filtered = filtered.filter((t) => t.status === "open" || t.status === "in_progress");
      }
      if (wantsHighPriority) {
        filtered = filtered.filter((t) => {
          const p = (t.priority ?? "").toLowerCase();
          return p === "high" || p === "urgent";
        });
      }
      if (wantsUnassigned) {
        filtered = filtered.filter((t) => !t.assigned_user_id);
      }

      telemetry.taskMatchesCount = filtered.length;

      if (taskRows.length > 0 && (asksAboutTaskStatus || intent === "summarise" || intent === "query" || intent === "unknown")) {
        const statusCounts = taskRows.reduce(
          (acc, t) => {
            const status = (t.status ?? "unknown").toLowerCase();
            acc[status] = (acc[status] ?? 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );

        const openCount = statusCounts.open ?? 0;
        const inProgressCount = statusCounts.in_progress ?? 0;
        const doneCount = statusCounts.completed ?? 0;
        const archivedCount = statusCounts.archived ?? 0;
        const activeCount = openCount + inProgressCount;

        const sample = filtered.slice(0, 5).map((t) => {
          const dueLabel = formatDueLabel(t.due_date);
          const taskTitle = (t.title ?? "Untitled task").replace(/\|/g, "-");
          const detailRef = t.id ? `[See Details](task:${t.id})` : "See Details unavailable";
          return `${taskTitle} | ${dueLabel} | ${detailRef}`;
        });

        if (filtered.length === 0) {
          answer += `No tasks match that right now.\n`;
        } else if (wantsDue && wantsWeekWindow) {
          answer += `The following tasks are due this week:\n`;
        } else if (wantsOverdue) {
          answer += `The following tasks are overdue:\n`;
        } else if (wantsImportant && wantsWeekWindow) {
          answer += `The following important tasks are due in the next week:\n`;
        } else {
          answer += `Here are the most relevant tasks:\n`;
        }

        if (sample.length) {
          answer += `${sample.join("\n")}\n`;
        }

        if (filtered.length > 0) {
          answer += `${buildTaskFollowUp(filtered.length, queryLower)}\n`;
        }
        const hasWidePortfolioContext = target?.type !== "property" && taskRows.some((t) => t.property_id);
        if (hasWidePortfolioContext && filtered.length > 0 && /\bweek\b|\bdue\b|\boverdue\b/.test(queryLower)) {
          answer += `Need one property only? Ask: show this for [property name].\n`;
        }
        sources.push("tasks_view");
      }
    } catch (err) {
      console.error("[assistant-reasoner] tasks_view query failed:", err);
    }
  }

  // Graph insight (only when we have a starting entity)
  if (calls.includes("graph-insight") && target) {
    telemetry.graphInsightAttempted = true;
    const data = await invokeFunction(supabaseUrl, serviceKey, "graph-insight", {
      org_id: orgId,
      start: target,
      depth: 2,
    }) as { ok?: boolean; hazardExposure?: number; complianceInfluence?: number; riskPaths?: string[][] } | null;
    if (data?.ok) {
      telemetry.hazardExposure = data.hazardExposure ?? null;
      sources.push("graph-insight");
      answer += `Hazard exposure: ${data.hazardExposure ?? 0}. Compliance influence: ${data.complianceInfluence ?? 0}.`;
      if (data.riskPaths?.length) {
        answer += ` ${data.riskPaths.length} risk path(s) identified.`;
      }
      answer += "\n";
    }
  }

  // Compliance portfolio view
  if (calls.includes("compliance")) {
    try {
      const { data: compliance } = await supabase
        .from("compliance_portfolio_view")
        .select("id, title, expiry_state, document_type")
        .eq("org_id", orgId)
        .limit(20);
      telemetry.complianceCount = compliance?.length ?? 0;
      if (compliance?.length) {
        sources.push("compliance_portfolio_view");
        const expired = compliance.filter((c) => c.expiry_state === "expired");
        const expiring = compliance.filter((c) => c.expiry_state === "expiring");
        answer += `Compliance: ${compliance.length} items. ${expired.length} expired, ${expiring.length} expiring soon.\n`;
      }
    } catch (err) {
      console.error("[assistant-reasoner] compliance_portfolio_view query failed:", err);
    }
  }

  // Assets view
  if (calls.includes("assets")) {
    try {
      const { data: assets } = await supabase
        .from("assets_view")
        .select("id, name, asset_type")
        .eq("org_id", orgId)
        .limit(20);
      telemetry.assetsCount = assets?.length ?? 0;
      if (assets?.length) {
        sources.push("assets_view");
        answer += `Assets: ${assets.length} in scope.\n`;
      }
    } catch (err) {
      console.error("[assistant-reasoner] assets_view query failed:", err);
    }
  }

  // Filla Brain predictive inference
  if (calls.includes("filla-brain-infer")) {
    try {
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
      const compVecs = (compliance ?? []).map((c) => ({
        document_type: (c.document_type || "").toLowerCase().replace(/\s+/g, "_"),
      })).filter((v) => v.document_type);
      const assetVecs = (assets ?? []).map((a) => ({
        asset_type: a.asset_type,
        condition_score: a.condition_score,
        install_date: a.install_date,
      }));
      const data = await invokeFunction(supabaseUrl, serviceKey, "filla-brain-infer", {
        assets: assetVecs,
        compliance_documents: compVecs,
      }) as { ok?: boolean; predictions?: { assets: Array<{ risk_score?: number }> } } | null;
      if (data?.ok && data.predictions) {
        sources.push("filla-brain-infer");
        const assetRisks = (data.predictions.assets ?? []).slice(0, 3);
        answer += "Predictive insights: ";
        answer += assetRisks.length
          ? assetRisks.map((a) => `risk ${a.risk_score ?? 0}%`).join(", ")
          : "no high-risk assets in sample.";
        answer += "\n";
      }
    } catch (err) {
      console.error("[assistant-reasoner] filla-brain-infer block failed:", err);
    }
  }

  // ── Fallback answer ───────────────────────────────────────────────────────

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5837fa'},body:JSON.stringify({sessionId:'5837fa',runId:'pre-fix',hypothesisId:'H3',location:'supabase/functions/assistant-reasoner/index.ts:326',message:'reasoner pre-fallback state',data:{intent,calls,targetType:target?.type ?? null,answerLength:answer.trim().length,sources,telemetry},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  if (!answer.trim()) {
    answer = "I couldn't find enough data for that yet. Ask me about tasks, compliance, assets, or risk for a specific property, and I'll give you a direct answer.";
  }

  return jsonResponse({
    ok: true,
    answer: answer.trim(),
    sources,
    proposed_action: proposedAction,
  });
});
