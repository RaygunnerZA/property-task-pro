import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { propertyHubPath, propertySubPath } from "@/lib/propertyRoutes";
import { FileText, Sparkles } from "lucide-react";
import { StandardPageWithBack } from "@/components/design-system/StandardPageWithBack";
import { LoadingState } from "@/components/design-system/LoadingState";
import { DocumentsSummaryRow } from "@/components/properties/DocumentsSummaryRow";
import { DocumentCategoryChips } from "@/components/properties/DocumentCategoryChips";
import { DocumentSearchFilters } from "@/components/properties/DocumentSearchFilters";
import { DocumentGrid } from "@/components/properties/DocumentGrid";
import { DocumentDetailDrawer } from "@/components/properties/DocumentDetailDrawer";
import { DocumentUploadZone } from "@/components/properties/DocumentUploadZone";
import { DocumentHealthSummary } from "@/components/properties/DocumentHealthSummary";
import { TintedSectionCard, FrameworkEmptyState } from "@/components/property-framework";
import {
  DOCUMENT_CATEGORIES,
  type DocMetadata,
  type PropertyDocument,
} from "@/hooks/property/usePropertyDocuments";
import type { TintedSectionColor } from "@/components/property-framework";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  PropertyWorkspaceLayout,
  WorkspaceSurfaceCard,
  WorkspaceSectionHeading,
  WorkspaceTabList,
  WorkspaceTabTrigger,
} from "@/components/property-workspace";
import { usePropertyDocuments } from "@/hooks/property/usePropertyDocuments";
import { useSpaces } from "@/hooks/useSpaces";
import { useAssetsQuery } from "@/hooks/useAssetsQuery";
import { useComplianceQuery } from "@/hooks/useComplianceQuery";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { PropertyPageScopeBar } from "@/components/properties/PropertyPageScopeBar";

type WorkTab = "all" | "expiring" | "missing_links" | "compliance" | "asset_docs";

const COMPLIANCE_DOC_CATEGORIES = ["Fire Safety", "Electrical", "Water", "Mechanical"] as const;

export default function PropertyDocuments() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const propertyId = id || "";
  const { data: properties = [] } = usePropertiesQuery();
  const headerAccent =
    (
      properties.find((p: { id: string }) => p.id === propertyId) as
        | { icon_color_hex?: string | null }
        | undefined
    )?.icon_color_hex?.trim() || "#8EC9CE";
  const queryClient = useQueryClient();
  const { orgId } = useActiveOrg();
  const { toast } = useToast();

  const [workTab, setWorkTab] = useState<WorkTab>("all");
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expiringSoon, setExpiringSoon] = useState(false);
  const [expired, setExpired] = useState(false);
  const [missing, setMissing] = useState(false);
  const [recentlyAdded, setRecentlyAdded] = useState(false);
  const [hazards, setHazards] = useState(false);
  const [unlinked, setUnlinked] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [showUploadMobile, setShowUploadMobile] = useState(false);
  const [showReanalyseModal, setShowReanalyseModal] = useState(false);
  const [reanalyseLoading, setReanalyseLoading] = useState(false);
  const [reanalyseResult, setReanalyseResult] = useState<{
    total: number;
    completed: number;
    skipped: number;
    errors: number;
  } | null>(null);

  const applyWorkTab = useCallback((tab: WorkTab) => {
    setWorkTab(tab);
    if (tab === "expiring") {
      setExpiringSoon(true);
      setExpired(false);
      setUnlinked(false);
    } else if (tab === "missing_links") {
      setUnlinked(true);
      setExpiringSoon(false);
      setExpired(false);
    } else if (tab === "all") {
      setExpiringSoon(false);
      setUnlinked(false);
    } else {
      setExpiringSoon(false);
      setUnlinked(false);
      setExpired(false);
    }
  }, []);

  // URL filter: ?filter=expired | expiring | hazards | unlinked; ?upload=1 opens upload dialog
  useEffect(() => {
    const filter = searchParams.get("filter");
    if (filter === "expired") {
      setExpired(true);
      applyWorkTab("all");
    }
    if (filter === "expiring") applyWorkTab("expiring");
    if (filter === "hazards") setHazards(true);
    if (filter === "unlinked") applyWorkTab("missing_links");
  }, [searchParams, applyWorkTab]);

  useEffect(() => {
    if (searchParams.get("upload") !== "1") return;
    setShowUploadMobile(true);
    const next = new URLSearchParams(searchParams);
    next.delete("upload");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const tabUsesBroadFetch = workTab === "compliance" || workTab === "asset_docs";

  const mergedFilters = useMemo(
    () => ({
      category: category || undefined,
      search: search || undefined,
      expiringSoon: workTab === "expiring" ? true : !tabUsesBroadFetch && expiringSoon,
      expired: tabUsesBroadFetch ? false : expired,
      missing: tabUsesBroadFetch ? false : missing,
      recentlyAdded: tabUsesBroadFetch ? false : recentlyAdded,
      hazards: tabUsesBroadFetch ? false : hazards,
      unlinked: workTab === "missing_links" ? true : !tabUsesBroadFetch && unlinked,
    }),
    [
      category,
      search,
      workTab,
      tabUsesBroadFetch,
      expiringSoon,
      expired,
      missing,
      recentlyAdded,
      hazards,
      unlinked,
    ]
  );

  const { documents, isLoading } = usePropertyDocuments(propertyId, mergedFilters, { limit: 500 });

  const { documents: contextDocuments = [], isLoading: contextLoading } = usePropertyDocuments(
    propertyId,
    {},
    { limit: 500 }
  );

  const { spaces } = useSpaces(propertyId);
  const { data: assets = [] } = useAssetsQuery(propertyId);
  const { data: complianceItems = [] } = useComplianceQuery(propertyId);

  const documentsForWork = useMemo(() => {
    if (workTab === "compliance") {
      return documents.filter((d) =>
        COMPLIANCE_DOC_CATEGORIES.some((c) => c === d.category)
      );
    }
    if (workTab === "asset_docs") {
      return documents.filter((d) => {
        const meta = d.metadata as DocMetadata | null | undefined;
        const detected = meta?.detected_assets;
        return (
          (Array.isArray(detected) && detected.length > 0) ||
          d.category === "Warranties" ||
          d.category === "O&M Manuals"
        );
      });
    }
    return documents;
  }, [documents, workTab]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["property-documents"] });
    queryClient.invalidateQueries({ queryKey: ["document-detail"] });
  };

  const handleUploadComplete = () => {
    setShowUploadMobile(false);
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
    const map = new Map<string, PropertyDocument[]>();
    for (const doc of documentsForWork) {
      const cat = doc.category || "Misc";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(doc);
    }
    return map;
  }, [documentsForWork]);

  const contextColumn = (
    <div className="space-y-4">
      {contextLoading ? (
        <div className="rounded-[12px] bg-card/60 shadow-e1 px-4 py-4">
          <p className="text-xs text-muted-foreground">Loading summary…</p>
        </div>
      ) : (
        <DocumentHealthSummary propertyId={propertyId} documents={contextDocuments} />
      )}
      <WorkspaceSurfaceCard title="Quick focus" description="Jump to common slices">
        <DocumentsSummaryRow propertyId={propertyId} />
      </WorkspaceSurfaceCard>
    </div>
  );

  const workColumn = (
    <div className="flex flex-col gap-5">
      <div>
        <WorkspaceSectionHeading>View</WorkspaceSectionHeading>
        <WorkspaceTabList className="mb-3">
          {(
            [
              ["all", "All"],
              ["expiring", "Expiring"],
              ["missing_links", "Missing links"],
              ["compliance", "Compliance"],
              ["asset_docs", "Asset docs"],
            ] as const
          ).map(([id, label]) => (
            <WorkspaceTabTrigger key={id} selected={workTab === id} onClick={() => applyWorkTab(id)}>
              {label}
            </WorkspaceTabTrigger>
          ))}
        </WorkspaceTabList>
      </div>

      <div>
        <WorkspaceSectionHeading>Category</WorkspaceSectionHeading>
        <DocumentCategoryChips selected={category} onSelect={setCategory} />
      </div>
      <div>
        <WorkspaceSectionHeading>Search & filters</WorkspaceSectionHeading>
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

      <div className="space-y-4">
        {isLoading ? (
          <LoadingState message="Loading documents..." />
        ) : documentsForWork.length === 0 ? (
          <FrameworkEmptyState
            icon={FileText}
            title="No documents"
            description="Upload from the action column or adjust filters"
            action={{
              label: "Upload document",
              onClick: () => setShowUploadMobile(true),
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
              documents={documentsByCategory.get(category) ?? documentsForWork}
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
                const ai = DOCUMENT_CATEGORIES.indexOf(a as (typeof DOCUMENT_CATEGORIES)[number]);
                const bi = DOCUMENT_CATEGORIES.indexOf(b as (typeof DOCUMENT_CATEGORIES)[number]);
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
  );

  const actionColumn = (
    <div className="space-y-4">
      <WorkspaceSurfaceCard title="Upload" description="Add files to this property">
        <DocumentUploadZone propertyId={propertyId} onUploadComplete={handleUploadComplete} />
      </WorkspaceSurfaceCard>
      <WorkspaceSurfaceCard
        title="Classification"
        description="Re-run extraction to refresh types, expiry hints, and link suggestions."
      >
        <Button
          type="button"
          variant="outline"
          className="w-full btn-neomorphic justify-center gap-2"
          onClick={handleReanalyse}
        >
          <Sparkles className="h-4 w-4 text-primary" />
          Re-run AI extraction
        </Button>
      </WorkspaceSurfaceCard>
    </div>
  );

  return (
    <StandardPageWithBack
      title="Property Documents"
      subtitle="What you have, what expires, and where it belongs"
      backTo={propertyId ? propertyHubPath(propertyId) : "/"}
      icon={<FileText className="h-6 w-6" />}
      maxWidth="full"
      contentClassName="max-w-[1480px]"
      headerAccentColor={headerAccent}
      hideHeaderBack
      belowGradientRow={
        <PropertyPageScopeBar
          propertyId={propertyId}
          hrefForProperty={(pid) => propertySubPath(pid, "documents")}
          onBack={() => navigate(propertyId ? propertyHubPath(propertyId) : "/")}
        />
      }
    >
      <div className="workspace:block hidden">
        <PropertyWorkspaceLayout contextColumn={contextColumn} workColumn={workColumn} actionColumn={actionColumn} />
      </div>

      <div className="workspace:hidden flex flex-col gap-6 max-w-[660px]">
        {actionColumn}
        {workColumn}
        {contextColumn}
      </div>

      <DocumentDetailDrawer
        documentId={selectedDocId}
        propertyId={propertyId}
        onClose={() => setSelectedDocId(null)}
        onRefresh={handleRefresh}
      />

      <Dialog open={showUploadMobile} onOpenChange={setShowUploadMobile}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload documents</DialogTitle>
          </DialogHeader>
          <DocumentUploadZone propertyId={propertyId} onUploadComplete={handleUploadComplete} />
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
