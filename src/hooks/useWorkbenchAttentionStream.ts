import { useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  type AttentionItem,
  type ComplianceRecord,
  daysUntil,
  formatAuthorDisplayName,
  formatDueText,
  mapSignalFixtureToAttentionItem,
  normalizeComplianceStatus,
} from "@/components/dashboard/issues/issuesAttentionItem";
import { useMessages, type UseMessagesOptions } from "@/hooks/useMessages";
import { useCompliancePortfolioQuery } from "@/hooks/useCompliancePortfolioQuery";
import { useSignalUiFixturesEnabled } from "@/hooks/useSignalUiFixtures";
import { useSignalsQuery } from "@/hooks/useSignalsQuery";
import { useSignalActions } from "@/hooks/useSignalActions";
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
};

function propertyLabel(
  properties: { id: string; nickname?: string; address?: string }[],
  propertyId: string | null
): string | undefined {
  if (!propertyId) return undefined;
  const p = properties.find((x) => x.id === propertyId);
  return p?.nickname || p?.address;
}

export function useWorkbenchAttentionStream({
  properties,
  selectedPropertyIds,
  onTabChange,
  onRecordsViewChange,
}: UseWorkbenchAttentionStreamOptions) {
  const allPropertyIds = useMemo(() => properties.map((p) => p.id), [properties]);
  const propertySubsetSelected = isPropertySubsetSelected(selectedPropertyIds, allPropertyIds);

  const messagesOptions = useMemo<UseMessagesOptions | undefined>(() => {
    const n = properties.length;
    if (n === 0) return undefined;
    if (
      !selectedPropertyIds ||
      selectedPropertyIds.size === 0 ||
      selectedPropertyIds.size >= n
    ) {
      return undefined;
    }
    return {
      propertyScope: {
        selectedIds: Array.from(selectedPropertyIds),
        totalPropertyCount: n,
      },
    };
  }, [properties.length, selectedPropertyIds]);

  const propertyIdsForSignals = useMemo(() => {
    if (!propertySubsetSelected || !selectedPropertyIds) return undefined;
    return Array.from(selectedPropertyIds).filter((id) => allPropertyIds.includes(id));
  }, [propertySubsetSelected, selectedPropertyIds, allPropertyIds]);

  const { messages } = useMessages(messagesOptions);
  const signalUiFixturesEnabled = useSignalUiFixturesEnabled();
  const { data: compliancePortfolio = [] } = useCompliancePortfolioQuery();
  const { data: platformSignals = [] } = useSignalsQuery({
    propertyIds: propertyIdsForSignals,
  });
  const { dismiss, snooze, acceptRecommendation } = useSignalActions();

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
      const propertyName = row.property_name || "Unassigned property";
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
    propertySubsetSelected,
    selectedPropertyIds,
    allPropertyIds,
  ]);

  const attentionItems = useMemo<AttentionItem[]>(() => {
    const includeFixtures = signalUiFixturesEnabled && !propertySubsetSelected;
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
    const recentFromSignals = fromPlatformSignals.filter((i) => i.group === "recent");

    const urgentFromData: AttentionItem[] = complianceRecords
      .filter((record) => record.status === "overdue")
      .slice(0, 4)
      .map((record) => ({
        id: `urgent-${record.id}`,
        group: "urgent" as const,
        title: `Possible ${record.complianceType.toLowerCase()} risk`,
        context: `${record.propertyName} • ${formatDueText(record.nextDueDate || record.expiryDate)}`,
        footChipLabel: "COMPLIANCE RISK",
        description: `${record.title} is overdue and may need immediate attention.`,
      }));

    const reviewFromData: AttentionItem[] = complianceRecords
      .filter((record) => record.status === "expiring" || record.status === "missing")
      .slice(0, 8)
      .map((record) => {
        const whyHere =
          record.status === "missing"
            ? "Not sure this belongs in compliance tracking yet."
            : "Expiry or renewal timing needs confirmation.";
        return {
          id: `review-${record.id}`,
          group: "review" as const,
          title: `${record.complianceType} — needs a decision`,
          context: record.propertyName,
          whyHere,
          description:
            record.status === "missing"
              ? "The system is not sure this belongs in compliance tracking yet. Classify it, assign an owner, or convert it into a stored record."
              : `Expiry or renewal timing may need confirmation before it becomes a tracked obligation. Decide how Filla should treat it.`,
          complianceSeed: {
            title: record.title,
            propertyName: record.propertyName,
            propertyId: record.propertyId,
            complianceType: record.complianceType,
          },
        };
      });

    const recentFromData: AttentionItem[] = messages.slice(0, 10).map((message: any) => {
      const authorName = formatAuthorDisplayName(message.author_name);
      const body = message.body ? String(message.body).replace(/\s+/g, " ").trim() : "";
      const titleFromBody =
        body.length > 0
          ? body.slice(0, 72) + (body.length > 72 ? "…" : "")
          : `Message from ${authorName}`;
      return {
        id: `recent-msg-${message.id}`,
        group: "recent" as const,
        signalKind: "message" as const,
        messageId: message.id,
        footChipLabel: "TENANT MESSAGE",
        title: titleFromBody,
        context: `${authorName} • ${format(new Date(message.created_at), "dd MMM, HH:mm")}`,
        description:
          body.length > 120 ? `${body.slice(0, 120)}…` : body || "Something new arrived — open it when you are ready to triage.",
        occurredAt: new Date(message.created_at).getTime(),
      };
    });

    const urgent = [...fixtureUrgent, ...urgentFromSignals, ...urgentFromData];
    const review = [...fixtureReview, ...reviewFromSignals, ...reviewFromData];
    const recent = [...fixtureRecent, ...recentFromSignals, ...recentFromData];

    if (urgent.length === 0 && review.length === 0 && recent.length === 0) {
      if (propertySubsetSelected) {
        return [];
      }
      return [
        {
          id: "recent-empty-seed",
          group: "recent" as const,
          title: "No signals in your timeline yet",
          context: "This is your inbox of “something happened”",
          footChipLabel: "GETTING STARTED",
          description:
            "Uploads, messages, documents, and system events will appear here as a raw feed — before they become tasks or records. Use Report Issue or Add Record when you want to log something manually.",
        },
      ];
    }

    return [...urgent, ...review, ...recent];
  }, [
    complianceRecords,
    messages,
    platformSignals,
    properties,
    propertySubsetSelected,
    signalUiFixturesEnabled,
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
