import { DocumentCard } from "./DocumentCard";
import { LoadingState } from "@/components/design-system/LoadingState";
import { EmptyState } from "@/components/design-system/EmptyState";
import { FileText } from "lucide-react";

interface DocumentsSectionProps {
  documents?: any[];
  loading?: boolean;
}

/**
 * Documents Section
 * Renders list of DocumentCard components
 * Same visual language as task cards
 */
export function DocumentsSection({
  documents = [],
  loading = false,
}: DocumentsSectionProps) {
  if (loading) {
    return <LoadingState message="Loading documents..." />;
  }

  if (documents.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No documents"
        description="Documents will appear here"
      />
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      {documents.map((doc) => (
        <div key={doc.id} className="w-[30%] min-w-[200px]">
          <DocumentCard document={doc} />
        </div>
      ))}
    </div>
  );
}

