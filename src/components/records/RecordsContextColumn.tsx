import { useMemo, useState } from "react";
import { WorkspaceSurfaceCard } from "@/components/property-workspace";
import { DocumentDetailDrawer } from "@/components/properties/DocumentDetailDrawer";
import { ComplianceDetailDrawer } from "@/components/compliance/ComplianceDetailDrawer";
import { useCompliancePortfolioQuery } from "@/hooks/useCompliancePortfolioQuery";
import { usePropertyDocuments } from "@/hooks/property/usePropertyDocuments";
import { RecordsContextSummary } from "./RecordsContextSummary";
import { PropertyRecentRecordsList } from "./PropertyRecentRecordsList";
import {
  buildComplianceRecordsFromPortfolio,
  type ComplianceRecord,
} from "./complianceRecordModel";
import { cn } from "@/lib/utils";

type RecordsContextColumnProps = {
  properties: { id: string }[];
  selectedPropertyIds?: Set<string>;
  className?: string;
};

/**
 * DualPane left rail for `/records` — Spaces-style context: counts, health dashboard, recent.
 */
export function RecordsContextColumn({
  properties,
  selectedPropertyIds,
  className,
}: RecordsContextColumnProps) {
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedComplianceId, setSelectedComplianceId] = useState<string | null>(null);

  const scopedPropertyId =
    selectedPropertyIds && selectedPropertyIds.size === 1
      ? Array.from(selectedPropertyIds)[0]
      : null;

  const { data: compliancePortfolio = [] } = useCompliancePortfolioQuery();
  const { documents } = usePropertyDocuments(scopedPropertyId || undefined, undefined, {
    limit: 500,
    enabled: !!scopedPropertyId,
  });

  const complianceRecords = useMemo(
    () => buildComplianceRecordsFromPortfolio(compliancePortfolio),
    [compliancePortfolio]
  );

  const scopedComplianceRecords = useMemo(() => {
    if (
      !selectedPropertyIds ||
      selectedPropertyIds.size === 0 ||
      selectedPropertyIds.size >= properties.length
    ) {
      return complianceRecords;
    }
    return complianceRecords.filter(
      (r) => r.propertyId && selectedPropertyIds.has(r.propertyId)
    );
  }, [complianceRecords, selectedPropertyIds, properties.length]);

  const selectedComplianceRecord = useMemo(
    (): ComplianceRecord | null =>
      selectedComplianceId
        ? complianceRecords.find((r) => r.id === selectedComplianceId) ?? null
        : null,
    [complianceRecords, selectedComplianceId]
  );

  return (
    <div className={cn("space-y-4 px-[3px] [overflow-anchor:none]", className)}>
      <WorkspaceSurfaceCard
        title="Overview"
        description="How evidence is organised on this property"
      >
        <ul className="space-y-2 text-xs text-muted-foreground">
          <li>
            <span className="font-semibold text-foreground">
              {scopedPropertyId ? documents.length : "—"}
            </span>{" "}
            stored documents
            {!scopedPropertyId ? (
              <span className="text-muted-foreground"> · select one property</span>
            ) : null}
          </li>
          <li>
            <span className="font-semibold text-foreground">
              {scopedComplianceRecords.length}
            </span>{" "}
            compliance obligations in scope
          </li>
          <li>
            Groups mirror Spaces — Fire, Electrical, Water, and the rest. Open a group card to focus
            the directory.
          </li>
        </ul>
      </WorkspaceSurfaceCard>

      <WorkspaceSurfaceCard title="Property Health" description="Portfolio health at a glance">
        <RecordsContextSummary
          dense
          complianceRecords={scopedComplianceRecords}
          documentTotal={scopedPropertyId ? documents.length : undefined}
        />
      </WorkspaceSurfaceCard>

      <div className="overflow-hidden rounded-xl bg-card/60 p-3 shadow-e1">
        <PropertyRecentRecordsList
          documents={documents}
          complianceRecords={scopedComplianceRecords}
          onOpenDocument={(id) => setSelectedDocId(id)}
          onOpenCompliance={(id) => setSelectedComplianceId(id)}
          propertyId={scopedPropertyId}
        />
      </div>

      <ComplianceDetailDrawer
        open={Boolean(selectedComplianceRecord)}
        onOpenChange={(open) => {
          if (!open) setSelectedComplianceId(null);
        }}
        compliance={
          selectedComplianceRecord
            ? {
                id: selectedComplianceRecord.id,
                title: selectedComplianceRecord.title,
                property_id: selectedComplianceRecord.propertyId,
                property_name: selectedComplianceRecord.propertyName,
                expiry_date: selectedComplianceRecord.expiryDate,
                next_due_date: selectedComplianceRecord.nextDueDate,
                expiry_state:
                  selectedComplianceRecord.status === "overdue"
                    ? "expired"
                    : selectedComplianceRecord.status === "expiring"
                      ? "expiring"
                      : "valid",
                document_type: selectedComplianceRecord.complianceType,
              }
            : null
        }
      />

      <DocumentDetailDrawer
        documentId={selectedDocId}
        propertyId={scopedPropertyId ?? ""}
        onClose={() => setSelectedDocId(null)}
      />
    </div>
  );
}
