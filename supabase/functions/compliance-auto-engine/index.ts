// compliance-auto-engine — Phase 10: Full Compliance Automation Engine
// Auto-task creation, contractor assignment, intelligent schedule maintenance
// Runs via nightly cron or manual "Re-run automation" button

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type AutoTaskType = "critical" | "high" | "expiring_soon" | "upcoming";
type AutomationAggressiveness = "conservative" | "recommended" | "aggressive";

const MAX_TASKS_PER_ORG_PER_RUN = 10;
const MIN_HOURS_BETWEEN_TASKS_PER_ITEM = 24;

// Map document_type to task title template
function getTaskTitleFromDocType(docType: string | null): string {
  const t = (docType || "").toLowerCase();
  if (t.includes("fire") || t.includes("fra")) return "Fire Safety Inspection";
  if (t.includes("eicr") || t.includes("electrical") || t.includes("eic") || t.includes("pat")) return "Electrical Safety Check";
  if (t.includes("gas")) return "Annual Gas Certificate";
  if (t.includes("legionella") || t.includes("water")) return "Legionella Test";
  if (t.includes("hvac")) return "HVAC Service";
  if (t.includes("loler") || t.includes("lift")) return "LOLER Inspection";
  return "Compliance Review";
}

// Determine risk category
function classifyRisk(
  daysUntilExpiry: number | null,
  hazardCritical: boolean,
  hazardHigh: boolean,
  expiryStatus: string | null
): AutoTaskType | null {
  if (daysUntilExpiry === null) return null;
  if (daysUntilExpiry < 0 || hazardCritical) return "critical";
  if (daysUntilExpiry <= 30 || hazardHigh) return "high";
  if (daysUntilExpiry <= 90) return "expiring_soon";
  if (expiryStatus === "valid" && daysUntilExpiry <= 180) return "upcoming";
  return null;
}

// Filter by automation mode or explicit auto_task_levels
function shouldCreateForType(
  type: AutoTaskType,
  mode: AutomationAggressiveness,
  explicitLevels: string[] | null | undefined
): boolean {
  if (explicitLevels && explicitLevels.length > 0) {
    const normalized = type === "expiring_soon" ? "expiring_soon" : type;
    return explicitLevels.includes(normalized);
  }
  if (mode === "conservative") return type === "critical";
  if (mode === "recommended") return type === "critical" || type === "high";
  return true; // aggressive = all
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "POST only" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Service role not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const orgIds: string[] = body.org_id ? [body.org_id] : [];

    // If no org_id provided, fetch all orgs with auto_task_creation or auto_task_generation enabled
    let targetOrgIds = orgIds;
    if (targetOrgIds.length === 0) {
      const { data: byCreation } = await admin
        .from("org_settings")
        .select("org_id")
        .eq("auto_task_creation", true);
      const { data: byGeneration } = await admin
        .from("org_settings")
        .select("org_id")
        .eq("auto_task_generation", true);
      const ids = new Set([
        ...(byCreation || []).map((s) => s.org_id),
        ...(byGeneration || []).map((s) => s.org_id),
      ]);
      targetOrgIds = Array.from(ids);
    }

    const results: Record<string, { processed: number; created: number; skipped: number }> = {};

    for (const orgId of targetOrgIds) {
      const { data: orgSettings } = await admin
        .from("org_settings")
        .select(`
          auto_task_creation, auto_task_generation, auto_task_levels,
          auto_assignment, auto_assign_contractors, auto_assign_confidence,
          automation_aggressiveness, automation_mode
        `)
        .eq("org_id", orgId)
        .maybeSingle();

      const autoCreate = orgSettings?.auto_task_generation ?? orgSettings?.auto_task_creation;
      if (!autoCreate) {
        results[orgId] = { processed: 0, created: 0, skipped: 0 };
        continue;
      }

      const mode = (orgSettings.automation_mode || orgSettings.automation_aggressiveness) as AutomationAggressiveness || "recommended";
      const autoTaskLevels = orgSettings.auto_task_levels ?? null;

      // Load compliance items: not archived-ish, has expiry or frequency, org-scoped, linked to property
      const { data: compliances, error: complError } = await admin
        .from("compliance_documents")
        .select(`
          id, org_id, title, property_id, document_type,
          expiry_date, next_due_date, frequency, hazards,
          assigned_contractor_org_id, default_contractor_id
        `)
        .eq("org_id", orgId)
        .not("property_id", "is", null);

      if (complError || !compliances) {
        results[orgId] = { processed: 0, created: 0, skipped: 0 };
        continue;
      }

      // Load recommendations for hazard/risk
      const { data: recs } = await admin
        .from("compliance_recommendations")
        .select("compliance_document_id, risk_level")
        .in("compliance_document_id", compliances.map((c) => c.id));

      const recMap = new Map((recs || []).map((r) => [r.compliance_document_id, r.risk_level]));

      let created = 0;
      let skipped = 0;
      const now = new Date();
      const cutoff24h = new Date(now.getTime() - MIN_HOURS_BETWEEN_TASKS_PER_ITEM * 60 * 60 * 1000);

      for (const doc of compliances) {
        if (created >= MAX_TASKS_PER_ORG_PER_RUN) break;

        const dueDate = doc.next_due_date || doc.expiry_date;
        if (!dueDate) continue;

        const due = new Date(dueDate);
        const daysUntilExpiry = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const expiryStatus =
          daysUntilExpiry < 0 ? "expired" : daysUntilExpiry <= 30 ? "expiring" : "valid";

        const hazards = (doc.hazards as string[]) || [];
        const hazardCritical = hazards.includes("structural") || recMap.get(doc.id) === "critical";
        const hazardHigh =
          hazards.includes("fire") ||
          hazards.includes("electrical") ||
          recMap.get(doc.id) === "high";

        const autoType = classifyRisk(daysUntilExpiry, hazardCritical, hazardHigh, expiryStatus);
        if (!autoType || !shouldCreateForType(autoType, mode, autoTaskLevels)) continue;

        // Dedupe: check compliance_auto_tasks
        const { data: existing } = await admin
          .from("compliance_auto_tasks")
          .select("id, created_at, status")
          .eq("compliance_document_id", doc.id)
          .eq("auto_task_type", autoType)
          .maybeSingle();

        if (existing) {
          if (existing.status === "created" || existing.status === "completed") {
            skipped++;
            continue;
          }
          if (existing.status === "pending" && new Date(existing.created_at) > cutoff24h) {
            skipped++;
            continue;
          }
        }

        // Contractor assignment stored on compliance doc; tasks don't have contractor column.
        // Future: add assigned_contractor_org_id to tasks or use contractor_tokens.

        const taskTitle = `${getTaskTitleFromDocType(doc.document_type)} – ${doc.title || doc.document_type || "Compliance"}`;

        const { data: newTask, error: taskErr } = await admin
          .from("tasks")
          .insert({
            org_id: doc.org_id,
            title: taskTitle,
            description: `Auto-generated from compliance. Due: ${dueDate}. Type: ${autoType}.`,
            property_id: doc.property_id,
            priority: autoType === "critical" ? "urgent" : autoType === "high" ? "high" : "normal",
            due_date: dueDate,
            status: "open",
          })
          .select("id")
          .single();

        if (taskErr) {
          console.error("compliance-auto-engine task create error:", taskErr);
          skipped++;
          continue;
        }

        if (!newTask) continue;

        await admin.from("task_compliance").insert({
          task_id: newTask.id,
          compliance_document_id: doc.id,
          org_id: doc.org_id,
        });

        const { error: autoTaskErr } = await admin.from("compliance_auto_tasks").upsert(
          {
            org_id: doc.org_id,
            compliance_document_id: doc.id,
            task_id: newTask.id,
            auto_task_type: autoType,
            status: "created",
          },
          {
            onConflict: "compliance_document_id,auto_task_type",
          }
        );
        if (autoTaskErr) console.error("compliance_auto_tasks upsert:", autoTaskErr);

        await admin.from("compliance_history").insert({
          compliance_document_id: doc.id,
          event: "auto-task-created",
          data: { task_id: newTask.id, auto_task_type: autoType, due_date: dueDate },
          org_id: doc.org_id,
        });

        created++;
      }

      results[orgId] = {
        processed: compliances.length,
        created,
        skipped,
      };
    }

    return new Response(
      JSON.stringify({ ok: true, results }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("compliance-auto-engine error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
