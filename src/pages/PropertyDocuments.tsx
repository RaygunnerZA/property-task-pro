import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { FileText } from "lucide-react";
import { StandardPageWithBack } from "@/components/design-system/StandardPageWithBack";
import { LoadingState } from "@/components/design-system/LoadingState";
import { DocumentsSummaryRow } from "@/components/properties/DocumentsSummaryRow";
import { DocumentCategoryChips } from "@/components/properties/DocumentCategoryChips";
import { DocumentSearchFilters } from "@/components/properties/DocumentSearchFilters";
import { DocumentGrid } from "@/components/properties/DocumentGrid";
import { DocumentDetailDrawer } from "@/components/properties/DocumentDetailDrawer";
import { DocumentUploadZone } from "@/components/properties/DocumentUploadZone";
import { TintedSectionCard, FrameworkEmptyState } from "@/components/property-framework";
import { DOCUMENT_CATEGORIES } from "@/hooks/property/usePropertyDocuments";
import type { TintedSectionColor } from "@/components/property-framework";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePropertyDocuments } from "@/hooks/property/usePropertyDocuments";
import { useSpaces } from "@/hooks/useSpaces";
import { useAssetsQuery } from "@/hooks/useAssetsQuery";
import { useComplianceQuery } from "@/hooks/useComplianceQuery";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function PropertyDocuments() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const propertyId = id || "";
  const queryClient = useQueryClient();
  const { orgId } = useActiveOrg();
  const { toast } = useToast();

  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expiringSoon, setExpiringSoon] = useState(false);
  const [expired, setExpired] = useState(false);
  const [missing, setMissing] = useState(false);
  const [recentlyAdded, setRecentlyAdded] = useState(false);
  const [hazards, setHazards] = useState(false);
  const [unlinked, setUnlinked] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showReanalyseModal, setShowReanalyseModal] = useState(false);
  const [reanalyseLoading, setReanalyseLoading] = useState(false);
  const [reanalyseResult, setReanalyseResult] = useState<{
    total: number;
    completed: number;
    skipped: number;
    errors: number;
  } | null>(null);

  // URL filter: ?filter=expired | expiring | hazards | unlinked
  useEffect(() => {
    const filter = searchParams.get("filter");
    if (filter === "expired") setExpired(true);
    if (filter === "expiring") setExpiringSoon(true);
    if (filter === "hazards") setHazards(true);
    if (filter === "unlinked") setUnlinked(true);
  }, [searchParams]);

  const { documents, isLoading } = usePropertyDocuments(
    propertyId,
    {
      category: category || undefined,
      search: search || undefined,
      expiringSoon,
      expired,
      missing,
      recentlyAdded,
      hazards,
      unlinked,
    }
  );

  const { spaces } = useSpaces(propertyId);
  const { data: assets = [] } = useAssetsQuery(propertyId);
  const { data: complianceItems = [] } = useComplianceQuery();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["property-documents"] });
    queryClient.invalidateQueries({ queryKey: ["document-detail"] });
  };

  const handleUploadComplete = () => {
    setShowUpload(false);
    handleRefresh();
  };

  const handleReanalyse = async () => {
    if (!orgId || !propertyId) return;
    setShowReanalyseModal(true);
    setReanalyseLoading(true);
    setReanalyseResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-doc-reanalyse", {
        body: { org_id: orgId, property_id: propertyId, overwrite: false },
      });
      if (error) throw error;
      setReanalyseResult({
        total: data?.total ?? 0,
        completed: data?.completed ?? 0,
        skipped: data?.skipped ?? 0,
        errors: data?.errors ?? 0,
      });
      handleRefresh();
      toast({ title: "Re-analysis complete", description: `${data?.completed ?? 0} processed` });
    } catch (e: unknown) {
      toast({ title: "Re-analysis failed", description: String(e), variant: "destructive" });
    } finally {
      setReanalyseLoading(false);
    }
  };

  const handleLinkSpace = async (docId: string, spaceId: string) => {
    if (!orgId) return;
    try {
      const { error } = await supabase.from("attachment_spaces").insert({
        attachment_id: docId,
        space_id: spaceId,
        org_id: orgId,
      });
      if (error) throw error;
      toast({ title: "Linked to space" });
      handleRefresh();
    } catch (e: unknown) {
      toast({ title: "Link failed", description: String(e), variant: "destructive" });
    }
  };

  const handleLinkAsset = async (docId: string, assetId: string) => {
    if (!orgId) return;
    try {
      const { error } = await supabase.from("attachment_assets").insert({
        attachment_id: docId,
        asset_id: assetId,
        org_id: orgId,
      });
      if (error) throw error;
      toast({ title: "Linked to asset" });
      handleRefresh();
    } catch (e: unknown) {
      toast({ title: "Link failed", description: String(e), variant: "destructive" });
    }
  };

  const handleLinkCompliance = async (docId: string, complianceId: string) => {
    if (!orgId) return;
    try {
      const { error } = await supabase.from("attachment_compliance").insert({
        attachment_id: docId,
        compliance_document_id: complianceId,
        org_id: orgId,
      });
      if (error) throw error;
      toast({ title: "Linked to compliance" });
      handleRefresh();
    } catch (e: unknown) {
      toast({ title: "Link failed", description: String(e), variant: "destructive" });
    }
  };

  const spaceOptions = spaces.map((s) => ({ id: s.id, name: s.name }));
  const assetOptions = assets.map((a: { id: string; name?: string }) => ({
    id: a.id,
    name: a.name || "Unnamed",
  }));
  const complianceOptions = complianceItems.map((c: { id: string; title?: string }) => ({
    id: c.id,
    title: c.title || "Untitled",
  }));

  // Category → colour mapping (Framework V2)
  const categoryColor: Record<string, TintedSectionColor> = {
    "Fire Safety": "red",
    Electrical: "amber",
    Mechanical: "amber",
    Water: "teal",
    Insurance: "teal",
    Legal: "slate",
    Contractors: "mint",
    Plans: "slate",
    Warranties: "mint",
    "O&M Manuals": "slate",
    Misc: "slate",
  };

  const documentsByCategory = useMemo(() => {
    const map = new Map<string, typeof documents>();
    for (const doc of documents) {
      const cat = doc.category || "Misc";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(doc);
    }
    return map;
  }, [documents]);

  return (
    <StandardPageWithBack
      title="Property Documents"
      subtitle="View and manage property documentation"
      backTo={`/properties/${propertyId}`}
      icon={<FileText className="h-6 w-6" />}
      maxWidth="lg"
    >
      <div className="flex flex-col gap-6 max-w-[650px]">
        {/* Summary Row - Framework V2 */}
        <DocumentsSummaryRow propertyId={propertyId} />

        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Category</h3>
            <DocumentCategoryChips selected={category} onSelect={setCategory} />
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
              hazards={hazards}
              unlinked={unlinked}
              onExpiringSoonToggle={() => setExpiringSoon((s) => !s)}
              onExpiredToggle={() => setExpired((s) => !s)}
              onMissingToggle={() => setMissing((s) => !s)}
              onRecentlyAddedToggle={() => setRecentlyAdded((s) => !s)}
              onHazardsToggle={() => setHazards((s) => !s)}
              onUnlinkedToggle={() => setUnlinked((s) => !s)}
            />
          </div>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <LoadingState message="Loading documents..." />
          ) : documents.length === 0 ? (
            <FrameworkEmptyState
              icon={FileText}
              title="No documents"
              description="Upload your first document or adjust filters"
              action={{
                label: "Upload document",
                onClick: () => setShowUpload(true),
              }}
            />
          ) : category ? (
            <TintedSectionCard
              title={category}
              color={categoryColor[category] ?? "slate"}
              count={documentsByCategory.get(category)?.length ?? 0}
              collapsible
              defaultExpanded
            >
              <DocumentGrid
                documents={documentsByCategory.get(category) ?? documents}
                propertyId={propertyId}
                spaces={spaceOptions}
                assets={assetOptions}
                compliance={complianceOptions}
                onDocumentClick={(doc) => setSelectedDocId(doc.id)}
                onOpen={(doc) => window.open(doc.file_url, "_blank")}
                onReplace={() => {}}
                onLinkItems={(doc) => setSelectedDocId(doc.id)}
                onLinkSpace={handleLinkSpace}
                onLinkAsset={handleLinkAsset}
                onLinkCompliance={handleLinkCompliance}
              />
            </TintedSectionCard>
          ) : (
            <div className="space-y-4">
              {Array.from(documentsByCategory.entries())
                .sort(([a], [b]) => {
                  const ai = DOCUMENT_CATEGORIES.indexOf(a as any);
                  const bi = DOCUMENT_CATEGORIES.indexOf(b as any);
                  if (ai >= 0 && bi >= 0) return ai - bi;
                  if (ai >= 0) return -1;
                  if (bi >= 0) return 1;
                  return a.localeCompare(b);
                })
                .map(([cat, docs]) => (
                  <TintedSectionCard
                    key={cat}
                    title={cat}
                    color={categoryColor[cat] ?? "slate"}
                    count={docs.length}
                    collapsible
                    defaultExpanded
                  >
                    <DocumentGrid
                      documents={docs}
                      propertyId={propertyId}
                      spaces={spaceOptions}
                      assets={assetOptions}
                      compliance={complianceOptions}
                      onDocumentClick={(doc) => setSelectedDocId(doc.id)}
                      onOpen={(doc) => window.open(doc.file_url, "_blank")}
                      onReplace={() => {}}
                      onLinkItems={(doc) => setSelectedDocId(doc.id)}
                      onLinkSpace={handleLinkSpace}
                      onLinkAsset={handleLinkAsset}
                      onLinkCompliance={handleLinkCompliance}
                    />
                  </TintedSectionCard>
                ))}
            </div>
          )}
        </div>
      </div>

      <DocumentDetailDrawer
        documentId={selectedDocId}
        propertyId={propertyId}
        onClose={() => setSelectedDocId(null)}
        onRefresh={handleRefresh}
      />

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

      <Dialog open={showReanalyseModal} onOpenChange={setShowReanalyseModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Re-run AI Analysis</DialogTitle>
          </DialogHeader>
          {reanalyseLoading ? (
            <p className="text-sm text-muted-foreground">Processing documents…</p>
          ) : reanalyseResult ? (
            <div className="space-y-2 text-sm">
              <p>Total: {reanalyseResult.total}</p>
              <p className="text-success">Completed: {reanalyseResult.completed}</p>
              <p className="text-muted-foreground">Skipped (recent): {reanalyseResult.skipped}</p>
              {reanalyseResult.errors > 0 && (
                <p className="text-destructive">Errors: {reanalyseResult.errors}</p>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </StandardPageWithBack>
  );
}
