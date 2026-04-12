import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  Calendar,
  ClipboardCheck,
  FileText,
  Search,
  ShieldCheck,
  Waves,
} from "lucide-react";
import { useCompliancePortfolioQuery } from "@/hooks/useCompliancePortfolioQuery";
import { usePropertyDocuments, type PropertyDocument } from "@/hooks/property/usePropertyDocuments";
import { useSpaces } from "@/hooks/useSpaces";
import { useAssetsQuery } from "@/hooks/useAssetsQuery";
import { useComplianceQuery } from "@/hooks/useComplianceQuery";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FilterBar, type FilterGroup, type FilterOption } from "@/components/ui/filters/FilterBar";
import { FilterChip } from "@/components/chips/filter";
import { OperationalStreamCard } from "@/components/dashboard/OperationalStreamCard";
import { WorkspaceTabList, WorkspaceTabTrigger, WorkspaceSectionHeading } from "@/components/property-workspace";
import { DocumentCategoryChips } from "@/components/properties/DocumentCategoryChips";
import { DocumentSearchFilters } from "@/components/properties/DocumentSearchFilters";
import { DocumentGrid } from "@/components/properties/DocumentGrid";
import { DocumentDetailDrawer } from "@/components/properties/DocumentDetailDrawer";
import { DocumentUploadZone } from "@/components/properties/DocumentUploadZone";
import { ComplianceRulesSection } from "@/components/compliance/ComplianceRulesSection";
import { ComplianceRuleModal } from "@/components/compliance/ComplianceRuleModal";
import { ComplianceCard } from "@/components/compliance/ComplianceCard";
import { ComplianceAutomationPanel } from "@/components/compliance/ComplianceAutomationPanel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { RecordsView } from "@/lib/propertyRoutes";
import type { IntakeMode } from "@/types/intake";
import {
  buildComplianceRecordsFromPortfolio,
  formatDueText,
  getComplianceStatusText,
  type ComplianceRecord,
} from "./complianceRecordModel";
import { RecordsContextSummary } from "./RecordsContextSummary";

const COMPLIANCE_DOC_CATEGORIES = ["Fire Safety", "Electrical", "Water", "Mechanical"] as const;

type ExpiryRange = "all" | "30" | "90" | "365";
type ComplianceFilter = "all" | "expiring" | "overdue" | "missing";

const RECORDS_VIEWS: { id: RecordsView; label: string }[] = [
  { id: "all", label: "All" },
  { id: "expiring", label: "Expiring" },
  { id: "overdue", label: "Overdue" },
  { id: "missing", label: "Missing" },
  { id: "compliance", label: "Compliance" },
  { id: "documents", label: "Documents" },
  { id: "asset-docs", label: "Asset docs" },
];

export type PropertyRecordsTabProps = {
  properties: any[];
  selectedPropertyIds?: Set<string>;
  recordsView: RecordsView;
  onRecordsViewChange: (next: RecordsView) => void;
  onOpenIntake?: (mode: IntakeMode) => void;
  extraComplianceRecords?: ComplianceRecord[];
};

function docIsUnlinked(d: PropertyDocument): boolean {
  const ls = d.linked_spaces?.length ?? 0;
  const la = d.linked_assets?.length ?? 0;
  const lc = d.linked_compliance?.length ?? 0;
  return ls + la + lc === 0;
}

function docExpiryState(d: PropertyDocument): "overdue" | "expiring" | "none" {
  if (!d.expiry_date) return "none";
  const t = new Date(d.expiry_date).getTime();
  if (Number.isNaN(t)) return "none";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(d.expiry_date);
  exp.setHours(0, 0, 0, 0);
  if (exp < today) return "overdue";
  const diff = (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diff <= 30) return "expiring";
  return "none";
}

export function PropertyRecordsTab({
  properties,
  selectedPropertyIds,
  recordsView,
  onRecordsViewChange,
  onOpenIntake,
  extraComplianceRecords = [],
}: PropertyRecordsTabProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { orgId } = useActiveOrg();
  const { toast } = useToast();
  const legacyDocFilter = searchParams.get("filter");

  const [complianceSearch, setComplianceSearch] = useState("");
  const [complianceSearchOpen, setComplianceSearchOpen] = useState(false);
  const [compliancePropertyFilter, setCompliancePropertyFilter] = useState<string>("all");
  const [complianceTypeFilter, setComplianceTypeFilter] = useState<string>("all");
  const [complianceExpiryRange, setComplianceExpiryRange] = useState<ExpiryRange>("all");
  const [selectedComplianceId, setSelectedComplianceId] = useState<string | null>(null);

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
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<unknown | null>(null);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const legacyFilterAppliedRef = useRef(false);

  const scopedPropertyId =
    selectedPropertyIds && selectedPropertyIds.size === 1
      ? Array.from(selectedPropertyIds)[0]
      : null;

  useEffect(() => {
    if (!legacyDocFilter || legacyFilterAppliedRef.current) return;
    legacyFilterAppliedRef.current = true;
    if (legacyDocFilter === "expiring") onRecordsViewChange("expiring");
    if (legacyDocFilter === "expired") onRecordsViewChange("overdue");
    if (legacyDocFilter === "hazards") {
      onRecordsViewChange("documents");
      setHazards(true);
    }
    if (legacyDocFilter === "unlinked") {
      onRecordsViewChange("documents");
      setUnlinked(true);
    }
  }, [legacyDocFilter, onRecordsViewChange]);

  useEffect(() => {
    if (searchParams.get("upload") !== "1") return;
    setShowUploadMobile(true);
    const next = new URLSearchParams(searchParams);
    next.delete("upload");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (searchParams.get("addRule") !== "1" || !scopedPropertyId) return;
    setEditingRule(null);
    setRuleModalOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("addRule");
    setSearchParams(next, { replace: true });
  }, [searchParams, scopedPropertyId, setSearchParams]);

  useEffect(() => {
    const onOpenRule = () => {
      if (!scopedPropertyId) return;
      setEditingRule(null);
      setRuleModalOpen(true);
    };
    window.addEventListener("filla:records-open-rule-modal", onOpenRule);
    return () => window.removeEventListener("filla:records-open-rule-modal", onOpenRule);
  }, [scopedPropertyId]);

  useEffect(() => {
    const onOpenUpload = () => setShowUploadMobile(true);
    window.addEventListener("filla:records-open-upload", onOpenUpload);
    return () => window.removeEventListener("filla:records-open-upload", onOpenUpload);
  }, []);

  const { data: compliancePortfolio = [] } = useCompliancePortfolioQuery();
  const { data: propertyCompliance = [] } = useComplianceQuery(scopedPropertyId || undefined);

  const propertyOptions = useMemo(
    () =>
      properties
        .map((property: { id: string; name?: string; nickname?: string; address?: string }) => ({
          id: property.id,
          name: (property.name || property.nickname || property.address || "Property") as string,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [properties]
  );

  const complianceRecords = useMemo(
    () => buildComplianceRecordsFromPortfolio(compliancePortfolio, extraComplianceRecords),
    [compliancePortfolio, extraComplianceRecords]
  );

  const scopedComplianceRecords = useMemo(() => {
    if (!selectedPropertyIds || selectedPropertyIds.size === 0 || selectedPropertyIds.size >= properties.length) {
      return complianceRecords;
    }
    return complianceRecords.filter((r) => r.propertyId && selectedPropertyIds.has(r.propertyId));
  }, [complianceRecords, selectedPropertyIds, properties.length]);

  const statusFromView = useMemo((): ComplianceFilter => {
    if (recordsView === "expiring") return "expiring";
    if (recordsView === "overdue") return "overdue";
    if (recordsView === "missing") return "missing";
    return "all";
  }, [recordsView]);

  const mergedDocFilters = useMemo(() => {
    const tabUsesBroadFetch = recordsView === "compliance" || recordsView === "asset-docs";
    return {
      category: category || undefined,
      search: search || undefined,
      expiringSoon: recordsView === "expiring" ? true : !tabUsesBroadFetch && expiringSoon,
      expired: recordsView === "overdue" ? true : !tabUsesBroadFetch && expired,
      missing: recordsView === "missing" ? true : !tabUsesBroadFetch && missing,
      recentlyAdded: tabUsesBroadFetch ? false : recentlyAdded,
      hazards: legacyDocFilter === "hazards" || hazards,
      unlinked: !tabUsesBroadFetch && unlinked,
    };
  }, [category, search, recordsView, expiringSoon, expired, missing, recentlyAdded, hazards, unlinked, legacyDocFilter]);

  const { documents, isLoading: docsLoading } = usePropertyDocuments(scopedPropertyId || undefined, mergedDocFilters, {
    limit: 500,
    enabled: !!scopedPropertyId,
  });

  const { documents: contextDocuments = [] } = usePropertyDocuments(scopedPropertyId || undefined, {}, {
    limit: 500,
    enabled: !!scopedPropertyId,
  });

  const { spaces } = useSpaces(scopedPropertyId || "");
  const { data: assets = [] } = useAssetsQuery(scopedPropertyId || undefined);
  const complianceOptions = propertyCompliance.map((c: { id: string; title?: string }) => ({
    id: c.id,
    title: c.title || "Untitled",
  }));

  const documentsForWork = useMemo(() => {
    if (recordsView === "compliance") {
      return documents.filter((d) => COMPLIANCE_DOC_CATEGORIES.some((c) => c === d.category));
    }
    if (recordsView === "asset-docs") {
      return documents.filter((d) => {
        const meta = d.metadata as { detected_assets?: unknown[] } | null | undefined;
        const detected = meta?.detected_assets;
        return (
          (Array.isArray(detected) && detected.length > 0) ||
          d.category === "Warranties" ||
          d.category === "O&M Manuals"
        );
      });
    }
    return documents;
  }, [documents, recordsView]);

  const unlinkedDocCount = useMemo(
    () => contextDocuments.filter(docIsUnlinked).length,
    [contextDocuments]
  );

  const filteredComplianceRecords = useMemo(() => {
    const query = complianceSearch.trim().toLowerCase();
    return scopedComplianceRecords.filter((record) => {
      if (query && !`${record.title} ${record.propertyName} ${record.complianceType}`.toLowerCase().includes(query)) {
        return false;
      }
      if (statusFromView !== "all" && record.status !== statusFromView) return false;
      if (compliancePropertyFilter !== "all" && record.propertyId !== compliancePropertyFilter) return false;
      if (complianceTypeFilter !== "all" && record.complianceType !== complianceTypeFilter) return false;
      if (complianceExpiryRange !== "all") {
        const max = Number(complianceExpiryRange);
        const due = record.nextDueDate || record.expiryDate;
        if (!due) return false;
        const days = Math.ceil((new Date(due).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (days < 0 || days > max) return false;
      }
      return true;
    });
  }, [
    scopedComplianceRecords,
    complianceSearch,
    statusFromView,
    compliancePropertyFilter,
    complianceTypeFilter,
    complianceExpiryRange,
  ]);

  const complianceTypeOptions = useMemo(() => {
    const typeSet = new Set<string>();
    scopedComplianceRecords.forEach((record) => {
      if (record.complianceType) typeSet.add(record.complianceType);
    });
    return Array.from(typeSet).sort((a, b) => a.localeCompare(b));
  }, [scopedComplianceRecords]);

  const complianceSecondaryGroups: FilterGroup[] = useMemo(
    () => [
      {
        id: "compliance-property",
        label: "Property",
        options: propertyOptions.map((p) => ({
          id: `cprop-${p.id}`,
          label: p.name,
          icon: <Building2 className="h-4 w-4" />,
        })),
      },
      {
        id: "compliance-type",
        label: "Compliance type",
        options: complianceTypeOptions.map((t) => ({
          id: `ctype-${encodeURIComponent(t)}`,
          label: t,
          icon: <ClipboardCheck className="h-4 w-4" />,
        })),
      },
      {
        id: "compliance-expiry",
        label: "Expiry range",
        options: [
          { id: "cexp-30", label: "Within 30 days", icon: <Calendar className="h-4 w-4" /> },
          { id: "cexp-90", label: "Within 90 days", icon: <Calendar className="h-4 w-4" /> },
          { id: "cexp-365", label: "Within 1 year", icon: <Calendar className="h-4 w-4" /> },
        ],
      },
    ],
    [propertyOptions, complianceTypeOptions]
  );

  const complianceSelectedFilters = useMemo(() => {
    const s = new Set<string>();
    if (compliancePropertyFilter !== "all") s.add(`cprop-${compliancePropertyFilter}`);
    if (complianceTypeFilter !== "all") s.add(`ctype-${encodeURIComponent(complianceTypeFilter)}`);
    if (complianceExpiryRange !== "all") s.add(`cexp-${complianceExpiryRange}`);
    return s;
  }, [compliancePropertyFilter, complianceTypeFilter, complianceExpiryRange]);

  const handleComplianceFilterChange = useCallback(
    (filterId: string, selected: boolean) => {
      if (filterId.startsWith("cprop-")) {
        const id = filterId.slice(6);
        if (selected) setCompliancePropertyFilter(id);
        else setCompliancePropertyFilter("all");
        return;
      }
      if (filterId.startsWith("ctype-")) {
        const t = decodeURIComponent(filterId.slice(6));
        if (selected) setComplianceTypeFilter(t);
        else setComplianceTypeFilter("all");
        return;
      }
      if (filterId.startsWith("cexp-")) {
        const range = filterId.slice(5) as ExpiryRange;
        if (selected) setComplianceExpiryRange(range);
        else setComplianceExpiryRange("all");
      }
    },
    []
  );

  const selectedComplianceRecord = useMemo(
    () => filteredComplianceRecords.find((r) => r.id === selectedComplianceId) ?? null,
    [filteredComplianceRecords, selectedComplianceId]
  );

  const showComplianceList = recordsView !== "documents" && recordsView !== "asset-docs";
  const showDocumentsPanel =
    !!scopedPropertyId &&
    (recordsView === "all" ||
      recordsView === "documents" ||
      recordsView === "asset-docs" ||
      recordsView === "expiring" ||
      recordsView === "overdue" ||
      recordsView === "missing");

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["property-documents"] });
    queryClient.invalidateQueries({ queryKey: ["document-detail"] });
    queryClient.invalidateQueries({ queryKey: ["compliance_portfolio"] });
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

  const subtitle =
    "What you have, what expires, and where it belongs — obligations, evidence, and uploads in one place.";

  return (
    <div ref={panelRef} className="h-full min-h-0 flex flex-col px-[10px] max-sm:px-0 pt-[8px] pb-[11px] max-pane:px-2">
      <header className="mb-3 min-w-0 border-b border-border/15 pb-3">
        <div className="flex items-start gap-2">
          <ShieldCheck className="h-6 w-6 shrink-0 text-primary mt-0.5" />
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-tight text-foreground">Records</h2>
            <p className="text-xs mt-1 text-muted-foreground leading-snug">{subtitle}</p>
          </div>
        </div>
      </header>

      <RecordsContextSummary
        complianceRecords={scopedComplianceRecords}
        documentTotal={scopedPropertyId ? contextDocuments.length : undefined}
        docUnlinked={scopedPropertyId ? unlinkedDocCount : undefined}
        className="mb-3"
      />

      <div className="mb-3">
        <WorkspaceSectionHeading>View</WorkspaceSectionHeading>
        <WorkspaceTabList className="flex-wrap">
          {RECORDS_VIEWS.map(({ id, label }) => (
            <WorkspaceTabTrigger key={id} selected={recordsView === id} onClick={() => onRecordsViewChange(id)}>
              {label}
            </WorkspaceTabTrigger>
          ))}
        </WorkspaceTabList>
      </div>

      <div className="flex-shrink-0 mb-3">
        <FilterBar
          primaryOptions={[] as FilterOption[]}
          secondaryGroups={complianceSecondaryGroups}
          selectedFilters={complianceSelectedFilters}
          onFilterChange={handleComplianceFilterChange}
          primaryOptionLimit={0}
          clearPreservePrefixes={[]}
          collapseFilterChipAfterMs={2000}
          collapseInteractionRootRef={panelRef}
          showClearButton={
            compliancePropertyFilter !== "all" ||
            complianceTypeFilter !== "all" ||
            complianceExpiryRange !== "all" ||
            complianceSearch.trim().length > 0
          }
          onClearAll={() => {
            setCompliancePropertyFilter("all");
            setComplianceTypeFilter("all");
            setComplianceExpiryRange("all");
            setComplianceSearch("");
            setComplianceSearchOpen(false);
          }}
          primaryTrailing={
            <FilterChip
              label="Search"
              icon={<Search className="h-4 w-4" />}
              selected={complianceSearchOpen || complianceSearch.trim().length > 0}
              onSelect={() => setComplianceSearchOpen((open) => !open)}
              className="h-[24px]"
            />
          }
        />
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-200 ease-out",
            complianceSearchOpen || complianceSearch.trim().length > 0 ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          )}
        >
          <div className="overflow-hidden min-h-0">
            <input
              type="search"
              value={complianceSearch}
              onChange={(event) => setComplianceSearch(event.target.value)}
              placeholder="Search records, certificates, or types"
              className={cn(
                "mt-2 w-full rounded-[10px] bg-background shadow-[inset_1px_2px_4px_rgba(0,0,0,0.12),inset_-1px_-1px_2px_rgba(255,255,255,0.6)]",
                "px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              )}
              aria-label="Search records"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pb-4">
        {!scopedPropertyId && (
          <p className="text-xs text-muted-foreground rounded-xl bg-card/70 shadow-e1 p-3">
            Select a single property to upload documents, run asset-aware views, and edit rules. Portfolio slices above
            still follow your scope chips.
          </p>
        )}

        {showComplianceList && (
          <section className="space-y-2">
            <WorkspaceSectionHeading>Obligations & portfolio</WorkspaceSectionHeading>
            {recordsView === "compliance" && scopedPropertyId && propertyCompliance.length > 0 && (
              <div className="space-y-2 mb-3">
                {(propertyCompliance as { id: string }[]).map((item) => (
                  <ComplianceCard key={item.id} compliance={item as never} />
                ))}
              </div>
            )}
            <div className="space-y-2">
              {filteredComplianceRecords.map((record) => (
                <OperationalStreamCard
                  key={record.id}
                  id={`compliance-card-${record.id}`}
                  onClick={() => setSelectedComplianceId(record.id)}
                  typeChip="COMPLIANCE"
                  icon={
                    record.status === "overdue" ? (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    ) : record.status === "expiring" ? (
                      <Waves className="h-4 w-4 text-amber-600" />
                    ) : record.status === "missing" ? (
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    )
                  }
                  title={record.title}
                  context={`${record.propertyName} · ${record.complianceType}`}
                  hint={`Expires: ${formatDueText(record.nextDueDate || record.expiryDate)}`}
                  statusText={getComplianceStatusText(record)}
                  accent={
                    record.status === "overdue"
                      ? "red"
                      : record.status === "expiring"
                        ? "amber"
                        : record.status === "healthy"
                          ? "green"
                          : "slate"
                  }
                  actions={[
                    {
                      id: "create-inspection-task",
                      label: "Create inspection task",
                      onClick: () => onOpenIntake?.("report_issue"),
                    },
                    {
                      id: "upload-certificate",
                      label: "Upload document",
                      onClick: () => (scopedPropertyId ? setShowUploadMobile(true) : onOpenIntake?.("add_record")),
                    },
                    {
                      id: "view-record",
                      label: "View detail",
                      onClick: () => setSelectedComplianceId(record.id),
                    },
                  ]}
                  className={cn(selectedComplianceRecord?.id === record.id && "ring-1 ring-[#8EC9CE]")}
                />
              ))}
              {filteredComplianceRecords.length === 0 && (
                <div className="rounded-xl bg-card/70 shadow-e1 p-3 text-xs text-muted-foreground">
                  No records match this view and filters. Add evidence from the right column or adjust filters.
                </div>
              )}
            </div>
          </section>
        )}

        {recordsView === "compliance" && scopedPropertyId && (
          <section className="space-y-3">
            <WorkspaceSectionHeading>Rules & automation</WorkspaceSectionHeading>
            <ComplianceRulesSection
              propertyId={scopedPropertyId}
              onAddRule={() => {
                setEditingRule(null);
                setRuleModalOpen(true);
              }}
              onEditRule={(rule) => {
                setEditingRule(rule);
                setRuleModalOpen(true);
              }}
            />
            <ComplianceAutomationPanel propertyId={scopedPropertyId} />
          </section>
        )}

        {showDocumentsPanel && (
          <section className="space-y-3">
            <WorkspaceSectionHeading>Stored documents</WorkspaceSectionHeading>
            <DocumentCategoryChips selected={category} onSelect={setCategory} />
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
            {docsLoading ? (
              <p className="text-xs text-muted-foreground">Loading documents…</p>
            ) : documentsForWork.length === 0 ? (
              <div className="rounded-xl bg-card/70 shadow-e1 p-3 text-xs text-muted-foreground">
                No documents match these filters. Upload from the right column or switch view.
              </div>
            ) : (
              <DocumentGrid
                documents={documentsForWork}
                propertyId={scopedPropertyId!}
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
            )}
          </section>
        )}

        {selectedComplianceRecord && (
          <div className="rounded-xl bg-card/70 shadow-e1 p-3 text-xs space-y-1.5">
            <p className="font-medium text-foreground">Record detail</p>
            <p>
              <span className="text-muted-foreground">Type:</span> {selectedComplianceRecord.complianceType}
            </p>
            <p>
              <span className="text-muted-foreground">Property:</span> {selectedComplianceRecord.propertyName}
            </p>
            <p>
              <span className="text-muted-foreground">Expiry:</span>{" "}
              {formatDueText(selectedComplianceRecord.nextDueDate || selectedComplianceRecord.expiryDate)}
            </p>
            <p>
              <span className="text-muted-foreground">Evidence:</span> {selectedComplianceRecord.linkedDocument}
            </p>
          </div>
        )}
      </div>

      {scopedPropertyId && (
        <ComplianceRuleModal
          open={ruleModalOpen}
          onOpenChange={setRuleModalOpen}
          propertyId={scopedPropertyId}
          editRule={editingRule as never}
        />
      )}

      <DocumentDetailDrawer
        documentId={selectedDocId}
        propertyId={scopedPropertyId}
        onClose={() => setSelectedDocId(null)}
        onRefresh={handleRefresh}
      />

      <Dialog open={showUploadMobile} onOpenChange={setShowUploadMobile}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload documents</DialogTitle>
          </DialogHeader>
          {scopedPropertyId ? (
            <DocumentUploadZone propertyId={scopedPropertyId} onUploadComplete={() => { setShowUploadMobile(false); handleRefresh(); }} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
