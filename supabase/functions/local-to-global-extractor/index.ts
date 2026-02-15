/**
 * Phase 11: Local-to-Global Extractor
 * Sends anonymised vectors to Filla Brain. Never sends org IDs, serial numbers, or private data.
 * Triggered: nightly, on asset/compliance change, or when hazards detected.
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FORBIDDEN_KEYS = ["org_id", "property_id", "asset_id", "serial_number", "manufacturer", "model", "contractor", "address", "name", "email", "notes", "file_url", "image_url"];
const FORBIDDEN_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function validateNoPrivateData(obj: unknown): { valid: boolean; reason?: string } {
  const str = JSON.stringify(obj);
  if (FORBIDDEN_PATTERN.test(str)) return { valid: false, reason: "UUID detected" };
  if (typeof obj === "object" && obj !== null) {
    for (const k of Object.keys(obj)) {
      if (FORBIDDEN_KEYS.some((fk) => k.toLowerCase().includes(fk))) {
        return { valid: false, reason: `Forbidden key: ${k}` };
      }
    }
  }
  return { valid: true };
}

function bucketCondition(score: number): string {
  if (score < 30) return "0-30";
  if (score < 60) return "30-60";
  if (score < 80) return "60-80";
  return "80-100";
}

function bucketAge(years: number): string {
  if (years < 2) return "0-2";
  if (years < 5) return "2-5";
  if (years < 10) return "5-10";
  if (years < 15) return "10-15";
  return "15+";
}

function toAssetVector(asset: { asset_type?: string; condition_score?: number; install_date?: string }): Record<string, unknown> {
  const vec: Record<string, unknown> = {};
  if (asset.asset_type) vec.asset_type = String(asset.asset_type).toLowerCase().replace(/\s+/g, "_");
  if (asset.condition_score != null) vec.condition_bucket = bucketCondition(asset.condition_score);
  if (asset.install_date) {
    const years = (Date.now() - new Date(asset.install_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    vec.age_bucket = bucketAge(Math.floor(years));
  }
  return vec;
}

async function extractForOrg(admin: SupabaseClient, orgId: string): Promise<{ assets: number; compliance: number; hazards: number }> {
  const { data: orgSettings } = await admin.from("org_settings").select("data_sharing_level").eq("org_id", orgId).maybeSingle();
  const sharingLevel = orgSettings?.data_sharing_level ?? "standard";
  if (sharingLevel === "minimal") return { assets: 0, compliance: 0, hazards: 0 };

  let assetCount = 0;
  let complianceCount = 0;
  let hazardCount = 0;

  if (sharingLevel !== "minimal") {
    const { data: assets } = await admin.from("assets").select("asset_type, condition_score, install_date").eq("org_id", orgId);
    if (assets) {
      for (const a of assets) {
        const vec = toAssetVector(a);
        if (Object.keys(vec).length === 0) continue;
        const check = validateNoPrivateData(vec);
        if (!check.valid) continue;
        await admin.rpc("brain_ingest_asset_pattern", { p_vector: vec });
        assetCount++;
      }
    }
  }

  if (sharingLevel === "standard" || sharingLevel === "full_anonymised") {
    const { data: docs } = await admin.from("compliance_documents").select("document_type, hazards, expiry_date, next_due_date").eq("org_id", orgId);
    if (docs) {
      for (const d of docs) {
        const due = d.next_due_date || d.expiry_date;
        const driftDays = due ? Math.floor((new Date(due).getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : null;
        const vec = {
          document_type: (d.document_type || "unknown").toLowerCase().replace(/\s+/g, "_"),
          expiry_state: driftDays === null ? "unknown" : driftDays < 0 ? "expired" : driftDays <= 30 ? "expiring" : "valid",
          drift_days: driftDays,
          hazards: Array.isArray(d.hazards) ? d.hazards : [],
        };
        const check = validateNoPrivateData(vec);
        if (!check.valid) continue;
        await admin.rpc("brain_ingest_compliance_pattern", {
          p_document_type: vec.document_type,
          p_hazard_profile: { hazards: vec.hazards },
          p_expiry_drift_days: vec.drift_days,
          p_risk_level: vec.expiry_state === "expired" ? "critical" : vec.expiry_state === "expiring" ? "high" : "low",
        });
        complianceCount++;
      }
    }
  }

  if (sharingLevel === "full_anonymised") {
    const { data: recs } = await admin.from("compliance_recommendations").select("hazards").eq("org_id", orgId);
    if (recs) {
      for (const r of recs) {
        const hazards = Array.isArray(r.hazards) ? r.hazards : [];
        for (const h of hazards) {
          const hazardType = String(h).toLowerCase().replace(/\s+/g, "_");
          const vec = { hazard_type: hazardType };
          const check = validateNoPrivateData(vec);
          if (!check.valid) continue;
          await admin.rpc("brain_ingest_hazard_signal", { p_hazard_type: hazardType });
          hazardCount++;
        }
      }
    }
  }

  const total = assetCount + complianceCount + hazardCount;
  if (total > 0) {
    await admin.rpc("brain_ingest_learning_log", {
      p_event_type: "extract",
      p_table_name: "local_to_global",
      p_record_count: total,
      p_metadata: { sharing_level: sharingLevel },
    });
  }

  return { assets: assetCount, compliance: complianceCount, hazards: hazardCount };
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Service role not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const body = await req.json().catch(() => ({}));
    const orgId = body.org_id as string | undefined;
    const mode = body.mode as string | undefined;

    // Mode: all_orgs — nightly cron processes all orgs with data sharing enabled
    if (mode === "all_orgs") {
      const { data: orgs } = await admin.from("org_settings").select("org_id").neq("data_sharing_level", "minimal");
      const orgIds = (orgs ?? []).map((o) => o.org_id).filter(Boolean);
      let totalAssets = 0;
      let totalCompliance = 0;
      let totalHazards = 0;
      for (const oid of orgIds) {
        const r = await extractForOrg(admin, oid);
        totalAssets += r.assets;
        totalCompliance += r.compliance;
        totalHazards += r.hazards;
      }
      return new Response(
        JSON.stringify({ ok: true, mode: "all_orgs", org_count: orgIds.length, extracted: { assets: totalAssets, compliance: totalCompliance, hazards: totalHazards } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mode: process_queue — cron processes orgs queued by event triggers
    if (mode === "process_queue") {
      const { data: pending } = await admin.from("brain_extract_pending").select("org_id");
      const orgIds = (pending ?? []).map((p) => p.org_id);
      let totalAssets = 0;
      let totalCompliance = 0;
      let totalHazards = 0;
      for (const oid of orgIds) {
        const r = await extractForOrg(admin, oid);
        totalAssets += r.assets;
        totalCompliance += r.compliance;
        totalHazards += r.hazards;
      }
      if (orgIds.length > 0) {
        await admin.from("brain_extract_pending").delete().in("org_id", orgIds);
      }
      return new Response(
        JSON.stringify({ ok: true, mode: "process_queue", org_count: orgIds.length, extracted: { assets: totalAssets, compliance: totalCompliance, hazards: totalHazards } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!orgId) {
      return new Response(JSON.stringify({ error: "org_id or mode (all_orgs|process_queue) required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const r = await extractForOrg(admin, orgId);
    return new Response(
      JSON.stringify({ ok: true, extracted: { assets: r.assets, compliance: r.compliance, hazards: r.hazards } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("local-to-global-extractor error:", error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
