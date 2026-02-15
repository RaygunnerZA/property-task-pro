/**
 * graph-sync — Phase 13A FILLA Graph Backbone
 * Normalises relationships from existing tables into property_graph_edges.
 * Idempotent. Auto-trigger placeholder (no triggers created).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generate as uuidV5 } from "https://deno.land/std@0.224.0/uuid/v5.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HAZARD_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "POST only" }, 405);

  let body: { org_id?: string; full_rebuild?: boolean };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }

  const orgId = body.org_id;
  const fullRebuild = body.full_rebuild === true;

  if (!orgId) return jsonResponse({ ok: false, error: "org_id required" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    if (fullRebuild) {
      const { error: delErr } = await supabase.from("property_graph_edges").delete().eq("org_id", orgId);
      if (delErr) throw delErr;
    }

    const now = new Date().toISOString();
    const edges: Array<{
      org_id: string;
      source_type: string;
      source_id: string;
      target_type: string;
      target_id: string;
      relationship: string;
      weight?: number;
      metadata?: Record<string, unknown>;
      updated_at: string;
    }> = [];

    // property → space (spaces.property_id)
    const { data: spaces } = await supabase.from("spaces").select("id, property_id").eq("org_id", orgId);
    for (const s of spaces ?? []) {
      if (s.property_id) {
        edges.push({
          org_id: orgId,
          source_type: "property",
          source_id: s.property_id,
          target_type: "space",
          target_id: s.id,
          relationship: "contains",
          updated_at: now,
        });
      }
    }

    // space → asset (assets.space_id)
    const { data: assets } = await supabase.from("assets").select("id, space_id").eq("org_id", orgId);
    for (const a of assets ?? []) {
      if (a.space_id) {
          edges.push({
            org_id: orgId,
            source_type: "space",
            source_id: a.space_id,
            target_type: "asset",
            target_id: a.id,
            relationship: "contains",
            updated_at: now,
          });
      }
    }

    // asset → task (task_assets)
    const { data: taskAssets } = await supabase.from("task_assets").select("task_id, asset_id");
    if (taskAssets?.length) {
      const { data: tasks } = await supabase.from("tasks").select("id").eq("org_id", orgId);
      const taskIds = new Set((tasks ?? []).map((t) => t.id));
      for (const ta of taskAssets) {
        if (taskIds.has(ta.task_id)) {
          edges.push({
            org_id: orgId,
            source_type: "asset",
            source_id: ta.asset_id,
            target_type: "task",
            target_id: ta.task_id,
            relationship: "linked-to",
            updated_at: now,
          });
        }
      }
    }

    // task → attachment (attachments.parent_type='task')
    const { data: taskAttachments } = await supabase
      .from("attachments")
      .select("id, parent_id")
      .eq("org_id", orgId)
      .eq("parent_type", "task");
    for (const att of taskAttachments ?? []) {
      if (att.parent_id) {
        edges.push({
          org_id: orgId,
          source_type: "task",
          source_id: att.parent_id,
          target_type: "attachment",
          target_id: att.id,
          relationship: "linked-to",
          updated_at: now,
        });
      }
    }

    // attachment → compliance (attachment_compliance)
    const { data: acLinks } = await supabase
      .from("attachment_compliance")
      .select("attachment_id, compliance_document_id")
      .eq("org_id", orgId);
    for (const ac of acLinks ?? []) {
      edges.push({
        org_id: orgId,
        source_type: "attachment",
        source_id: ac.attachment_id,
        target_type: "compliance",
        target_id: ac.compliance_document_id,
        relationship: "evidence-of",
        updated_at: now,
      });
    }

    // asset → compliance (compliance_documents.linked_asset_ids)
    const { data: complianceDocs } = await supabase
      .from("compliance_documents")
      .select("id, linked_asset_ids, hazards, property_id")
      .eq("org_id", orgId);
    for (const cd of complianceDocs ?? []) {
      const ids = (cd.linked_asset_ids as string[]) ?? [];
      for (const assetId of ids) {
        if (assetId) {
          edges.push({
            org_id: orgId,
            source_type: "asset",
            source_id: assetId,
            target_type: "compliance",
            target_id: cd.id,
            relationship: "linked-to",
            updated_at: now,
          });
        }
      }
    }

    // compliance → hazard (compliance_documents.hazards)
    for (const cd of complianceDocs ?? []) {
      const hazards = (cd.hazards as string[]) ?? [];
      for (const h of hazards) {
        if (h) {
          const hazardId = await uuidV5(HAZARD_NAMESPACE, new TextEncoder().encode(`${cd.id}_${h}`));
          edges.push({
            org_id: orgId,
            source_type: "compliance",
            source_id: cd.id,
            target_type: "hazard",
            target_id: hazardId,
            relationship: "requires",
            weight: 1,
            metadata: { hazard_type: h },
            updated_at: now,
          });
        }
      }
    }

    // compliance → contractor (compliance_contractors + default_contractor_id)
    const { data: ccLinks } = await supabase
      .from("compliance_contractors")
      .select("compliance_document_id, contractor_org_id")
      .eq("org_id", orgId);
    for (const cc of ccLinks ?? []) {
      edges.push({
        org_id: orgId,
        source_type: "compliance",
        source_id: cc.compliance_document_id,
        target_type: "contractor",
        target_id: cc.contractor_org_id,
        relationship: "assigned-to",
        updated_at: now,
      });
    }
    const { data: cdWithContractor } = await supabase
      .from("compliance_documents")
      .select("id, default_contractor_id")
      .eq("org_id", orgId)
      .not("default_contractor_id", "is", null);
    for (const cd of cdWithContractor ?? []) {
      if (cd.default_contractor_id) {
        edges.push({
          org_id: orgId,
          source_type: "compliance",
          source_id: cd.id,
          target_type: "contractor",
          target_id: cd.default_contractor_id,
          relationship: "assigned-to",
          updated_at: now,
        });
      }
    }

    // property → compliance (compliance_documents.property_id)
    for (const cd of complianceDocs ?? []) {
      if (cd.property_id) {
        edges.push({
          org_id: orgId,
          source_type: "property",
          source_id: cd.property_id,
          target_type: "compliance",
          target_id: cd.id,
          relationship: "linked-to",
          updated_at: now,
        });
      }
    }

    // space → task (task_spaces)
    const { data: taskSpaces } = await supabase.from("task_spaces").select("task_id, space_id");
    if (taskSpaces?.length) {
      const { data: tasks } = await supabase.from("tasks").select("id").eq("org_id", orgId);
      const taskIds = new Set((tasks ?? []).map((t) => t.id));
      for (const ts of taskSpaces) {
        if (taskIds.has(ts.task_id)) {
          edges.push({
            org_id: orgId,
            source_type: "space",
            source_id: ts.space_id,
            target_type: "task",
            target_id: ts.task_id,
            relationship: "linked-to",
            updated_at: now,
          });
        }
      }
    }

    if (edges.length > 0) {
      const { error: upsertErr } = await supabase.from("property_graph_edges").upsert(edges, {
        onConflict: "org_id,source_type,source_id,target_type,target_id,relationship",
      });
      if (upsertErr) throw upsertErr;
    }

    return jsonResponse({ ok: true, edges_synced: edges.length });
  } catch (err: unknown) {
    console.error("graph-sync error:", err);
    return jsonResponse(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      500
    );
  }
});
