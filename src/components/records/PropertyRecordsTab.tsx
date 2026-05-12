import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  Calendar,
  ClipboardCheck,
  FileText,
  Filter,
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
import { IconButton } from "@/components/ui/IconButton";
import { OperationalStreamCard } from "@/components/dashboard/OperationalStreamCard";
import { WorkspaceSectionHeading } from "@/components/property-workspace";
import { DocumentCategoryChips } from "@/components/properties/DocumentCategoryChips";
import { DocumentSearchFilters } from "@/components/properties/DocumentSearchFilters";
import { DocumentGrid } from "@/components/properties/DocumentGrid";
import { DocumentDetailDrawer } from "@/components/properties/DocumentDetailDrawer";
import { DocumentUploadZone } from "@/components/properties/DocumentUploadZone";
import { useDocumentUpload } from "@/hooks/property/useDocumentUpload";
import { ComplianceRulesSection } from "@/components/compliance/ComplianceRulesSection";
import { ComplianceRuleModal } from "@/components/compliance/ComplianceRuleModal";
import { ComplianceCard } from "@/components/compliance/ComplianceCard";
import { ComplianceAutomationPanel } from "@/components/compliance/ComplianceAutomationPanel";
import { cn } from "@/lib/utils";
import type { RecordsView } from "@/lib/propertyRoutes";
import type { IntakeMode } from "@/types/intake";
import {
  buildComplianceRecordsFromPortfolio,
  formatDueText,
  getComplianceStatusText,
  type ComplianceRecord,
} from "./complianceRecordModel";

const COMPLIANCE_DOC_CATEGORIES = ["Fire Safety", "Electrical", "Water", "Mechanical"] as const;

const RECORDS_FILE_ACCEPT = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv";

/**
 * When `?upload=1` is handled, React Strict Mode (dev) or batched re-renders can run the effect
 * twice before `upload` is stripped from the URL — each run would call `input.click()`, so the
 * native file sheet reopens right after the user confirms, which looks like a failed upload.
 */
let recordsUploadDeepLinkNonce = 0;

type ExpiryRange = "all" | "30" | "90" | "365";
type ComplianceFilter = "all" | "expiring" | "overdue" | "missing";

const RECORDS_TOP_CHIPS: { id: RecordsView; label: string }[] = [
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
  const [recordsAdvancedBarOpen, setRecordsAdvancedBarOpen] = useState(false);
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
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<unknown | null>(null);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const recordsUploadInputRef = useRef<HTMLInputElement | null>(null);
  const lastRailPickerOpenMs = useRef(0);
  const legacyFilterAppliedRef = useRef(false);

  const scopedPropertyId =
    selectedPropertyIds && selectedPropertyIds.size === 1
      ? Array.from(selectedPropertyIds)[0]
      : null;

  const { upload: uploadPropertyDocuments, uploading: recordsUploading } = useDocumentUpload(
    scopedPropertyId ?? ""
  );

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

    const myNonce = ++recordsUploadDeepLinkNonce;
    const next = new URLSearchParams(searchParams);
    next.delete("upload");
    setSearchParams(next, { replace: true });

    if (!scopedPropertyId) {
      toast({
        title: "Select a property",
        description: "Pick one property on the workbench, then upload documents from Records.",
        variant: "destructive",
      });
      return;
    }

    const t = window.setTimeout(() => {
      if (myNonce !== recordsUploadDeepLinkNonce) return;
      recordsUploadInputRef.current?.click();
    }, 0);

    return () => window.clearTimeout(t);
  }, [searchParams, setSearchParams, scopedPropertyId, toast]);

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

  const openRecordsFilePicker = useCallback(() => {
    if (!scopedPropertyId) {
      toast({
        title: "Select a property",
        description: "Select exactly one property to upload documents.",
        variant: "destructive",
      });
      return;
    }
    const now = Date.now();
    if (now - lastRailPickerOpenMs.current < 1200) return;
    lastRailPickerOpenMs.current = now;
    window.requestAnimationFrame(() => {
      recordsUploadInputRef.current?.click();
    });
  }, [scopedPropertyId, toast]);

  useEffect(() => {
    const onOpenUpload = () => openRecordsFilePicker();
    window.addEventListener("filla:records-open-upload", onOpenUpload);
    return () => window.removeEventListener("filla:records-open-upload", onOpenUpload);
  }, [openRecordsFilePicker]);

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

  const runRecordsFileUpload = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList?.length || !scopedPropertyId) return;
      try {
        const created = await uploadPropertyDocuments(Array.from(fileList));
        toast({
          title: "Upload complete",
          description: `${created.length} document(s) uploaded`,
        });
        queryClient.invalidateQueries({ queryKey: ["property-documents"] });
        queryClient.invalidateQueries({ queryKey: ["document-detail"] });
        queryClient.invalidateQueries({ queryKey: ["compliance_portfolio"] });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        toast({ title: "Upload failed", description: msg, variant: "destructive" });
      }
    },
    [scopedPropertyId, uploadPropertyDocuments, toast, queryClient]
  );

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

  return (
    <div ref={panelRef} className="h-full min-h-0 flex flex-col px-[10px] max-sm:px-0 pt-[8px] pb-[11px] max-pane:px-2">
      {recordsUploading && (
        <p className="text-xs text-muted-foreground mb-2" aria-live="polite">
          Uploading…
        </p>
      )}

      <div className="mb-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <IconButton
            role="filter-toggle"
            icon={<Filter className="h-4 w-4" />}
            active={recordsAdvancedBarOpen}
            onClick={() => setRecordsAdvancedBarOpen((o) => !o)}
            aria-label={recordsAdvancedBarOpen ? "Hide record filters" : "Property and type filters"}
            tooltip={recordsAdvancedBarOpen ? "Hide filters" : "Record filters"}
          />
          {RECORDS_TOP_CHIPS.map(({ id, label }) => (
            <FilterChip
              key={id}
              label={label}
              selected={recordsView === id}
              onSelect={() => onRecordsViewChange(id)}
            />
          ))}
        </div>

        <div className="relative flex items-center gap-2 rounded-[10px] bg-background/80 px-3 py-2 shadow-[inset_1px_2px_4px_rgba(0,0,0,0.12),inset_-1px_-1px_2px_rgba(255,255,255,0.5)]">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={complianceSearch}
            onChange={(event) => setComplianceSearch(event.target.value)}
            placeholder="Search records, certificates, or types"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
            aria-label="Search records"
          />
        </div>

        {recordsAdvancedBarOpen ? (
          <FilterBar
            primaryOptions={[] as FilterOption[]}
            secondaryGroups={complianceSecondaryGroups}
            selectedFilters={complianceSelectedFilters}
            onFilterChange={handleComplianceFilterChange}
            primaryOptionLimit={0}
            clearPreservePrefixes={[]}
            collapseFilterChipAfterMs={2000}
            collapseInteractionRootRef={panelRef}
            hideFilterByButton
            defaultNavigationLevel="categories"
            onExitCategoriesLevel={() => setRecordsAdvancedBarOpen(false)}
            showClearButton={
              compliancePropertyFilter !== "all" ||
              complianceTypeFilter !== "all" ||
              complianceExpiryRange !== "all"
            }
            onClearAll={() => {
              setCompliancePropertyFilter("all");
              setComplianceTypeFilter("all");
              setComplianceExpiryRange("all");
            }}
          />
        ) : null}
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
                      onClick: () => (scopedPropertyId ? openRecordsFilePicker() : onOpenIntake?.("add_record")),
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
            <DocumentUploadZone
              propertyId={scopedPropertyId!}
              onUploadComplete={handleRefresh}
              accept={RECORDS_FILE_ACCEPT}
            />
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
        propertyId={scopedPropertyId ?? ""}
        onClose={() => setSelectedDocId(null)}
        onRefresh={handleRefresh}
      />

      <input
        ref={recordsUploadInputRef}
        type="file"
        multiple
        className="sr-only"
        accept={RECORDS_FILE_ACCEPT}
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const files = e.target.files;
          void runRecordsFileUpload(files);
          // Defer reset so the browser fully closes the sheet before we clear the value (avoids
          // some WebKit builds immediately re-focusing / re-querying the picker).
          window.requestAnimationFrame(() => {
            e.target.value = "";
          });
        }}
      />
    </div>
  );
}
