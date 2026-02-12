import { useState } from "react";
import { useParams } from "react-router-dom";
import { FileText } from "lucide-react";
import { StandardPageWithBack } from "@/components/design-system/StandardPageWithBack";
import { LoadingState } from "@/components/design-system/LoadingState";
import { EmptyState } from "@/components/design-system/EmptyState";
import { PropertyDocumentsHeader } from "@/components/properties/PropertyDocumentsHeader";
import { DocumentCategoryChips } from "@/components/properties/DocumentCategoryChips";
import { DocumentSearchFilters } from "@/components/properties/DocumentSearchFilters";
import { DocumentGrid } from "@/components/properties/DocumentGrid";
import { DocumentDetailDrawer } from "@/components/properties/DocumentDetailDrawer";
import { DocumentUploadZone } from "@/components/properties/DocumentUploadZone";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePropertyDocuments } from "@/hooks/property/usePropertyDocuments";
import { useQueryClient } from "@tanstack/react-query";

export default function PropertyDocuments() {
  const { id } = useParams<{ id: string }>();
  const propertyId = id || "";
  const queryClient = useQueryClient();

  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expiringSoon, setExpiringSoon] = useState(false);
  const [expired, setExpired] = useState(false);
  const [missing, setMissing] = useState(false);
  const [recentlyAdded, setRecentlyAdded] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const { documents, isLoading } = usePropertyDocuments(propertyId, {
    category: category || undefined,
    search: search || undefined,
    expiringSoon,
    expired,
    missing,
    recentlyAdded,
  });

  const lastUpdated = documents[0]?.updated_at ?? null;
  const missingCount = 0; // Placeholder: "3 important documents missing"

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["property-documents"] });
  };

  const handleUploadComplete = () => {
    setShowUpload(false);
    handleRefresh();
  };

  return (
    <StandardPageWithBack
      title="Property Documents"
      subtitle="View and manage property documentation"
      backTo={`/properties/${propertyId}`}
      icon={<FileText className="h-6 w-6" />}
      maxWidth="lg"
    >
      <div className="flex flex-col gap-6 max-w-[650px]">
        {/* (A) Header Section */}
        <PropertyDocumentsHeader
          propertyId={propertyId}
          onUpload={() => setShowUpload(true)}
          missingCount={missingCount}
          lastUpdated={lastUpdated}
        />

        {/* (B) Filter Section */}
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Category</h3>
            <DocumentCategoryChips
              selected={category}
              onSelect={setCategory}
            />
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Search & filters</h3>
            <DocumentSearchFilters
              search={search}
              onSearchChange={setSearch}
              expiringSoon={expiringSoon}
              expired={expired}
              missing={missing}
              recentlyAdded={recentlyAdded}
              onExpiringSoonToggle={() => setExpiringSoon((s) => !s)}
              onExpiredToggle={() => setExpired((s) => !s)}
              onMissingToggle={() => setMissing((s) => !s)}
              onRecentlyAddedToggle={() => setRecentlyAdded((s) => !s)}
            />
          </div>
        </div>

        {/* (C) Document Grid */}
        <div>
          {isLoading ? (
            <LoadingState message="Loading documents..." />
          ) : documents.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No documents"
              description="Upload your first document or adjust filters"
              action={{
                label: "Upload document",
                onClick: () => setShowUpload(true),
              }}
            />
          ) : (
            <DocumentGrid
              documents={documents}
              onDocumentClick={(doc) => setSelectedDocId(doc.id)}
              onOpen={(doc) => window.open(doc.file_url, "_blank")}
              onReplace={() => {}}
              onLinkItems={(doc) => setSelectedDocId(doc.id)}
            />
          )}
        </div>
      </div>

      {/* Document Detail Drawer */}
      <DocumentDetailDrawer
        documentId={selectedDocId}
        propertyId={propertyId}
        onClose={() => setSelectedDocId(null)}
        onRefresh={handleRefresh}
      />

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload documents</DialogTitle>
          </DialogHeader>
          <DocumentUploadZone
            propertyId={propertyId}
            onUploadComplete={handleUploadComplete}
          />
        </DialogContent>
      </Dialog>
    </StandardPageWithBack>
  );
}
