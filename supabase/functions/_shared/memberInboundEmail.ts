/**
 * Personal inbound address: one intake item per message, then one proposal.
 * Routing identity is passed in by the webhook after envelope resolution.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runCapability, type ExecutorOutput, type StrategyExecutor } from "./aiCall.ts";
import { geminiUsage, openAiUsage } from "./aiObservability.ts";
import { parseJsonLoose } from "./aiRouting.ts";
import {
  GEMINI_FLASH_MODEL,
  geminiGenerateContentUrl,
  generalGeminiApiKey,
} from "./geminiKeys.ts";
import {
  inspectInboundAttachment,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  MAX_TOTAL_ATTACHMENT_BYTES,
} from "./inboundAttachmentGuard.ts";
import {
  INBOUND_EMAIL_TRIAGE_SYSTEM,
  unclearInboundProposal,
  validateInboundEmailProposal,
  type InboundEmailProposal,
} from "./inboundEmailTriage.ts";
import {
  parseSenderEmail,
  plainTextFromEmail,
  type ResendReceivedEmail,
} from "./resendInbound.ts";

type StoredAttachment = {
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  storage_path: string | null;
  sha256: string | null;
  accepted: boolean;
  reason?: string;
  text_excerpt?: string;
};

function sanitizeFileName(name: string): string {
  return name.trim().replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 120) || "attachment";
}

function addressList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    out.push(trimmed.slice(0, 320));
    if (out.length >= 20) break;
  }
  return out;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function textExcerpt(bytes: Uint8Array, mime: string): string | undefined {
  if (mime !== "text/plain" && mime !== "text/csv") return undefined;
  if (bytes.byteLength > 100_000) return undefined;
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes).replace(/\u0000/g, "").trim();
  return text ? text.slice(0, 1500) : undefined;
}

async function callGemini(user: string): Promise<ExecutorOutput> {
  const key = generalGeminiApiKey();
  if (!key) throw new Error("Gemini API key not set");
  const res = await fetch(geminiGenerateContentUrl(GEMINI_FLASH_MODEL, key), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: INBOUND_EMAIL_TRIAGE_SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return { raw: parseJsonLoose(text), usage: geminiUsage(data) };
}

async function callOpenAI(user: string): Promise<ExecutorOutput> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY not set");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: INBOUND_EMAIL_TRIAGE_SYSTEM },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  return { raw: parseJsonLoose(text), usage: openAiUsage(data) };
}

function triagePrompt(subject: string, body: string, attachments: StoredAttachment[]): string {
  const lines = attachments.map((attachment) => {
    const status = attachment.accepted ? "kept" : `rejected:${attachment.reason ?? "no"}`;
    const excerpt = attachment.text_excerpt ? ` excerpt: ${attachment.text_excerpt}` : "";
    return `- ${attachment.file_name} (${attachment.mime_type ?? "unknown"}, ${status})${excerpt}`;
  });
  return [
    `Subject: ${subject.slice(0, 200)}`,
    `Body:\n${body.slice(0, 6000)}`,
    `Attachments:\n${lines.join("\n") || "(none)"}`,
  ].join("\n\n").slice(0, 12000);
}

async function proposeOutcome(
  admin: SupabaseClient,
  orgId: string,
  userId: string,
  intakeId: string,
  prompt: string
): Promise<InboundEmailProposal> {
  const executors: Record<string, StrategyExecutor> = {};
  if (generalGeminiApiKey()) executors["model:gemini-2.0-flash"] = () => callGemini(prompt);
  if (Deno.env.get("OPENAI_API_KEY")) executors["model:gpt-4o-mini"] = () => callOpenAI(prompt);

  const result = await runCapability(admin, {
    capability: "inbound_email_triage",
    orgId,
    userId,
    executors,
    validate: validateInboundEmailProposal,
    allowFallback: false,
    entity: { type: "intake_item", id: intakeId },
    metadata: { channel: "member_intake_email" },
  });

  if (!result.ok || !result.value) {
    const reason = result.blocked
      ? "AI allowance reached. Review this email yourself."
      : "Analysis unavailable.";
    return unclearInboundProposal(reason);
  }
  return result.value;
}

export async function handleMemberInboundEmail(
  admin: SupabaseClient,
  input: {
    orgId: string;
    userId: string;
    tokenHash: string;
    loginEmail: string;
    email: ResendReceivedEmail;
    emailId: string;
    envelopeRecipients: string[];
    receivedAt: string | null;
    resendApiKey: string;
  }
): Promise<Record<string, unknown>> {
  const fromEmail = parseSenderEmail(input.email.from || "");
  const senderVerified = Boolean(
    input.loginEmail && fromEmail && input.loginEmail.trim().toLowerCase() === fromEmail
  );
  const subject = (input.email.subject || "Email").slice(0, 200);
  const body = plainTextFromEmail(input.email).trim().slice(0, 8000) || subject;
  const messageId = (input.email.message_id || `resend:${input.emailId}`).slice(0, 500);

  const { data: claim, error: claimError } = await admin.rpc("claim_inbound_member_email", {
    p_org_id: input.orgId,
    p_user_id: input.userId,
    p_token_hash: input.tokenHash,
    p_sender_email: fromEmail,
    p_message_id: messageId,
  });

  if (claimError) {
    console.error("[inbound-email] claim failed");
    throw new Error(claimError.message);
  }

  const claimRow = (claim ?? {}) as {
    ok?: boolean;
    reason?: string;
    replay?: boolean;
    intake_item_id?: string;
  };
  if (!claimRow.ok) {
    return { ok: true, skipped: true, reason: claimRow.reason ?? "rejected" };
  }

  if (claimRow.replay && claimRow.intake_item_id) {
    const proposal = await proposeOutcome(
      admin,
      input.orgId,
      input.userId,
      claimRow.intake_item_id,
      triagePrompt(subject, body, [])
    );
    const { error: updateError } = await admin
      .from("intake_items")
      .update({
        status: "ready",
        ai_classification: proposal.outcome,
        ai_confidence: proposal.confidence,
        ai_extracted: proposal,
        processed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", claimRow.intake_item_id);
    if (updateError) throw new Error(updateError.message);
    return {
      ok: true,
      route: "member_intake",
      org_id: input.orgId,
      outcome: proposal.outcome,
      sender_verified: senderVerified,
      replay: true,
    };
  }

  const intakeId = crypto.randomUUID();
  const stored: StoredAttachment[] = [];
  let totalBytes = 0;
  const attachments = input.email.attachments ?? [];

  for (const attachment of attachments.slice(0, MAX_ATTACHMENTS + 4)) {
    const fileName = sanitizeFileName(attachment.filename || "attachment");
    const declared = (attachment.content_type || "application/octet-stream").toLowerCase();
    if (stored.filter((item) => item.accepted).length >= MAX_ATTACHMENTS) {
      stored.push({
        file_name: fileName,
        mime_type: declared,
        file_size: attachment.size ?? null,
        storage_path: null,
        sha256: null,
        accepted: false,
        reason: "too_many_attachments",
      });
      continue;
    }
    if (typeof attachment.size === "number" && attachment.size > MAX_ATTACHMENT_BYTES) {
      stored.push({
        file_name: fileName,
        mime_type: declared,
        file_size: attachment.size,
        storage_path: null,
        sha256: null,
        accepted: false,
        reason: "file_too_large",
      });
      continue;
    }
    if (!attachment.id) continue;

    try {
      const metaRes = await fetch(
        `https://api.resend.com/emails/receiving/${input.emailId}/attachments/${attachment.id}`,
        {
          headers: { Authorization: `Bearer ${input.resendApiKey}` },
          signal: AbortSignal.timeout(20_000),
        }
      );
      if (!metaRes.ok) {
        stored.push({
          file_name: fileName,
          mime_type: declared,
          file_size: attachment.size ?? null,
          storage_path: null,
          sha256: null,
          accepted: false,
          reason: "download_failed",
        });
        continue;
      }
      const meta = (await metaRes.json()) as { download_url?: string; filename?: string; content_type?: string };
      if (!meta.download_url) continue;
      const fileRes = await fetch(meta.download_url, { signal: AbortSignal.timeout(20_000) });
      if (!fileRes.ok) continue;
      const bytes = new Uint8Array(await fileRes.arrayBuffer());
      if (totalBytes + bytes.byteLength > MAX_TOTAL_ATTACHMENT_BYTES) {
        stored.push({
          file_name: fileName,
          mime_type: declared,
          file_size: bytes.byteLength,
          storage_path: null,
          sha256: null,
          accepted: false,
          reason: "total_too_large",
        });
        continue;
      }
      const inspected = inspectInboundAttachment({
        fileName: meta.filename || fileName,
        declaredMime: (attachment.content_type || meta.content_type || declared).toLowerCase(),
        bytes,
      });
      if (!inspected.ok) {
        stored.push({
          file_name: sanitizeFileName(meta.filename || fileName),
          mime_type: declared,
          file_size: bytes.byteLength,
          storage_path: null,
          sha256: await sha256Hex(bytes),
          accepted: false,
          reason: inspected.reason,
        });
        continue;
      }
      const cleaned = sanitizeFileName(meta.filename || fileName);
      const path = `orgs/${input.orgId}/inbox/${intakeId}/${Date.now()}-${cleaned}`;
      const { error: uploadError } = await admin.storage.from("inbox").upload(path, bytes, {
        contentType: inspected.mime,
        upsert: false,
      });
      if (uploadError) {
        stored.push({
          file_name: cleaned,
          mime_type: inspected.mime,
          file_size: bytes.byteLength,
          storage_path: null,
          sha256: await sha256Hex(bytes),
          accepted: false,
          reason: "upload_failed",
        });
        continue;
      }
      totalBytes += bytes.byteLength;
      stored.push({
        file_name: cleaned,
        mime_type: inspected.mime,
        file_size: bytes.byteLength,
        storage_path: path,
        sha256: await sha256Hex(bytes),
        accepted: true,
        text_excerpt: textExcerpt(bytes, inspected.mime),
      });
    } catch {
      console.error("[inbound-email] attachment skipped");
      stored.push({
        file_name: fileName,
        mime_type: declared,
        file_size: attachment.size ?? null,
        storage_path: null,
        sha256: null,
        accepted: false,
        reason: "attachment_error",
      });
    }
  }

  const first = stored.find((item) => item.accepted && item.storage_path);
  const provenance = {
    channel: "member_intake_email",
    message_id: messageId,
    email_id: input.emailId,
    received_at: input.receivedAt,
    recorded_at: new Date().toISOString(),
    from: fromEmail,
    to: addressList(input.email.to),
    cc: addressList(input.email.cc),
    envelope_recipients: input.envelopeRecipients.slice(0, 20),
    sender_verified: senderVerified,
    authorship: senderVerified ? "member" : "external",
    queue_owner_id: input.userId,
    subject,
    attachments: stored.map(({ text_excerpt: _excerpt, ...attachment }) => attachment),
  };

  const { data: created, error: createError } = await admin.rpc("create_member_email_intake", {
    p_org_id: input.orgId,
    p_queue_owner: input.userId,
    p_id: intakeId,
    p_raw_text: body,
    p_file_name: first?.file_name ?? `${subject.slice(0, 80)}.eml`,
    p_mime_type: first?.mime_type ?? "text/plain",
    p_file_size: first?.file_size ?? null,
    p_storage_path: first?.storage_path ?? null,
    p_provenance: provenance,
  });

  const createdRow = (Array.isArray(created) ? created[0] : created) as { id?: string } | null;
  if (createError || !createdRow?.id) {
    console.error("[inbound-email] create member intake failed");
    throw new Error(createError?.message || "Could not store email");
  }
  const intakeItemId = createdRow.id;

  const proposal = await proposeOutcome(
    admin,
    input.orgId,
    input.userId,
    intakeItemId,
    triagePrompt(subject, body, stored)
  );

  const { error: updateError } = await admin
    .from("intake_items")
    .update({
      status: "ready",
      ai_classification: proposal.outcome,
      ai_confidence: proposal.confidence,
      ai_extracted: proposal,
      processed_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", intakeItemId);

  if (updateError) {
    console.error("[inbound-email] proposal save failed");
    throw new Error(updateError.message);
  }

  return {
    ok: true,
    route: "member_intake",
    org_id: input.orgId,
    outcome: proposal.outcome,
    sender_verified: senderVerified,
    attachments: stored.filter((item) => item.accepted).length,
    replay: claimRow.replay === true,
  };
}
