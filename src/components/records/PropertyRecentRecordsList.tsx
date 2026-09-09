import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { FileText, Shield } from "lucide-react";
import type { PropertyDocument } from "@/hooks/property/usePropertyDocuments";
import type { ComplianceRecord } from "@/components/records/complianceRecordModel";
import { SampleContentLessonDialog } from "@/components/onboarding/SampleContentLessonDialog";
import { DemoContentLabel } from "@/components/dashboard/issues/IssuesSignalListParts";
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
 * Recent records list — same row language as PropertySpacesList (thumb + name + caption).
 * Seeded samples open an instructive lesson and phase out on confirm (or when real
 * records exist).
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
    <div className={cn("space-y-2", className)}>
      {!headless ? (
        <div className="flex items-center justify-between gap-2 px-0.5">
          <h3 className="text-sm font-semibold text-foreground">Recent records</h3>
        </div>
      ) : null}
      {items.length === 0 ? (
        <p className="rounded-card bg-card/70 px-3 py-4 text-xs text-muted-foreground shadow-e1">
          Recent documents and obligations will appear here.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => {
            const Icon = item.kind === "compliance" ? Shield : FileText;
            return (
              <li key={`${item.kind}-${item.id}`}>
                <button
                  type="button"
                  onClick={() => {
                    if (item.isSample) {
                      setLessonItem(item);
                      return;
                    }
                    if (item.kind === "document") onOpenDocument?.(item.id);
                    else onOpenCompliance?.(item.id);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-card bg-card/70 px-2.5 py-2 text-left shadow-e1",
                    "transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  )}
                >
                  <span
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: item.accent }}
                    aria-hidden
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {item.title}
                      </span>
                      {item.isSample ? (
                        <span className="shrink-0">
                          <DemoContentLabel />
                        </span>
                      ) : null}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.subtitle}
                      {item.at
                        ? ` · ${formatDistanceToNow(new Date(item.at), { addSuffix: true })}`
                        : ""}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

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
