/**
 * Resend inbound email webhook adapter.
 * @see https://resend.com/docs/dashboard/receiving/introduction
 */

export interface ResendWebhookEvent {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    from?: string;
    to?: string[];
    subject?: string;
    message_id?: string;
    attachments?: Array<{
      id: string;
      filename: string;
      content_type?: string;
      size?: number;
    }>;
  };
}

export interface ResendReceivedEmail {
  id: string;
  from: string;
  to: string[];
  subject?: string;
  text?: string | null;
  html?: string | null;
  message_id?: string;
  attachments?: Array<{
    id: string;
    filename: string;
    content_type?: string;
    size?: number;
  }>;
}

export interface ResendAttachmentMeta {
  download_url: string;
  filename: string;
  content_type?: string;
}

export function parseSenderEmail(from: string): string {
  const trimmed = from.trim();
  const angle = trimmed.match(/<([^>]+)>/);
  if (angle?.[1]) return angle[1].trim().toLowerCase();
  if (trimmed.includes("@")) return trimmed.toLowerCase();
  return trimmed.toLowerCase();
}

/** Extract intake token from local-part: slug+token or token */
export function parseIntakeTokenFromAddress(address: string): string | null {
  const local = address.split("@")[0]?.trim().toLowerCase();
  if (!local) return null;
  const plusIdx = local.lastIndexOf("+");
  const token = plusIdx >= 0 ? local.slice(plusIdx + 1) : local;
  return token.length >= 8 ? token : null;
}

export async function fetchResendReceivedEmail(
  apiKey: string,
  emailId: string
): Promise<ResendReceivedEmail> {
  const key = apiKey.trim();
  if (key.startsWith("whsec_")) {
    throw new Error(
      "RESEND_API_KEY looks like a webhook secret (whsec_). Use a Full access API key (re_...) from Resend → API Keys."
    );
  }

  const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { message?: string; name?: string };
      detail = body.message || body.name || "";
    } catch {
      // ignore
    }
    if (res.status === 401) {
      throw new Error(
        `Resend get email failed (401)${detail ? `: ${detail}` : ""}. ` +
          "Create a Full access API key (not Sending only) in Resend → API Keys, then: supabase secrets set RESEND_API_KEY=re_..."
      );
    }
    throw new Error(`Resend get email failed (${res.status})${detail ? `: ${detail}` : ""}`);
  }
  return (await res.json()) as ResendReceivedEmail;
}

/** Webhook metadata only — no body until Receiving API fetch succeeds. */
export function receivedEmailFromWebhook(
  event: ResendWebhookEvent,
  emailId: string
): ResendReceivedEmail {
  const d = event.data;
  return {
    id: emailId,
    from: d?.from ?? "",
    to: d?.to ?? [],
    subject: d?.subject,
    text: null,
    html: null,
    message_id: d?.message_id,
    attachments: d?.attachments,
  };
}

export async function fetchResendAttachmentDownload(
  apiKey: string,
  emailId: string,
  attachmentId: string
): Promise<ResendAttachmentMeta> {
  const res = await fetch(
    `https://api.resend.com/emails/receiving/${emailId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );
  if (!res.ok) {
    throw new Error(`Resend get attachment failed (${res.status})`);
  }
  const payload = (await res.json()) as ResendAttachmentMeta & { filename?: string; content_type?: string };
  if (!payload.download_url) {
    throw new Error("Resend attachment missing download_url");
  }
  return {
    download_url: payload.download_url,
    filename: payload.filename ?? "attachment",
    content_type: payload.content_type,
  };
}

/** Svix-style webhook verification (Resend uses Svix). */
export async function verifyResendWebhook(
  rawBody: string,
  headers: Headers,
  secret: string
): Promise<ResendWebhookEvent> {
  const msgId = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signature = headers.get("svix-signature");

  if (!msgId || !timestamp || !signature || !secret) {
    throw new Error("Missing webhook verification headers or secret");
  }

  const ts = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 300) {
    throw new Error("Webhook timestamp too old");
  }

  const secretBytes = secret.startsWith("whsec_")
    ? Uint8Array.from(atob(secret.slice(6)), (c) => c.charCodeAt(0))
    : new TextEncoder().encode(secret);

  const signedContent = `${msgId}.${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedContent));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));

  const passed = signature
    .split(" ")
    .some((part) => {
      const [, sigPart] = part.split(",");
      return sigPart === expected;
    });

  if (!passed) {
    throw new Error("Invalid webhook signature");
  }

  return JSON.parse(rawBody) as ResendWebhookEvent;
}

export function plainTextFromEmail(email: ResendReceivedEmail): string {
  if (email.text?.trim()) return email.text.trim();
  if (email.html) {
    return email.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  return email.subject?.trim() ?? "";
}
