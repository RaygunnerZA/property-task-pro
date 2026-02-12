import { DocumentCard } from "./DocumentCard";
import type { PropertyDocument } from "@/hooks/property/usePropertyDocuments";
import { cn } from "@/lib/utils";

interface DocumentGridProps {
  documents: PropertyDocument[];
  onDocumentClick: (doc: PropertyDocument) => void;
  onOpen?: (doc: PropertyDocument) => void;
  onReplace?: (doc: PropertyDocument) => void;
  onLinkItems?: (doc: PropertyDocument) => void;
  className?: string;
}

export function DocumentGrid({
  documents,
  onDocumentClick,
  onOpen,
  onReplace,
  onLinkItems,
  className,
}: DocumentGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3",
        "max-w-[650px]",
        className
      )}
    >
      {documents.map((doc) => (
        <DocumentCard
          key={doc.id}
          document={doc}
          onClick={() => onDocumentClick(doc)}
          onOpen={onOpen ? () => onOpen(doc) : undefined}
          onReplace={onReplace ? () => onReplace(doc) : undefined}
          onLinkItems={onLinkItems ? () => onLinkItems(doc) : undefined}
        />
      ))}
    </div>
  );
}
