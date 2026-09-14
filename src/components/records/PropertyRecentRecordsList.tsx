import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { FileText, Shield } from "lucide-react";
import type { PropertyDocument } from "@/hooks/property/usePropertyDocuments";
import type { ComplianceRecord } from "@/components/records/complianceRecordModel";
import { SampleContentLessonDialog } from "@/components/onboarding/SampleContentLessonDialog";
import { DemoContentLabel } from "@/components/dashboard/issues/IssuesSignalListParts";
import { RecentPanel, RecentPanelRow } from "@/components/property-workspace";
import { getRecordGroup } from "@/lib/records/recordGroups";
import {
  dismissOnboardingSample,
  isSeededSampleContent,
  ONBOARDING_SAMPLE_DISMISSED_EVENT,
  readDismissedOnboardingSampleIds,
  seededSampleDismissId,
  shouldAutoHideSeededSamples,
} from "@/lib/onboardingEducation";
import { cn } from "@/lib/utils";

type RecentItem = {
  id: string;
  kind: "document" | "compliance";
  title: string;
  subtitle: string;
  at: string;
  accent: string;
  isSample: boolean;
  dismissId: string;
};

type PropertyRecentRecordsListProps = {
  documents: PropertyDocument[];
  complianceRecords: ComplianceRecord[];
  onOpenDocument?: (id: string) => void;
  onOpenCompliance?: (id: string) => void;
  className?: string;
  limit?: number;
  /** When true, omit the section title (parent surface already labels it). */
  headless?: boolean;
  /**
   * Property scope for sample dismiss persistence.
   * Falls back to `"org"` when browsing the portfolio.
   */
  propertyId?: string | null;
};

/**
 * Recent records — same pressed Recent rows as Spaces / Assets / Tasks.
 */
export function PropertyRecentRecordsList({
  documents,
  complianceRecords,
  onOpenDocument,
  onOpenCompliance,
  className,
  limit = 8,
  headless = false,
  propertyId = null,
}: PropertyRecentRecordsListProps) {
  const dismissScope = propertyId?.trim() || "org";
  const [dismissedSamples, setDismissedSamples] = useState(() =>
    readDismissedOnboardingSampleIds(dismissScope)
  );
  const [lessonItem, setLessonItem] = useState<RecentItem | null>(null);

  useEffect(() => {
    setDismissedSamples(readDismissedOnboardingSampleIds(dismissScope));
  }, [dismissScope]);

  useEffect(() => {
    const sync = () => {
      setDismissedSamples(readDismissedOnboardingSampleIds(dismissScope));
    };
    window.addEventListener(ONBOARDING_SAMPLE_DISMISSED_EVENT, sync);
    return () => window.removeEventListener(ONBOARDING_SAMPLE_DISMISSED_EVENT, sync);
  }, [dismissScope]);

  const allItems: RecentItem[] = useMemo(
    () =>
      [
        ...documents.map((d) => {
          const group = d.category ? getRecordGroup(d.category) : undefined;
          const title = d.title?.trim() || d.file_name?.trim() || "Untitled document";
          const isSample = isSeededSampleContent({
            title,
            notes: d.notes,
            metadata: d.metadata,
          });
          return {
            id: d.id,
            kind: "document" as const,
            title,
            subtitle: d.category?.trim() || "Document",
            at: d.created_at || d.updated_at || "",
            accent: group?.color ?? "#ADB5BD",
            isSample,
            dismissId: seededSampleDismissId("document", d.id),
          };
        }),
        ...complianceRecords.map((r) => {
          const group = getRecordGroup("compliance");
          const isSample = isSeededSampleContent({
            title: r.title,
            notes: r.notes,
          });
          return {
            id: r.id,
            kind: "compliance" as const,
            title: r.title,
            subtitle: r.complianceType || "Compliance",
            at: r.nextDueDate || r.expiryDate || "",
            accent: group?.color ?? "#8EC9CE",
            isSample,
            dismissId: seededSampleDismissId("compliance", r.id),
          };
        }),
      ]
        .filter((item) => item.at)
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    [documents, complianceRecords]
  );

  const realItemCount = allItems.filter((item) => !item.isSample).length;
  /** First real record retires all remaining samples for this surface. */
  const autoHideSamples = shouldAutoHideSeededSamples({ realItemCount });

  const items = allItems
    .filter((item) => {
      if (!item.isSample) return true;
      if (autoHideSamples) return false;
      if (dismissedSamples.has(item.dismissId)) return false;
      return true;
    })
    .slice(0, limit);

  return (
    <div className={cn("w-full min-w-0", className)}>
      <RecentPanel
        title={headless ? "Recent" : "Recent records"}
        empty={
          <p className="px-0.5 py-3 text-caption text-muted-foreground">
            Recent documents and obligations will appear here.
          </p>
        }
      >
        {items.length > 0
          ? items.map((item) => {
              const Icon = item.kind === "compliance" ? Shield : FileText;
              const when = item.at
                ? formatDistanceToNow(new Date(item.at), { addSuffix: true })
                : "";
              return (
                <RecentPanelRow
                  key={`${item.kind}-${item.id}`}
                  onClick={() => {
                    if (item.isSample) {
                      setLessonItem(item);
                      return;
                    }
                    if (item.kind === "document") onOpenDocument?.(item.id);
                    else onOpenCompliance?.(item.id);
                  }}
                  icon={<Icon className="h-4 w-4" style={{ color: item.accent }} aria-hidden />}
                  title={
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <span className="truncate">{item.title}</span>
                      {item.isSample ? (
                        <span className="shrink-0">
                          <DemoContentLabel />
                        </span>
                      ) : null}
                    </span>
                  }
                  caption={`${item.subtitle}${when ? ` · ${when}` : ""}`}
                />
              );
            })
          : null}
      </RecentPanel>

      <SampleContentLessonDialog
        open={lessonItem != null}
        onOpenChange={(open) => {
          if (!open) setLessonItem(null);
        }}
        section="records"
        itemTitle={lessonItem?.title ?? "Sample record"}
        onConfirmHide={() => {
          if (!lessonItem) return;
          setDismissedSamples(
            dismissOnboardingSample(dismissScope, lessonItem.dismissId)
          );
          setLessonItem(null);
        }}
      />
    </div>
  );
}
