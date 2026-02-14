// compliance-scheduler — Phase 6: Daily compliance check job
// Updates statuses, optionally creates tasks for due items when auto_schedule is enabled

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function computeStatus(nextDue: string | null | undefined): "red" | "amber" | "green" {
  if (!nextDue) return "green";
  const exp = new Date(nextDue);
  const now = new Date();
  const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return "red";
  if (daysLeft < 60) return "amber";
  return "green";
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

    const today = new Date().toISOString().split("T")[0];
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);
    const in30DaysStr = in30Days.toISOString().split("T")[0];

    const { data: items, error: fetchError } = await admin
      .from("compliance_documents")
      .select("id, org_id, title, property_id, next_due_date, expiry_date, auto_schedule")
      .not("next_due_date", "is", null)
      .lte("next_due_date", in30DaysStr);

    if (fetchError) {
      console.error("compliance-scheduler fetch error:", fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const complianceItems = items || [];
    let updated = 0;
    let tasksCreated = 0;

    for (const item of complianceItems) {
      const dueDate = item.next_due_date || item.expiry_date;
      if (!dueDate) continue;

      const status = computeStatus(dueDate);

      await admin
        .from("compliance_documents")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", item.id);
      updated++;

      await admin.from("compliance_history").insert({
        compliance_document_id: item.id,
        event: "status-updated",
        data: { status, due_date: dueDate },
        org_id: item.org_id,
      });

      if (!item.auto_schedule) continue;

      const { data: settings } = await admin
        .from("org_settings")
        .select("auto_schedule_compliance")
        .eq("org_id", item.org_id)
        .maybeSingle();

      if (!settings?.auto_schedule_compliance) continue;

      const { data: existingTasks } = await admin
        .from("task_compliance")
        .select("task_id")
        .eq("compliance_document_id", item.id)
        .limit(1);

      if (existingTasks && existingTasks.length > 0) continue;

      const taskTitle = `Compliance: ${item.title || "Untitled"}`;
      const { data: newTask, error: taskError } = await admin
        .from("tasks")
        .insert({
          org_id: item.org_id,
          title: taskTitle,
          property_id: item.property_id || null,
          priority: "high",
          due_date: dueDate,
          description: `Auto-generated from compliance schedule. Due: ${dueDate}`,
          status: "open",
        })
        .select("id")
        .single();

      if (taskError) {
        console.error("compliance-scheduler task create error:", taskError);
        continue;
      }

      if (newTask) {
        await admin.from("task_compliance").insert({
          task_id: newTask.id,
          compliance_document_id: item.id,
          org_id: item.org_id,
        });
        await admin.from("compliance_history").insert({
          compliance_document_id: item.id,
          event: "auto-task-created",
          data: { task_id: newTask.id, due_date: dueDate },
          org_id: item.org_id,
        });
        tasksCreated++;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        processed: complianceItems.length,
        updated,
        tasksCreated,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("compliance-scheduler error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
