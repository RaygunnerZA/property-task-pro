/**
 * knowledge-discovery — Discovery process + Community Knowledge promotion.
 * Observes operational data → org candidates.
 * Extends Filla Brain patterns → platform community candidates (cohort-gated).
 * Never writes tasks/compliance/records. Never auto-publishes.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BRAIN_MIN_COHORT } from "../_shared/brainMinCohort.ts";
import { logAiRequest } from "../_shared/aiObservability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const THEME_KEYWORDS: Array<{ label: string; re: RegExp }> = [
  { label: "plumbing", re: /plumb|leak|pipe|drain|water damage/i },
  { label: "electrical", re: /electr|wiring|fuse|socket|power/i },
  { label: "hvac", re: /hvac|heating|boiler|ventilat|air.?con/i },
  { label: "roof", re: /roof|gutter|flashing/i },
];

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "POST only" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return jsonResponse({ ok: false, error: "Service role not configured" }, 500);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const body = await req.json().catch(() => ({}));
  const mode = (body.mode as string | undefined) ?? "org";
  const orgId = body.org_id as string | undefined;

  const created: Array<{ id: string; kind: string }> = [];
  const start = Date.now();

  // ── Organisation Discovery ──────────────────────────────────────────────
  if (mode === "org" || mode === "all") {
    const orgIds: string[] = [];
    if (orgId) {
      orgIds.push(orgId);
    } else if (mode === "all") {
      const { data: orgs } = await admin
        .from("organisations")
        .select("id")
        .neq("id", "00000000-0000-0000-0000-000000000000")
        .limit(50);
      for (const o of orgs ?? []) orgIds.push(o.id);
    }

    for (const oid of orgIds) {
      const { data: tasks } = await admin
        .from("tasks")
        .select("id, title, status")
        .eq("org_id", oid)
        .limit(100);

      const openTasks = (tasks ?? []).filter(
        (t) => t.status !== "completed" && t.status !== "archived"
      );

      for (const theme of THEME_KEYWORDS) {
        const hits = openTasks.filter((t) => theme.re.test(t.title ?? ""));
        if (hits.length < 2) continue;

        const title = `Recurring ${theme.label} issues`;
        const { data: existing } = await admin
          .from("knowledge")
          .select("id")
          .eq("org_id", oid)
          .eq("scope", "organisation")
          .eq("source_kind", "operational_discovery")
          .eq("title", title)
          .in("status", ["candidate", "verified", "published"])
          .maybeSingle();
        if (existing) continue;

        const { data: candidate, error } = await admin.rpc("create_knowledge_candidate", {
          p_scope: "organisation",
          p_org_id: oid,
          p_title: title,
          p_summary: `${hits.length} open tasks match recurring ${theme.label} patterns.`,
          p_body:
            `Discovery found ${hits.length} open tasks related to ${theme.label}. ` +
            `Sample: ${hits
              .slice(0, 5)
              .map((h) => h.title)
              .join("; ")}.`,
          p_source_kind: "operational_discovery",
          p_content: {
            theme: theme.label,
            task_ids: hits.slice(0, 20).map((h) => h.id),
            hit_count: hits.length,
          },
          p_provenance: {
            discovery_function: "knowledge-discovery",
            mode: "operational",
          },
          p_cohort_size: null,
          p_trust_score: null,
          p_created_by: null,
        });

        if (!error && candidate?.id) {
          created.push({ id: candidate.id, kind: "operational_discovery" });
          await admin.rpc("record_knowledge_usage", {
            p_event_type: "automation_created",
            p_org_id: oid,
            p_knowledge_id: candidate.id,
            p_estimated_minutes: null,
            p_actor_id: null,
            p_metadata: {
              source: "knowledge-discovery",
              theme: theme.label,
              hit_count: hits.length,
            },
          }).catch(() => undefined);
          fetch(`${supabaseUrl}/functions/v1/knowledge-critic`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              knowledge_id: candidate.id,
              org_id: oid,
              extractor_provider: "DISCOVERY",
            }),
          }).catch(() => undefined);
        }
      }

      logAiRequest(admin, {
        org_id: oid,
        function_name: "knowledge-discovery",
        model_used: "rule-based",
        provider: "local",
        latency_ms: Date.now() - start,
        status: "success",
        entity_type: "organisation",
        entity_id: oid,
        metadata: { mode: "operational" },
      });
    }
  }

  // ── Community candidates from Filla Brain (cohort-gated via RPC) ────────
  if (mode === "community" || mode === "all") {
    type BrainPattern = {
      pattern_kind: string;
      document_type: string | null;
      asset_vector: Record<string, unknown> | null;
      recommended_frequency: string | null;
      risk_level: string | null;
      failure_probability: number | null;
      mean_time_to_failure_days: number | null;
      sample_count: number;
    };

    const { data: patterns, error: patternErr } = await admin.rpc(
      "list_brain_patterns_for_community",
      { p_limit: 20 }
    );
    if (patternErr) {
      console.error("list_brain_patterns_for_community failed:", patternErr.message);
    }

    for (const p of (patterns ?? []) as BrainPattern[]) {
      if ((p.sample_count ?? 0) < BRAIN_MIN_COHORT) continue;

      let title = "";
      let summary = "";
      let body = "";
      let content: Record<string, unknown> = {};
      let brainTable = "";

      if (p.pattern_kind === "compliance") {
        title = `Community pattern: ${String(p.document_type).replace(/_/g, " ")}`;
        summary = `Based on ${p.sample_count} anonymised org patterns. Suggested frequency: ${p.recommended_frequency ?? "unknown"}.`;
        body =
          `Aggregated Filla Brain compliance pattern for document type "${p.document_type}". ` +
          `Risk level signal: ${p.risk_level ?? "low"}. Cohort size: ${p.sample_count}. ` +
          `This candidate must pass critic + platform admin review before publish.`;
        content = {
          document_type: p.document_type,
          recommended_frequency: p.recommended_frequency,
          risk_level: p.risk_level,
        };
        brainTable = "brain_compliance_patterns";
      } else {
        const vec = (p.asset_vector ?? {}) as Record<string, unknown>;
        const assetType = String(vec.asset_type ?? "asset");
        title = `Community pattern: ${assetType.replace(/_/g, " ")} maintenance`;
        summary = `Anonymised cohort of ${p.sample_count}. Mean time-to-failure signal: ${p.mean_time_to_failure_days ?? "n/a"} days.`;
        body =
          `Filla Brain asset pattern for type "${assetType}". ` +
          `Failure probability signal: ${p.failure_probability ?? 0}. ` +
          `Requires critic + admin review. Cohort ${p.sample_count} (≥ ${BRAIN_MIN_COHORT}).`;
        content = { asset_vector: vec };
        brainTable = "brain_asset_patterns";
      }

      const { data: existing } = await admin
        .from("knowledge")
        .select("id")
        .eq("scope", "platform")
        .eq("source_kind", "community_brain")
        .eq("title", title)
        .in("status", ["candidate", "verified", "published"])
        .maybeSingle();
      if (existing) continue;

      const { data: candidate, error } = await admin.rpc("create_knowledge_candidate", {
        p_scope: "platform",
        p_org_id: null,
        p_title: title,
        p_summary: summary,
        p_body: body,
        p_source_kind: "community_brain",
        p_content: content,
        p_provenance: {
          discovery_function: "knowledge-discovery",
          mode: "community_brain",
          brain_table: brainTable,
        },
        p_cohort_size: p.sample_count,
        p_trust_score: null,
        p_created_by: null,
      });

      if (!error && candidate?.id) {
        created.push({ id: candidate.id, kind: "community_brain" });
        fetch(`${supabaseUrl}/functions/v1/knowledge-critic`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            knowledge_id: candidate.id,
            org_id: "00000000-0000-0000-0000-000000000000",
            extractor_provider: "FILLA_BRAIN",
          }),
        }).catch(() => undefined);
      }
    }

    logAiRequest(admin, {
      org_id: "00000000-0000-0000-0000-000000000000",
      function_name: "knowledge-discovery",
      model_used: "filla-brain",
      provider: "local",
      latency_ms: Date.now() - start,
      status: "success",
      entity_type: "platform",
      metadata: { mode: "community", min_cohort: BRAIN_MIN_COHORT },
    });
  }

  return jsonResponse({
    ok: true,
    created_count: created.length,
    created,
    min_cohort: BRAIN_MIN_COHORT,
  });
});
