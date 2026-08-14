import type { Json } from "@/integrations/supabase/types";

export type MessageReplyTo = {
  id: string;
  author_name: string;
  excerpt: string;
};

/** First three newline-separated lines of a message body (visual clamp still applies). */
export function firstThreeLines(body: string): string {
  return body.replace(/\r\n/g, "\n").split("\n").slice(0, 3).join("\n").trimEnd();
}

export function parseMessageReplyTo(raw: unknown): MessageReplyTo | null {
  if (!raw || typeof raw !== "object") return null;
  const reply = (raw as { reply_to?: unknown }).reply_to;
  if (!reply || typeof reply !== "object") return null;
  const row = reply as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.excerpt !== "string") return null;
  return {
    id: row.id,
    author_name: typeof row.author_name === "string" && row.author_name.trim() ? row.author_name : "Someone",
    excerpt: row.excerpt,
  };
}

export function buildReplyPayload(target: MessageReplyTo): Json {
  return {
    reply_to: {
      id: target.id,
      author_name: target.author_name,
      excerpt: target.excerpt,
    },
  };
}
