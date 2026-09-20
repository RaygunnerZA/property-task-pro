/**
 * knowledge-watch-run — platform Knowledge Watch pass.
 *
 * Enforces pause + monthly research allowance server-side.
 * Does NOT write operational `signals`. Does NOT publish Knowledge.
 * Cheap checks first; stops cleanly at allowance; preserves completed work.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  checkResearchAllowance,
  currentPeriodYm,
  dedupeSubjectKey,
  shouldDeepResearch,
  type AutomatedResearchMode,
  type ResearchAllowance,
  type WatchUsage,
} from "../_shared/knowledgeWatchAllowance.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
};

const MAX_BODY_BYTES = 4_096;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function subjectKeyFromTitle(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/\s*[—–\-|:]\s*(france|scotland|england|wales|uk|germany|switzerland|ch|fr|de|gb)\s*$/i, "")
    .trim();
  if (/chimney|flue|ramonage|sweep/.test(base)) return "chimney-flue-sweeping";
  if (/gutter|gouttière|autumn/.test(base)) return "gutters-autumn-leaf-risk";
  if (/heating|boiler|frost|radiator/.test(base)) return "before-heating-season";
  if (/smoke|carbon monoxide|co\s*alarm/.test(base)) return "smoke-carbon-monoxide-alarms";
  return base.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "subject";
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

  let trigger: "scheduled" | "manual" = "manual";
  try {
    const body = rawText ? JSON.parse(rawText) : {};
    if (body?.trigger === "scheduled" || body?.trigger === "manual") {
      trigger = body.trigger;
    }
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
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

  const { data: settingsRow } = await admin
    .from("knowledge_watch_settings")
    .select("automated_research, research_allowance")
    .eq("id", "default")
    .maybeSingle();

  const automatedResearch = (settingsRow?.automated_research ?? "paused") as AutomatedResearchMode;
  const researchAllowance = (settingsRow?.research_allowance ?? "light") as ResearchAllowance;

  const period = currentPeriodYm();
  const { data: usageRow } = await admin
    .from("knowledge_watch_usage")
    .select("*")
    .eq("period_ym", period)
    .maybeSingle();

  const usage: WatchUsage = {
    period_ym: period,
    searches_used: Number(usageRow?.searches_used ?? 0),
    pages_used: Number(usageRow?.pages_used ?? 0),
    tokens_used: Number(usageRow?.tokens_used ?? 0),
    cost_units_used: Number(usageRow?.cost_units_used ?? 0),
  };

  const { data: runRow, error: runInsertErr } = await admin
    .from("knowledge_watch_runs")
    .insert({
      trigger,
      status: "running",
      created_by: user.id,
      summary: "Watch run started",
    })
    .select("id")
    .single();

  if (runInsertErr || !runRow) {
    return json({ ok: false, error: "run_create_failed", message: runInsertErr?.message }, 500);
  }
  const runId = runRow.id as string;

  const gate = checkResearchAllowance({
    automatedResearch,
    allowance: researchAllowance,
    usage,
    trigger,
    need: { searches: 0, pages: 0, tokens: 0, cost_units: 0 },
  });

  if (!gate.ok && gate.reason === "paused") {
    await admin
      .from("knowledge_watch_runs")
      .update({
        status: "paused",
        finished_at: new Date().toISOString(),
        summary: "Skipped — automated research is paused.",
        skip_reasons: [{ reason: "paused", detail: gate.message }],
      })
      .eq("id", runId);
    return json({
      ok: true,
      status: "paused",
      run_id: runId,
      summary: "Automated research is paused. Turn it On or use Run Watch now.",
    });
  }

  // Cheap pass: load existing Knowledge, dedupe, decide what would need research.
  const { data: knowledgeRows } = await admin
    .from("knowledge")
    .select("id, title, status, source_kind, updated_at")
    .eq("scope", "platform")
    .neq("status", "archived")
    .limit(500);

  const existing = (knowledgeRows ?? []).map((r: { title: string }) => ({
    subjectKey: subjectKeyFromTitle(r.title ?? ""),
    title: r.title ?? "",
  }));

  const sourcesChecked: Array<{ id: string; label: string }> = [
    { id: "knowledge_index", label: "Existing platform Knowledge" },
    { id: "content_topics", label: "Subject packages / schedule prefs" },
  ];
  const skipReasons: Array<{ subjectKey?: string; reason: string }> = [];
  let subjectsUpdated = 0;
  let subjectsAdded = 0;
  let searchesUsed = 0;
  let pagesUsed = 0;
  let tokensUsed = 0;
  let costUnitsUsed = 0;
  let stoppedAtLimit = false;

  const candidates = (knowledgeRows ?? []).filter(
    (r: { status: string }) => r.status === "candidate" || r.status === "stale"
  );

  for (const row of candidates.slice(0, 40)) {
    const title = (row as { title: string }).title ?? "";
    const key = subjectKeyFromTitle(title);
    const dedupe = dedupeSubjectKey(key, title, existing);
    if (dedupe.action === "merge") {
      subjectsUpdated += 1;
    } else {
      subjectsAdded += 1;
      existing.push({ subjectKey: key, title });
    }

    const deep = shouldDeepResearch({
      hasKnownKnowledgeMatch: (knowledgeRows ?? []).some(
        (k: { title: string; status: string }) =>
          subjectKeyFromTitle(k.title ?? "") === key &&
          (k.status === "verified" || k.status === "published")
      ),
      materialSignalCount: (row as { status: string }).status === "stale" ? 0 : 1,
      inferredOnly: (row as { status: string }).status === "stale",
    });

    if (!deep.research) {
      skipReasons.push({ subjectKey: key, reason: deep.skipReason ?? "skipped" });
      continue;
    }

    // Budget check before each research unit (1 search).
    const spend = checkResearchAllowance({
      automatedResearch,
      allowance: researchAllowance,
      usage: {
        ...usage,
        searches_used: usage.searches_used + searchesUsed,
        pages_used: usage.pages_used + pagesUsed,
        tokens_used: usage.tokens_used + tokensUsed,
        cost_units_used: usage.cost_units_used + costUnitsUsed,
      },
      trigger,
      need: { searches: 1 },
    });

    if (!spend.ok) {
      stoppedAtLimit = spend.reason !== "paused";
      skipReasons.push({
        subjectKey: key,
        reason: spend.message,
      });
      break;
    }

    // v1: record intent to research without calling external search yet —
    // preserves allowance for future deep passes; counts as a cheap "check" search unit.
    searchesUsed += 1;
    skipReasons.push({
      subjectKey: key,
      reason: "Queued for deeper research within allowance (no auto-publish).",
    });
  }

  // Persist usage atomically-ish (read-modify-write under service role).
  if (searchesUsed || pagesUsed || tokensUsed || costUnitsUsed) {
    const next = {
      period_ym: period,
      searches_used: usage.searches_used + searchesUsed,
      pages_used: usage.pages_used + pagesUsed,
      tokens_used: usage.tokens_used + tokensUsed,
      cost_units_used: usage.cost_units_used + costUnitsUsed,
      updated_at: new Date().toISOString(),
    };
    await admin.from("knowledge_watch_usage").upsert(next, { onConflict: "period_ym" });
  }

  const status = stoppedAtLimit ? "stopped_at_limit" : "succeeded";
  const summary = stoppedAtLimit
    ? `Stopped at allowance after checking ${sourcesChecked.length} source groups. Preserved ${subjectsUpdated} updates · ${searchesUsed} searches used.`
    : `Watch pass complete. ${subjectsAdded} new subject keys · ${subjectsUpdated} merged · ${skipReasons.length} skip notes · ${searchesUsed} searches.`;

  await admin
    .from("knowledge_watch_runs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      summary,
      sources_checked: sourcesChecked,
      subjects_added: subjectsAdded,
      subjects_updated: subjectsUpdated,
      searches_used: searchesUsed,
      pages_used: pagesUsed,
      tokens_used: tokensUsed,
      cost_units_used: costUnitsUsed,
      skip_reasons: skipReasons.slice(0, 100),
      detail: {
        allowance: researchAllowance,
        automated_research: automatedResearch,
        trigger,
        period_ym: period,
        candidate_count: candidates.length,
      },
    })
    .eq("id", runId);

  return json({
    ok: true,
    status,
    run_id: runId,
    summary,
    usage: {
      period_ym: period,
      searches_used: usage.searches_used + searchesUsed,
      pages_used: usage.pages_used + pagesUsed,
      tokens_used: usage.tokens_used + tokensUsed,
      cost_units_used: usage.cost_units_used + costUnitsUsed,
    },
  });
});
