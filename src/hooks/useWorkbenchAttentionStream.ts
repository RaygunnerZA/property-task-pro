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
import {
  SIGNAL_UI_FIXTURES_RECENT,
  SIGNAL_UI_FIXTURES_REVIEW,
  SIGNAL_UI_FIXTURES_URGENT,
} from "@/fixtures/signalUiSamples";
import type { RecordsView } from "@/lib/propertyRoutes";

export type UseWorkbenchAttentionStreamOptions = {
  properties: { id: string }[];
  selectedPropertyIds?: Set<string>;
  onTabChange?: (tab: string) => void;
  onRecordsViewChange?: (view: RecordsView) => void;
};

export function useWorkbenchAttentionStream({
  properties,
  selectedPropertyIds,
  onTabChange,
  onRecordsViewChange,
}: UseWorkbenchAttentionStreamOptions) {
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

  const { messages } = useMessages(messagesOptions);
  const signalUiFixturesEnabled = useSignalUiFixturesEnabled();
  const { data: compliancePortfolio = [] } = useCompliancePortfolioQuery();

  const [resolvedAttentionIds, setResolvedAttentionIds] = useState<Set<string>>(new Set());
  const [attentionComplianceDrafts, setAttentionComplianceDrafts] = useState<ComplianceRecord[]>([]);
  const attentionCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const complianceRecords = useMemo<ComplianceRecord[]>(() => {
    const recordsFromView = (compliancePortfolio as any[]).map((row) => {
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

    const merged = [...attentionComplianceDrafts, ...recordsFromView];
    const byId = new Map<string, ComplianceRecord>();
    merged.forEach((record) => {
      if (!byId.has(record.id)) byId.set(record.id, record);
    });
    return Array.from(byId.values());
  }, [attentionComplianceDrafts, compliancePortfolio]);

  const attentionItems = useMemo<AttentionItem[]>(() => {
    const fixtureUrgent = signalUiFixturesEnabled
      ? SIGNAL_UI_FIXTURES_URGENT.map(mapSignalFixtureToAttentionItem)
      : [];
    const fixtureReview = signalUiFixturesEnabled
      ? SIGNAL_UI_FIXTURES_REVIEW.map(mapSignalFixtureToAttentionItem)
      : [];
    const fixtureRecent = signalUiFixturesEnabled
      ? SIGNAL_UI_FIXTURES_RECENT.map((f, i) => mapSignalFixtureToAttentionItem(f, i))
      : [];

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

    const urgent = [...fixtureUrgent, ...urgentFromData];
    const review = [...fixtureReview, ...reviewFromData];
    const recent = [...fixtureRecent, ...recentFromData];

    if (urgent.length === 0 && review.length === 0 && recent.length === 0) {
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
  }, [complianceRecords, messages, signalUiFixturesEnabled]);

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
    addAttentionItemToCompliance,
  };
}
