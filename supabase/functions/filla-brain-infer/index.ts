/**
 * Phase 11: Filla Brain Inference Engine
 * Receives local anonymised vectors, returns predictions. Never receives org IDs or private data.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FORBIDDEN_KEYS = ["org_id", "property_id", "asset_id", "serial_number", "manufacturer", "model", "contractor", "address", "name", "email"];
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

    const { assets = [], compliance_documents = [] } = body as {
      assets?: Array<{ asset_type?: string; condition_score?: number; install_date?: string }>;
      compliance_documents?: Array<{ document_type?: string }>;
    };

    const predictions: { assets: any[]; compliance: any[] } = { assets: [], compliance: [] };

    for (const a of assets) {
      const vec: Record<string, unknown> = {};
      if (a.asset_type) vec.asset_type = String(a.asset_type).toLowerCase().replace(/\s+/g, "_");
      if (a.condition_score != null) vec.condition_bucket = bucketCondition(a.condition_score);
      if (a.install_date) {
        const years = (Date.now() - new Date(a.install_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        vec.age_bucket = bucketAge(Math.floor(years));
      }
      const check = validateNoPrivateData(vec);
      if (!check.valid) continue;
      const { data: assetInfer } = await admin.rpc("brain_infer_asset", { p_vector: vec });
      const failProb = assetInfer?.failure_probability ?? 0.1;
      const mttf = assetInfer?.mean_time_to_failure_days ?? 365;
      predictions.assets.push({
        asset_vector: vec,
        risk_score: Math.round(failProb * 100),
        predicted_failure_days: mttf,
        hazard_multiplier: 1.0,
        recommended_action: mttf < 90 ? "Schedule inspection within 30 days" : mttf < 180 ? "Monitor condition" : "Routine maintenance",
      });
    }

    for (const c of compliance_documents) {
      const docType = (c.document_type || "unknown").toLowerCase().replace(/\s+/g, "_");
      const check = validateNoPrivateData({ document_type: docType });
      if (!check.valid) continue;
      const { data: compInfer } = await admin.rpc("brain_infer_compliance", { p_document_type: docType });
      predictions.compliance.push({
        document_type: docType,
        recommended_frequency: compInfer?.recommended_frequency ?? "annual",
        risk_level: compInfer?.risk_level ?? "low",
        probability_of_incident: compInfer?.probability_of_incident ?? 0.05,
      });
    }

    return new Response(
      JSON.stringify({ ok: true, predictions }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("filla-brain-infer error:", error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
