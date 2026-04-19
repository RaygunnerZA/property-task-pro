import type { SignalKind } from "@/types/workbenchSignals";

export type RecentSignalMetaInput = {
  kind?: SignalKind;
  context: string;
  /** Fallback when `kind` is missing (e.g. empty-state seed). */
  footChipLabel?: string;
};

function splitContext(context: string): { actorJoined: string; timePart: string } {
  const parts = context
    .split(/\s*•\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return { actorJoined: "", timePart: "" };
  if (parts.length === 1) return { actorJoined: "", timePart: parts[0]! };
  return {
    actorJoined: parts.slice(0, -1).join(" • "),
    timePart: parts[parts.length - 1]!,
  };
}

function formatTimeCaps(timePart: string): string {
  return timePart.replace(/,/g, "").replace(/\s+/g, " ").trim().toUpperCase();
}

/** First name / org handle for meta (caps); emails → local-part first token. */
export function metaActorCaps(actorJoined: string): string {
  let s = actorJoined.replace(/^from\s+/i, "").trim();
  if (!s) return "";
  const lower = s.toLowerCase();
  if (lower === "ai" || lower === "system") return "";
  if (s.includes("@")) {
    const local = s.split("@")[0]?.split("+")[0] ?? "";
    const firstToken = local
      .replace(/[._-]+/g, " ")
      .split(/\s+/)
      .filter(Boolean)[0];
    return (firstToken ?? "UNKNOWN").toUpperCase();
  }
  const first = s.split(/\s+/)[0] ?? s;
  return first.toUpperCase();
}

function lineWithBullet(left: string, timeCaps: string): string {
  const L = left.trim();
  const T = timeCaps.trim();
  if (!L && !T) return "";
  if (!L) return T;
  if (!T) return L;
  return `${L} • ${T}`;
}

/**
 * Single all-caps mono line for Issues “Recent signals” (above title).
 * Examples: `EMAIL FROM FACILITIES • 22 FEB 06:00`, `AI WARNING • 2 MIN AGO`.
 */
export function buildRecentUnifiedSignalMetaLine(input: RecentSignalMetaInput): string {
  const { kind, context, footChipLabel } = input;
  const { actorJoined, timePart } = splitContext(context);
  const timeCaps = formatTimeCaps(timePart);
  const actor = metaActorCaps(actorJoined);

  if (!kind) {
    const chip = footChipLabel?.trim();
    if (chip) {
      return lineWithBullet(chip.toUpperCase(), timeCaps || context.trim().toUpperCase());
    }
    return context.trim().toUpperCase();
  }

  switch (kind) {
    case "message":
      return lineWithBullet(actor ? `MESSAGE FROM ${actor}` : "MESSAGE", timeCaps);
    case "email":
      return lineWithBullet(actor ? `EMAIL FROM ${actor}` : "EMAIL", timeCaps);
    case "upload":
      return lineWithBullet(actor ? `PHOTO UPLOAD BY ${actor}` : "PHOTO UPLOAD", timeCaps);
    case "ai_warning":
      return lineWithBullet("AI WARNING", timeCaps);
    case "ai_suggestion":
      return lineWithBullet("AI SUGGESTION", timeCaps);
    case "conflict":
      return lineWithBullet("SCHEDULING", timeCaps);
    case "admin":
      return lineWithBullet("ADMIN REMINDER", timeCaps);
    case "weather":
      return lineWithBullet("WEATHER ALERT", timeCaps);
    case "document":
      return lineWithBullet("DOCUMENT", timeCaps);
    case "system":
      return lineWithBullet("SYSTEM EVENT", timeCaps);
    default:
      return lineWithBullet((footChipLabel ?? "SIGNAL").trim().toUpperCase(), timeCaps);
  }
}
