// intake-process — AI extraction for user-initiated intake_items (uploads).
// Sets status pending → processing → ready|failed. Does not emit signals or create records.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  intake_item_id: string;
}

function isImageMime(mime: string | null): boolean {
  return (mime || "").toLowerCase().startsWith("image/");
}

async function invokeEdgeFunction(
  supabaseUrl: string,
  serviceRoleKey: string,
  functionName: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const res = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await res.json();
  if (!res.ok) {
    const detail =
      typeof payload?.error === "string"
        ? payload.error
        : res.status === 404
          ? `Edge function ${functionName} is not deployed (404). Run: supabase functions deploy ${functionName}`
          : `Edge function ${functionName} failed (${res.status})`;
    throw new Error(detail);
  }
  return payload as Record<string, unknown>;
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "POST only" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Service role not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { intake_item_id } = body;
    if (!intake_item_id) {
      return new Response(JSON.stringify({ error: "Missing intake_item_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: item, error: fetchError } = await admin
      .from("intake_items")
      .select("*")
      .eq("id", intake_item_id)
      .maybeSingle();

    if (fetchError || !item) {
      return new Response(JSON.stringify({ error: "Intake item not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!item.storage_path) {
      return new Response(JSON.stringify({ error: "Intake item has no storage_path" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (item.status === "processing") {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "already_processing" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (["confirmed", "ignored"].includes(item.status)) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "terminal" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin
      .from("intake_items")
      .update({ status: "processing", error_message: null })
      .eq("id", intake_item_id);

    const { data: signed, error: signError } = await admin.storage
      .from("inbox")
      .createSignedUrl(item.storage_path, 3600);

    if (signError || !signed?.signedUrl) {
      await admin
        .from("intake_items")
        .update({
          status: "failed",
          error_message: signError?.message || "Could not create signed URL",
        })
        .eq("id", intake_item_id);
      return new Response(JSON.stringify({ error: "Could not access uploaded file" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileUrl = signed.signedUrl;
    const mime = (item.mime_type as string | null) || "";
    const fileName = (item.file_name as string) || "upload";

    let aiClassification: string | null = null;
    let aiConfidence: number | null = null;
    let aiExtracted: Record<string, unknown>;

    try {
      if (isImageMime(mime)) {
        const result = await invokeEdgeFunction(supabaseUrl, serviceRoleKey, "ai-image-analyse", {
          file_url: fileUrl,
          org_id: item.org_id,
          property_id: item.property_id,
          mode: "router",
        });

        const meta = (result.metadata as Record<string, unknown>) || {};
        const workflowHint = (meta.workflow_hint as string) || "uncertain";
        const docTypeHint = meta.document_type_hint as string | undefined;
        aiClassification = docTypeHint || workflowHint;
        aiConfidence =
          typeof meta.workflow_confidence === "number" ? meta.workflow_confidence : null;
        aiExtracted = {
          ...result,
          ocr_text: result.ocr_text ?? "",
          workflow_hint: workflowHint,
        };
      } else {
        const result = await invokeEdgeFunction(supabaseUrl, serviceRoleKey, "ai-doc-analyse", {
          file_url: fileUrl,
          file_name: fileName,
          org_id: item.org_id,
          property_id: item.property_id,
        });

        aiClassification =
          (result.document_type as string) ||
          (result.category as string) ||
          (result.title as string) ||
          null;
        aiConfidence = typeof result.confidence === "number" ? result.confidence : null;
        aiExtracted = result;
      }

      await admin
        .from("intake_items")
        .update({
          status: "ready",
          ai_classification: aiClassification,
          ai_extracted: aiExtracted,
          ai_confidence: aiConfidence,
          processed_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", intake_item_id);

      return new Response(
        JSON.stringify({
          ok: true,
          intake_item_id,
          ai_classification: aiClassification,
          ai_confidence: aiConfidence,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await admin
        .from("intake_items")
        .update({
          status: "failed",
          error_message: message,
          processed_at: new Date().toISOString(),
        })
        .eq("id", intake_item_id);

      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("intake-process error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
