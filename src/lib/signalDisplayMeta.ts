import type { SignalKind, ReviewState } from "@/types/workbenchSignals";
import type { SignalCategoryVariant, SignalConfidenceLevel } from "@/components/dashboard/issues/IssuesSignalListParts";

const RECENT_CATEGORY: Partial<
  Record<SignalKind, { label: string; variant: SignalCategoryVariant }>
> = {
  email: { label: "Maintenance", variant: "maintenance" },
  upload: { label: "Inspection", variant: "inspection" },
  message: { label: "Tenant", variant: "tenant" },
  ai_warning: { label: "Maintenance", variant: "maintenance" },
  document: { label: "Inspection", variant: "inspection" },
};

export function signalCategoryForKind(kind?: SignalKind): {
  label: string;
  variant: SignalCategoryVariant;
} | undefined {
  if (!kind) return undefined;
  return RECENT_CATEGORY[kind];
}

export function reviewConfidenceForFixture(input: {
  kind?: SignalKind;
  reviewState?: ReviewState;
}): SignalConfidenceLevel {
  if (input.kind === "ai_suggestion" || input.reviewState === "needs_classification") {
    return "low";
  }
  return "medium";
}

/** Human-readable subtitle for Recent signal rows (meta above title). */
export function formatRecentSignalSubtitle(context: string, kind?: SignalKind): string {
  const trimmed = context.trim();
  if (!trimmed) return "";

  if (kind === "email" && !/^email/i.test(trimmed)) {
    const actor = trimmed.split("•")[0]?.replace(/^from\s+/i, "").trim();
    const time = trimmed.includes("•") ? trimmed.split("•").slice(1).join("•").trim() : "";
    const label = actor ? `Email from ${toTitleWords(actor)}` : "Email";
    return time ? `${label} • ${time}` : label;
  }

  if (kind === "message" && !/^message/i.test(trimmed)) {
    const parts = trimmed.split("•").map((p) => p.trim());
    const time = parts.length > 1 ? parts[parts.length - 1] : "";
    return time ? `Message from tenant • ${time}` : "Message from tenant";
  }

  if (kind === "upload" && !/^photo/i.test(trimmed)) {
    const time = trimmed.includes("•") ? trimmed.split("•").pop()?.trim() : "";
    const place = trimmed.includes("•") ? trimmed.split("•")[0]?.trim() : trimmed;
    const label = place.toLowerCase().includes("kitchen") || place.toLowerCase().includes("unit")
      ? `Photo uploaded to ${toTitleWords(place.replace(/^justin\s*•?\s*/i, ""))}`
      : `Photo upload • ${toTitleWords(place)}`;
    return time ? `${label} • ${time}` : label;
  }

  return trimmed;
}

function toTitleWords(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
