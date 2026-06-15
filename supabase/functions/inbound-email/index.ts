// inbound-email — Resend inbound webhook → intake_items (members) or signals (external)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { emitSignal } from "../_shared/signalEngine.ts";
import {
  fetchResendAttachmentDownload,
  fetchResendReceivedEmail,
  parseIntakeTokenFromAddress,
  parseSenderEmail,
  plainTextFromEmail,
  receivedEmailFromWebhook,
  verifyResendWebhook,
  type ResendReceivedEmail,
  type ResendWebhookEvent,
} from "../_shared/resendInbound.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
]);

function sanitizeFileName(name: string): string {
  return name.trim().replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 120) || "attachment";
}

async function invokeIntakeProcess(supabaseUrl: string, serviceKey: string, intakeItemId: string) {
  await fetch(`${supabaseUrl}/functions/v1/intake-process`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ intake_item_id: intakeItemId }),
  });
}

async function uploadAttachmentToInbox(
  admin: ReturnType<typeof createClient>,
  orgId: string,
  intakeId: string,
  fileName: string,
  mimeType: string,
  bytes: Uint8Array
): Promise<string> {
  const cleaned = sanitizeFileName(fileName);
  const path = `orgs/${orgId}/inbox/${intakeId}/${Date.now()}-${cleaned}`;
  const { error } = await admin.storage.from("inbox").upload(path, bytes, {
    contentType: mimeType || "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
}

async function handleEmailReceived(
  admin: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceKey: string,
  resendApiKey: string,
  event: ResendWebhookEvent
) {
  const emailId = event.data?.email_id;
  if (!emailId) throw new Error("Missing email_id");

  let email: ResendReceivedEmail;
  let usedWebhookFallback = false;
  try {
    email = await fetchResendReceivedEmail(resendApiKey, emailId);
  } catch (fetchErr) {
    console.error("[inbound-email] Receiving API fetch failed:", fetchErr);
    email = receivedEmailFromWebhook(event, emailId);
    usedWebhookFallback = true;
  }

  const toAddresses = email.to ?? event.data?.to ?? [];
  let orgId: string | null = null;

  for (const addr of toAddresses) {
    const token = parseIntakeTokenFromAddress(addr);
    if (!token) continue;
    const { data: resolved } = await admin.rpc("resolve_org_by_intake_email_token", {
      p_token: token,
    });
    if (resolved) {
      orgId = resolved as string;
      break;
    }
  }

  if (!orgId) {
    console.warn("[inbound-email] no org for addresses:", toAddresses);
    return { ok: true, skipped: true, reason: "unknown_org" };
  }

  const fromEmail = parseSenderEmail(email.from ?? event.data?.from ?? "");
  const { data: memberUserId } = await admin.rpc("match_org_member_by_email", {
    p_org_id: orgId,
    p_email: fromEmail,
  });

  const subject = email.subject ?? event.data?.subject ?? "Forwarded email";
  let bodyText = plainTextFromEmail(email);
  if (usedWebhookFallback) {
    bodyText =
      subject +
      (subject ? "\n\n" : "") +
      "(Full conversation text requires a Resend Full access API key on RESEND_API_KEY.)";
  }
  const messageId = email.message_id ?? event.data?.message_id ?? emailId;
  const dedupeKey = `email_inbound:${orgId}:${messageId}`;

  const attachments = email.attachments ?? event.data?.attachments ?? [];
  const storagePaths: string[] = [];

  for (const att of attachments) {
    if (!att.id) continue;
    if (usedWebhookFallback) {
      console.warn("[inbound-email] skipping attachment download — Receiving API unavailable");
      break;
    }
    try {
      const meta = await fetchResendAttachmentDownload(resendApiKey, emailId, att.id);
      const fileRes = await fetch(meta.download_url);
      if (!fileRes.ok) continue;
      const buf = new Uint8Array(await fileRes.arrayBuffer());
      const mime = (att.content_type || meta.content_type || "application/octet-stream").toLowerCase();
      if (mime && !ALLOWED_MIME.has(mime) && !mime.startsWith("image/")) {
        console.warn("[inbound-email] skipping disallowed mime:", mime);
        continue;
      }
      const intakeId = crypto.randomUUID();
      const path = await uploadAttachmentToInbox(
        admin,
        orgId,
        intakeId,
        att.filename || meta.filename,
        mime,
        buf
      );
      storagePaths.push(path);

      if (memberUserId) {
        const { data: item, error } = await admin.rpc("create_intake_item_from_email", {
          p_org_id: orgId,
          p_created_by: memberUserId,
          p_id: intakeId,
          p_storage_path: path,
          p_file_name: att.filename || meta.filename,
          p_mime_type: mime,
          p_file_size: buf.byteLength,
          p_raw_text: bodyText ? bodyText.slice(0, 4000) : null,
        });
        if (error) {
          console.error("[inbound-email] create_intake_item_from_email:", error.message);
        } else if (item?.id) {
          void invokeIntakeProcess(supabaseUrl, serviceKey, item.id as string);
        }
      }
    } catch (err) {
      console.error("[inbound-email] attachment error:", err);
    }
  }

  if (memberUserId) {
    if (attachments.length === 0 || usedWebhookFallback) {
      const intakeId = crypto.randomUUID();
      const conversationLabel = subject || "Forwarded email";
      const { data: item, error } = await admin.rpc("create_intake_item_from_email", {
        p_org_id: orgId,
        p_created_by: memberUserId,
        p_id: intakeId,
        p_storage_path: null,
        p_file_name: usedWebhookFallback ? `${conversationLabel.slice(0, 80)}.eml` : null,
        p_mime_type: usedWebhookFallback ? "text/plain" : null,
        p_file_size: null,
        p_raw_text: bodyText ? bodyText.slice(0, 4000) : subject,
      });
      if (!error && item?.id) {
        await admin
          .from("intake_items")
          .update({
            status: "ready",
            ai_classification: usedWebhookFallback ? "Email (preview)" : "Email",
            processed_at: new Date().toISOString(),
          })
          .eq("id", item.id);
      }
    }
    return {
      ok: true,
      route: "intake_items",
      org_id: orgId,
      attachments: storagePaths.length,
      webhook_fallback: usedWebhookFallback,
    };
  }

  // Unknown external sender → signal for manager triage
  await emitSignal(admin, {
    org_id: orgId,
    subtype: "ingestion.external_email",
    title: subject.slice(0, 120) || "External email",
    body: bodyText.slice(0, 500) || `Email from ${fromEmail}`,
    kind: "email",
    category: "operational",
    severity: "info",
    source: "resend_inbound",
    source_key: "email_inbound",
    disposition: "needs_review",
    review_state: "needs_classification",
    dedupe_key: dedupeKey,
    payload: {
      from: fromEmail,
      subject,
      message_id: messageId,
      email_id: emailId,
      attachment_paths: storagePaths,
      preview: bodyText.slice(0, 280),
    },
    recommendation: {
      action: "review",
      template_key: "external_email",
      title: "External email received",
      body: "Review and classify content from an unknown sender.",
      task_priority: "normal",
    },
  });

  return { ok: true, route: "signal", org_id: orgId, attachments: storagePaths.length };
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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");

    if (!serviceKey || !resendApiKey) {
      return new Response(JSON.stringify({ error: "Missing service configuration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawBody = await req.text();
    let event: ResendWebhookEvent;

    if (webhookSecret) {
      event = await verifyResendWebhook(rawBody, req.headers, webhookSecret);
    } else {
      console.warn("[inbound-email] RESEND_WEBHOOK_SECRET not set — skipping verification");
      event = JSON.parse(rawBody) as ResendWebhookEvent;
    }

    if (event.type !== "email.received") {
      return new Response(JSON.stringify({ ok: true, ignored: true, type: event.type }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const result = await handleEmailReceived(admin, supabaseUrl, serviceKey, resendApiKey, event);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[inbound-email]", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
