/**
 * assistant-action-executor — Phase 14 FILLA Assistant Mode
 * Executes approved actions only. Called after user confirms.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "POST only" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ ok: false, error: "Unauthorized" }, 401);

  let body: { type: string; payload: unknown; org_id: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }

  const { type, payload, org_id: orgId } = body;
  if (!orgId || !type) {
    return jsonResponse({ ok: false, error: "org_id and type required" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  const userId = user?.id ?? null;

  try {
    if (type === "create_task") {
      const p = payload as {
        title?: string;
        property_id?: string | null;
        space_ids?: string[];
        priority?: string;
        due_at?: string | null;
        description?: string | null;
      };
      const { data: newTask, error } = await supabase
        .from("tasks")
        .insert({
          org_id: orgId,
          title: p.title || "New task",
          description: p.description || null,
          property_id: p.property_id || null,
          priority: p.priority || "medium",
          due_date: p.due_at || null,
          status: "open",
        })
        .select("id")
        .single();
      if (error) throw error;
      const taskId = newTask?.id;
      await supabase.from("assistant_logs").insert({
        org_id: orgId,
        user_id: userId,
        action_type: "create_task",
        payload: { task_id: taskId, ...p },
      });
      return jsonResponse({ ok: true, task_id: taskId });
    }

    if (type === "link_compliance") {
      const p = payload as { attachment_id: string; compliance_document_id: string };
      if (!p.attachment_id || !p.compliance_document_id) {
        return jsonResponse({ ok: false, error: "attachment_id and compliance_document_id required" }, 400);
      }
      const { error } = await supabase.from("attachment_compliance").insert({
        attachment_id: p.attachment_id,
        compliance_document_id: p.compliance_document_id,
        org_id: orgId,
      });
      if (error) throw error;
      await supabase.from("assistant_logs").insert({
        org_id: orgId,
        user_id: userId,
        action_type: "link_compliance",
        payload: p,
      });
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ ok: false, error: "Unknown action type" }, 400);
  } catch (err: unknown) {
    console.error("assistant-action-executor error:", err);
    return jsonResponse(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      500
    );
  }
});
