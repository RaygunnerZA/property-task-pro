import { PropertyRecordsTab } from "@/components/records/PropertyRecordsTab";
import type { MyWorkPanelProps } from "@/components/workbench/MyWorkPanel";
import type { RecordsView } from "@/lib/propertyRoutes";

export type RecordsWorkbenchPanelProps = MyWorkPanelProps & {
  recordsView?: RecordsView;
};

/**
 * Centre workbench Records tab — certificates, documents, compliance evidence.
 * Reuses PropertyRecordsTab (same surface as the former TaskPanel Records pane).
 */
export function RecordsWorkbenchPanel({
  properties = [],
  selectedPropertyIds,
  onOpenIntake,
  onRecordsViewChange,
  recordsView = "all",
}: RecordsWorkbenchPanelProps) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col rounded-2xl bg-transparent pt-0 pb-1">
        <PropertyRecordsTab
          properties={properties}
          selectedPropertyIds={selectedPropertyIds}
          recordsView={recordsView}
          onRecordsViewChange={onRecordsViewChange ?? (() => {})}
          onOpenIntake={onOpenIntake}
        />
      </section>
    </div>
  );
}
