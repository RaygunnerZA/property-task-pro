/**
 * assistant-action-executor — Phase 14 FILLA Assistant Mode
 * Executes approved actions only. Called after user confirms.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const rec = err as Record<string, unknown>;
    if (typeof rec.message === "string" && rec.message.trim()) return rec.message;
    if (typeof rec.error === "string" && rec.error.trim()) return rec.error;
    if (typeof rec.details === "string" && rec.details.trim()) return rec.details;
  }
  return "Action failed";
}

async function logAssistantAction(
  client: ReturnType<typeof createClient>,
  row: {
    org_id: string;
    user_id: string;
    action_type: string;
    payload: Record<string, unknown>;
  }
) {
  const { error } = await client.from("assistant_logs").insert(row);
  if (error) {
    console.warn("[assistant-action-executor] assistant_logs insert skipped:", error.message);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "POST only" });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ ok: false, error: "Unauthorized" });
  }

  let body: { type: string; payload: unknown; org_id: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" });
  }

  const { type, payload, org_id: orgId } = body;
  if (!orgId || !type) {
    return jsonResponse({ ok: false, error: "org_id and type required" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const token = authHeader.slice("Bearer ".length).trim();
  const {
    data: { user },
    error: userErr,
  } = await admin.auth.getUser(token);
  if (userErr || !user) {
    return jsonResponse({ ok: false, error: "Unauthorized" });
  }
  const userId = user.id;

  const { data: membership, error: membershipErr } = await admin
    .from("organisation_members")
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (membershipErr || !membership) {
    return jsonResponse({ ok: false, error: membershipErr?.message ?? "Forbidden" });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

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

      const taskPayload = {
        title: p.title?.trim() || "New task",
        description: p.description ?? null,
        priority: p.priority ?? "medium",
        due_at: p.due_at ?? null,
        space_ids: p.space_ids ?? [],
        assigned_team_ids: [],
        metadata: { source: "assistant" },
      };

      const { data: taskId, error: createErr } = await userClient.rpc("create_task_safe", {
        p_org: orgId,
        p_property: p.property_id ?? null,
        p_payload: taskPayload,
      });

      if (createErr) {
        return jsonResponse({ ok: false, error: formatError(createErr) });
      }
      if (!taskId) {
        return jsonResponse({ ok: false, error: "Task was not created" });
      }

      await logAssistantAction(userClient, {
        org_id: orgId,
        user_id: userId,
        action_type: "create_task",
        payload: { task_id: taskId, ...taskPayload, property_id: p.property_id ?? null },
      });

      return jsonResponse({ ok: true, task_id: taskId });
    }

    if (type === "link_compliance") {
      const p = payload as { attachment_id: string; compliance_document_id: string };
      if (!p.attachment_id || !p.compliance_document_id) {
        return jsonResponse({
          ok: false,
          error: "attachment_id and compliance_document_id required",
        });
      }
      const { error } = await userClient.from("attachment_compliance").insert({
        attachment_id: p.attachment_id,
        compliance_document_id: p.compliance_document_id,
        org_id: orgId,
      });
      if (error) {
        return jsonResponse({ ok: false, error: formatError(error) });
      }
      await logAssistantAction(userClient, {
        org_id: orgId,
        user_id: userId,
        action_type: "link_compliance",
        payload: p,
      });
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ ok: false, error: "Unknown action type" });
  } catch (err: unknown) {
    console.error("assistant-action-executor error:", err);
    return jsonResponse({ ok: false, error: formatError(err) });
  }
});
