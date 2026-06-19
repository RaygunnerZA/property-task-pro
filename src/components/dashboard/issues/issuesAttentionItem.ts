import { format, startOfDay } from "date-fns";
import type { SignalUiFixture } from "@/fixtures/signalUiSamples";
import type { SignalKind } from "@/types/workbenchSignals";
import { SIGNAL_KIND_FOOT_LABEL } from "@/types/workbenchSignals";
import type {
  SignalCategoryVariant,
  SignalConfidenceLevel,
} from "@/components/dashboard/issues/IssuesSignalListParts";
import {
  formatRecentSignalSubtitle,
  reviewConfidenceForFixture,
  signalCategoryForKind,
} from "@/lib/signalDisplayMeta";
import type { SignalFeedDetailSnapshot } from "@/components/dashboard/SignalFeedDetailPanel";

export type AttentionGroup = "urgent" | "review" | "recent";

export type ComplianceStatus = "healthy" | "expiring" | "overdue" | "missing";

export interface ComplianceRecord {
  id: string;
  title: string;
  propertyName: string;
  propertyId?: string | null;
  complianceType: string;
  expiryDate?: string | null;
  nextDueDate?: string | null;
  status: ComplianceStatus;
  linkedDocument: string;
  inspectionHistory: string[];
  linkedTasks: string[];
  notes: string;
}

export interface AttentionItem {
  id: string;
  group: AttentionGroup;
  title: string;
  context: string;
  hint?: string;
  signalLabels?: string[];
  description?: string;
  imageUrl?: string | null;
  messageId?: string;
  /** Persisted platform signal id (when sourced from signals table) */
  signalId?: string;
  signalSubtype?: string;
  recommendation?: Record<string, unknown>;
  signalPayload?: Record<string, unknown>;
  complianceSeed?: {
    title: string;
    propertyName: string;
    propertyId?: string | null;
    complianceType: string;
  };
  signalKind?: SignalKind;
  typeChipLabel?: string;
  footChipLabel?: string;
  reviewBanner?: string;
  whyHere?: string;
  isUiFixture?: boolean;
  /** Onboarding / education example row (not real operational data). */
  isOnboardingExample?: boolean;
  fixtureActions?: {
    primary: { id: string; label: string };
    secondary?: { id: string; label: string }[];
  };
  confidenceLevel?: SignalConfidenceLevel;
  categoryTag?: string;
  categoryTagVariant?: SignalCategoryVariant;
  recentSubtitle?: string;
  occurredAt?: number;
}

export function mapSignalFixtureToAttentionItem(
  f: SignalUiFixture,
  fixtureIndex = 0
): AttentionItem {
  const group: AttentionGroup =
    f.disposition === "needs_review" ? "review" : f.disposition === "urgent" ? "urgent" : "recent";
  const category = f.categoryTag
    ? { label: f.categoryTag, variant: f.categoryTagVariant ?? "default" }
    : signalCategoryForKind(f.kind);

  return {
    id: f.id,
    group,
    title: f.title,
    context: f.contextLine,
    description: f.explanation,
    whyHere: f.whyHere,
    footChipLabel: group === "review" ? undefined : SIGNAL_KIND_FOOT_LABEL[f.kind],
    reviewBanner: undefined,
    signalKind: f.kind,
    isUiFixture: true,
    fixtureActions: {
      primary: f.primaryAction,
      secondary: f.secondaryActions,
    },
    hint: undefined,
    confidenceLevel: f.confidenceLevel ?? reviewConfidenceForFixture(f),
    categoryTag: category?.label,
    categoryTagVariant: category?.variant,
    recentSubtitle: f.recentSubtitle,
    occurredAt: group === "recent" ? Date.now() - fixtureIndex * 60_000 : undefined,
  };
}

export function normalizeComplianceStatus(rawState?: string | null): ComplianceStatus {
  const state = String(rawState || "").toLowerCase();
  if (state.includes("overdue") || state.includes("expired")) return "overdue";
  if (state.includes("missing") || state.includes("none")) return "missing";
  if (state.includes("expiring") || state.includes("due_soon")) return "expiring";
  if (state.includes("valid") || state.includes("healthy")) return "healthy";
  return "healthy";
}

export function daysUntil(dateString?: string | null): number | null {
  if (!dateString) return null;
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return null;
  const now = startOfDay(new Date());
  const due = startOfDay(parsed);
  const diff = due.getTime() - now.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

export function formatDueText(dateString?: string | null): string {
  if (!dateString) return "No expiry date";
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return "No expiry date";
  return format(parsed, "dd MMM yyyy");
}

export function formatAuthorDisplayName(rawAuthor?: string | null): string {
  const author = String(rawAuthor || "").trim();
  if (!author) return "Unknown";
  if (!author.includes("@")) return author;

  const localPart = author.split("@")[0] || "";
  const base = localPart.split("+")[0] || localPart;
  const tokens = base
    .replace(/[._-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) return "Unknown";

  return tokens
    .map((token) =>
      token.length <= 2
        ? token.toUpperCase()
        : `${token.charAt(0).toUpperCase()}${token.slice(1).toLowerCase()}`
    )
    .join(" ");
}

export function attentionItemToSignalSnapshot(item: AttentionItem): SignalFeedDetailSnapshot {
  return {
    id: item.id,
    group: item.group,
    title: item.title,
    context: item.context,
    description: item.description,
    whyHere: item.whyHere,
    footChipLabel: item.footChipLabel,
    signalKind: item.signalKind,
    messageId: item.messageId,
    complianceSeed: item.complianceSeed,
    recommendation: item.recommendation,
    signalSubtype: item.signalSubtype,
    signalId: item.signalId,
    signalPayload: item.signalPayload,
  };
}
