import { useMemo, useRef, useState } from "react";
import {
  type AttentionItem,
  type ComplianceRecord,
  daysUntil,
  formatDueText,
  mapSignalFixtureToAttentionItem,
  normalizeComplianceStatus,
} from "@/components/dashboard/issues/issuesAttentionItem";
import { useCompliancePortfolioQuery } from "@/hooks/useCompliancePortfolioQuery";
import { useSignalUiFixturesEnabled } from "@/hooks/useSignalUiFixtures";
import { useSignalsQuery } from "@/hooks/useSignalsQuery";
import { useSignalActions } from "@/hooks/useSignalActions";
import { usePromoteExternalEmailSignal } from "@/hooks/usePromoteExternalEmailSignal";
import { mapSignalRowToAttentionItem } from "@/lib/signals/mapSignalRowToAttentionItem";
import {
  SIGNAL_UI_FIXTURES_RECENT,
  SIGNAL_UI_FIXTURES_REVIEW,
  SIGNAL_UI_FIXTURES_URGENT,
} from "@/fixtures/signalUiSamples";
import type { RecordsView } from "@/lib/propertyRoutes";
import {
  isPropertySubsetSelected,
  recordMatchesPropertyScope,
} from "@/utils/propertyFilter";

export type UseWorkbenchAttentionStreamOptions = {
  properties: { id: string; nickname?: string; address?: string }[];
  selectedPropertyIds?: Set<string>;
  onTabChange?: (tab: string) => void;
  onRecordsViewChange?: (view: RecordsView) => void;
  /** When true, skip dev signal fixtures; education UI uses dedicated fixtures. */
  onboardingEducationMode?: boolean;
  /** Opens Add to Filla sheet after promoting an external email signal. */
  onOpenAddToFilla?: () => void;
};

function propertyLabel(
  properties: { id: string; nickname?: string; address?: string }[],
  propertyId: string | null | undefined
): string | undefined {
  if (!propertyId) return undefined;
  const p = properties.find((x) => x.id === propertyId);
  return p?.nickname || p?.address;
}

/** Collapse identical review cards; surface a count when several share the same decision. */
function collapseReviewAttentionItems(items: AttentionItem[]): AttentionItem[] {
  const groups = new Map<string, AttentionItem[]>();
  for (const item of items) {
    const seed = item.complianceSeed;
    const key = seed
      ? `${seed.propertyId ?? "none"}|${seed.complianceType}|${seed.title}`
      : item.id;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  return Array.from(groups.values()).map((group) => {
    const first = group[0]!;
    if (group.length === 1) return first;
    const typeLabel =
      first.complianceSeed?.complianceType && first.complianceSeed.complianceType !== "General"
        ? first.complianceSeed.complianceType
        : "documents";
    return {
      ...first,
      id: `review-collapsed-${first.id}`,
      title: `${group.length} ${typeLabel} need a decision`,
      whyHere: `${group.length} related items need the same kind of decision.`,
      description: `Open Issues or Records to work through all ${group.length}, or convert the first and continue from there.`,
      fixtureActions: {
        primary: { id: "signal-convert", label: "Convert to record" },
        secondary: [{ id: "dismiss", label: "Dismiss" }],
      },
    };
  });
}

function complianceNeedsDecision(record: ComplianceRecord): boolean {
  if (record.status === "expiring") return true;
  if (record.status !== "missing") return false;
  // Explicit missing obligations only — not untyped undated noise.
  const hasTypedDoc = record.complianceType !== "General";
  const hasRealTitle =
    Boolean(record.title) &&
    record.title !== "Compliance Record" &&
    record.title !== "General";
  return hasTypedDoc || hasRealTitle;
}

function complianceReviewTitle(record: ComplianceRecord): string {
  const hasRealTitle =
    Boolean(record.title) &&
    record.title !== "Compliance Record" &&
    record.title !== record.complianceType;
  const base = hasRealTitle
    ? record.title
    : record.complianceType !== "General"
      ? record.complianceType
      : record.title || "Document";
  return record.status === "missing" ? `${base} — needs a decision` : `${base} — confirm renewal`;
}

export function useWorkbenchAttentionStream({
  properties,
  selectedPropertyIds,
  onTabChange,
  onRecordsViewChange,
  onboardingEducationMode = false,
  onOpenAddToFilla,
}: UseWorkbenchAttentionStreamOptions) {
  const allPropertyIds = useMemo(() => properties.map((p) => p.id), [properties]);
  const propertySubsetSelected = isPropertySubsetSelected(selectedPropertyIds, allPropertyIds);

  const propertyIdsForSignals = useMemo(() => {
    if (!propertySubsetSelected || !selectedPropertyIds) return undefined;
    return Array.from(selectedPropertyIds).filter((id) => allPropertyIds.includes(id));
  }, [propertySubsetSelected, selectedPropertyIds, allPropertyIds]);

  const signalUiFixturesEnabled = useSignalUiFixturesEnabled();
  const { data: compliancePortfolio = [] } = useCompliancePortfolioQuery();
  const { data: platformSignals = [] } = useSignalsQuery({
    propertyIds: propertyIdsForSignals,
  });
  const { dismiss, snooze, acceptRecommendation } = useSignalActions();
  const promoteExternalEmail = usePromoteExternalEmailSignal();

  const [resolvedAttentionIds, setResolvedAttentionIds] = useState<Set<string>>(new Set());
  const [attentionComplianceDrafts, setAttentionComplianceDrafts] = useState<ComplianceRecord[]>([]);
  const attentionCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const complianceRecords = useMemo<ComplianceRecord[]>(() => {
    const portfolioRows = propertySubsetSelected
      ? (compliancePortfolio as any[]).filter((row) =>
          recordMatchesPropertyScope(row.property_id, selectedPropertyIds, allPropertyIds)
        )
      : (compliancePortfolio as any[]);

    const recordsFromView = portfolioRows.map((row) => {
      const title = row.title || row.document_type || "Compliance Record";
      const propertyName =
        row.property_name ||
        propertyLabel(properties, row.property_id) ||
        "Unassigned property";
      const dueOrExpiry = row.next_due_date || row.expiry_date;
      const computedStatus = normalizeComplianceStatus(row.expiry_state || row.status);
      const dayDelta = daysUntil(dueOrExpiry);

      let status = computedStatus;
      if (status === "healthy" && dayDelta !== null && dayDelta <= 30 && dayDelta >= 0) {
        status = "expiring";
      }
      if (status === "healthy" && dayDelta !== null && dayDelta < 0) {
        status = "overdue";
      }

      return {
        id: String(row.id || `compliance-${Math.random().toString(36).slice(2, 10)}`),
        title,
        propertyName,
        propertyId: row.property_id,
        complianceType: row.document_type || "General",
        expiryDate: row.expiry_date,
        nextDueDate: row.next_due_date,
        status,
        linkedDocument: row.title || row.document_type || "Document",
        inspectionHistory: row.next_due_date
          ? [`Next due ${formatDueText(row.next_due_date)}`]
          : ["No inspection history yet"],
        linkedTasks: [],
        notes:
          row.hazards?.length > 0
            ? `Potential hazards: ${row.hazards.join(", ")}`
            : "No hazards flagged.",
      } as ComplianceRecord;
    });

    const merged = [
      ...attentionComplianceDrafts.filter((record) =>
        recordMatchesPropertyScope(record.propertyId, selectedPropertyIds, allPropertyIds)
      ),
      ...recordsFromView,
    ];
    const byId = new Map<string, ComplianceRecord>();
    merged.forEach((record) => {
      if (!byId.has(record.id)) byId.set(record.id, record);
    });
    return Array.from(byId.values());
  }, [
    attentionComplianceDrafts,
    compliancePortfolio,
    properties,
    propertySubsetSelected,
    selectedPropertyIds,
    allPropertyIds,
  ]);

  const attentionItems = useMemo<AttentionItem[]>(() => {
    const includeFixtures = signalUiFixturesEnabled && !propertySubsetSelected && !onboardingEducationMode;
    const fixtureUrgent = includeFixtures
      ? SIGNAL_UI_FIXTURES_URGENT.map(mapSignalFixtureToAttentionItem)
      : [];
    const fixtureReview = includeFixtures
      ? SIGNAL_UI_FIXTURES_REVIEW.map(mapSignalFixtureToAttentionItem)
      : [];
    const fixtureRecent = includeFixtures
      ? SIGNAL_UI_FIXTURES_RECENT.map((f, i) => mapSignalFixtureToAttentionItem(f, i))
      : [];

    const fromPlatformSignals = platformSignals.map((row) =>
      mapSignalRowToAttentionItem(row, propertyLabel(properties, row.property_id))
    );

    const urgentFromSignals = fromPlatformSignals.filter((i) => i.group === "urgent");
    const reviewFromSignals = fromPlatformSignals.filter((i) => i.group === "review");
    // Recent = platform “something happened” — not a chat inbox (exclude bare message kind).
    const recentFromSignals = fromPlatformSignals.filter(
      (i) => i.group === "recent" && i.signalKind !== "message"
    );

    const urgentFromData: AttentionItem[] = complianceRecords
      .filter((record) => record.status === "overdue")
      .slice(0, 4)
      .map((record) => ({
        id: `urgent-${record.id}`,
        group: "urgent" as const,
        signalKind: "document" as const,
        title: `Possible ${record.complianceType.toLowerCase()} risk`,
        context: `${record.propertyName} • ${formatDueText(record.nextDueDate || record.expiryDate)}`,
        footChipLabel: "COMPLIANCE RISK",
        description: `${record.title} is overdue and may need immediate attention.`,
        fixtureActions: {
          primary: { id: "report-issue", label: "Create Task" },
          secondary: [{ id: "dismiss", label: "Dismiss" }],
        },
      }));

    const reviewFromData: AttentionItem[] = collapseReviewAttentionItems(
      complianceRecords
        .filter(complianceNeedsDecision)
        .slice(0, 12)
        .map((record) => {
          const whyHere =
            record.status === "missing"
              ? "Not sure this belongs in compliance tracking yet."
              : "Expiry or renewal timing needs confirmation.";
          return {
            id: `review-${record.id}`,
            group: "review" as const,
            signalKind: "document" as const,
            title: complianceReviewTitle(record),
            context: record.propertyName,
            whyHere,
            footChipLabel: "DOCUMENT",
            description:
              record.status === "missing"
                ? "Classify it, assign an owner, or convert it into a stored record."
                : "Confirm how Filla should treat the renewal before it becomes overdue work.",
            complianceSeed: {
              title: record.title,
              propertyName: record.propertyName,
              propertyId: record.propertyId,
              complianceType: record.complianceType,
            },
            fixtureActions: {
              primary: { id: "signal-convert", label: "Convert to record" },
              secondary: [{ id: "dismiss", label: "Dismiss" }],
            },
          };
        })
    );

    // Signals = platform signal stream (uploads, email, weather, AI, …).
    const urgent = [...fixtureUrgent, ...urgentFromSignals, ...urgentFromData];
    const review = [...fixtureReview, ...reviewFromSignals, ...reviewFromData];
    const recent = [...fixtureRecent, ...recentFromSignals];

    // Prefer a calm empty over a placeholder “signal” card in the feed.
    if (urgent.length === 0 && review.length === 0 && recent.length === 0) {
      return [];
    }

    return [...urgent, ...review, ...recent];
  }, [
    complianceRecords,
    platformSignals,
    properties,
    propertySubsetSelected,
    signalUiFixturesEnabled,
    onboardingEducationMode,
  ]);

  const unresolvedAttentionItems = useMemo(
    () => attentionItems.filter((item) => !resolvedAttentionIds.has(item.id)),
    [attentionItems, resolvedAttentionIds]
  );

  const groupedAttentionItems = useMemo(() => {
    const urgent = unresolvedAttentionItems.filter((item) => item.group === "urgent");
    const review = unresolvedAttentionItems.filter((item) => item.group === "review");
    const recent = unresolvedAttentionItems.filter((item) => item.group === "recent");
    return { urgent, review, recent };
  }, [unresolvedAttentionItems]);

  const resolveAttentionItem = (itemId: string) => {
    setResolvedAttentionIds((prev) => {
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });
  };

  const handleSignalAction = async (
    actionId: string,
    item: AttentionItem
  ): Promise<boolean> => {
    if (!item.signalId) return false;
    if (actionId === "signal-accept") {
      await acceptRecommendation.mutateAsync(item.signalId);
      resolveAttentionItem(item.id);
      return true;
    }
    if (actionId === "signal-snooze") {
      await snooze.mutateAsync(item.signalId);
      resolveAttentionItem(item.id);
      return true;
    }
    if (actionId === "dismiss" || actionId === "ignore") {
      await dismiss.mutateAsync(item.signalId);
      resolveAttentionItem(item.id);
      return true;
    }
    if (actionId === "signal-promote-intake") {
      await promoteExternalEmail.mutateAsync(item.signalId);
      resolveAttentionItem(item.id);
      onOpenAddToFilla?.();
      return true;
    }
    return false;
  };

  const addAttentionItemToCompliance = (item: AttentionItem) => {
    if (!item.complianceSeed) return;
    const newRecord: ComplianceRecord = {
      id: `attention-${item.id}`,
      title: item.complianceSeed.title,
      propertyName: item.complianceSeed.propertyName,
      propertyId: item.complianceSeed.propertyId,
      complianceType: item.complianceSeed.complianceType,
      expiryDate: null,
      nextDueDate: null,
      status: "missing",
      linkedDocument: "Pending document",
      inspectionHistory: ["Created from Issues"],
      linkedTasks: [],
      notes: "Promoted from Issues for compliance tracking.",
    };

    setAttentionComplianceDrafts((prev) => {
      if (prev.some((record) => record.id === newRecord.id)) return prev;
      return [newRecord, ...prev];
    });
    onTabChange?.("records");
    onRecordsViewChange?.("missing");
  };

  return {
    groupedAttentionItems,
    attentionCardRefs,
    resolveAttentionItem,
    handleSignalAction,
    addAttentionItemToCompliance,
  };
}
