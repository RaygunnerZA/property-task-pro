import { useMemo } from "react";
import { DocumentCard } from "./DocumentCard";
import type { PropertyDocument, DocMetadata } from "@/hooks/property/usePropertyDocuments";
import { cn } from "@/lib/utils";

function fuzzyMatch(a: string, b: string): boolean {
  const na = a.toLowerCase().replace(/\s+/g, "");
  const nb = b.toLowerCase().replace(/\s+/g, "");
  return na.includes(nb) || nb.includes(na);
}

interface DocumentGridProps {
  documents: PropertyDocument[];
  propertyId?: string;
  spaces?: { id: string; name: string }[];
  assets?: { id: string; name: string }[];
  compliance?: { id: string; title: string }[];
  onDocumentClick: (doc: PropertyDocument) => void;
  onOpen?: (doc: PropertyDocument) => void;
  onReplace?: (doc: PropertyDocument) => void;
  onLinkItems?: (doc: PropertyDocument) => void;
  onLinkSpace?: (docId: string, spaceId: string) => void;
  onLinkAsset?: (docId: string, assetId: string) => void;
  onLinkCompliance?: (docId: string, complianceId: string) => void;
  className?: string;
}

export function DocumentGrid({
  documents,
  propertyId,
  spaces = [],
  assets = [],
  compliance = [],
  onDocumentClick,
  onOpen,
  onReplace,
  onLinkItems,
  onLinkSpace,
  onLinkAsset,
  onLinkCompliance,
  className,
}: DocumentGridProps) {
  const suggestionsByDoc = useMemo(() => {
    const map = new Map<string, { spaces: typeof spaces; assets: typeof assets; compliance: typeof compliance }>();
    for (const doc of documents) {
      const meta = (doc.metadata || {}) as DocMetadata;
      const detectedSpaces = meta.detected_spaces || [];
      const detectedAssets = meta.detected_assets || [];

      const matchedSpaces = spaces.filter((s) =>
        detectedSpaces.some((d) => fuzzyMatch(d, s.name))
      );
      const matchedAssets = assets.filter((a) => {
        const aName = (a as { name?: string; serial_number?: string; model?: string }).name || "";
        const aSerial = (a as { serial_number?: string }).serial_number || "";
        const aModel = (a as { model?: string }).model || "";
        return detectedAssets.some(
          (d) =>
            (d.serial_number && (fuzzyMatch(d.serial_number, aSerial) || fuzzyMatch(d.serial_number, aName))) ||
            (d.model && (fuzzyMatch(d.model, aModel) || fuzzyMatch(d.model, aName))) ||
            (d.name && fuzzyMatch(d.name, aName))
        );
      });
      const complianceRecs = meta.compliance_recommendations || [];
      const matchedCompliance = compliance.filter((c) => {
        const docType = (doc.document_type || "").toLowerCase();
        const title = (c.title || "").toLowerCase();
        const typeMatch = docType && (title.includes(docType) || docType.includes(title));
        const recMatch = complianceRecs.some((r) => fuzzyMatch(r, c.title || ""));
        return typeMatch || recMatch;
      });

      map.set(doc.id, {
        spaces: matchedSpaces,
        assets: matchedAssets,
        compliance: matchedCompliance,
      });
    }
    return map;
  }, [documents, spaces, assets, compliance]);

  return (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3",
        "max-w-[660px]",
        className
      )}
    >
      {documents.map((doc) => {
        const suggestions = suggestionsByDoc.get(doc.id);
        return (
          <DocumentCard
            key={doc.id}
            document={doc}
            propertyId={propertyId}
            suggestedSpaces={suggestions?.spaces}
            suggestedAssets={suggestions?.assets}
            suggestedCompliance={suggestions?.compliance}
            onClick={() => onDocumentClick(doc)}
            onOpen={onOpen ? () => onOpen(doc) : undefined}
            onReplace={onReplace ? () => onReplace(doc) : undefined}
            onLinkItems={onLinkItems ? () => onLinkItems(doc) : undefined}
            onLinkSpace={onLinkSpace ? (id) => onLinkSpace(doc.id, id) : undefined}
            onLinkAsset={onLinkAsset ? (id) => onLinkAsset(doc.id, id) : undefined}
            onLinkCompliance={onLinkCompliance ? (id) => onLinkCompliance(doc.id, id) : undefined}
          />
        );
      })}
    </div>
  );
}
