import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  Calendar,
  ChevronRight,
  ClipboardCheck,
  FileText,
  FolderOpen,
  Search,
  Shield,
  ShieldCheck,
  Tag,
  Waves,
  Wrench,
} from "lucide-react";
import { useCompliancePortfolioQuery } from "@/hooks/useCompliancePortfolioQuery";
import {
  DOCUMENT_CATEGORIES,
  usePropertyDocuments,
  type PropertyDocument,
} from "@/hooks/property/usePropertyDocuments";
import { useSpaces } from "@/hooks/useSpaces";
import { useAssetsQuery } from "@/hooks/useAssetsQuery";
import { useComplianceQuery } from "@/hooks/useComplianceQuery";
import { useComplianceRules } from "@/hooks/useComplianceRules";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FilterBar, type FilterGroup, type FilterOption } from "@/components/ui/filters/FilterBar";
import { OperationalStreamCard } from "@/components/dashboard/OperationalStreamCard";
import { WorkspaceSectionHeading } from "@/components/property-workspace";
import { DocumentGrid } from "@/components/properties/DocumentGrid";
import { DocumentDetailDrawer } from "@/components/properties/DocumentDetailDrawer";
import { DocumentUploadZone } from "@/components/properties/DocumentUploadZone";
import { useDocumentUpload } from "@/hooks/property/useDocumentUpload";
import { ComplianceCard } from "@/components/compliance/ComplianceCard";
import { ComplianceDetailDrawer } from "@/components/compliance/ComplianceDetailDrawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { propertyComplianceSetupPath, type RecordsView } from "@/lib/propertyRoutes";
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

const RECORDS_STATUS_FILTERS: { id: string; view: Extract<RecordsView, "all" | "expiring" | "overdue" | "missing">; label: string }[] = [
  { id: "records-all", view: "all", label: "All" },
  { id: "records-expiring", view: "expiring", label: "Expiring" },
  { id: "records-overdue", view: "overdue", label: "Overdue" },
  { id: "records-missing", view: "missing", label: "Missing" },
];

const RECORDS_KIND_FILTERS: { id: string; view: Extract<RecordsView, "compliance" | "documents" | "asset-docs">; label: string }[] = [
  { id: "records-kind-compliance", view: "compliance", label: "Compliance" },
  { id: "records-kind-documents", view: "documents", label: "Documents" },
  { id: "records-kind-asset-docs", view: "asset-docs", label: "Asset docs" },
];

function recordsViewFilterId(view: RecordsView): string {
  const kind = RECORDS_KIND_FILTERS.find((item) => item.view === view);
  if (kind) return kind.id;
  return RECORDS_STATUS_FILTERS.find((item) => item.view === view)?.id ?? "records-all";
}

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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { orgId } = useActiveOrg();
  const { toast } = useToast();
  const legacyDocFilter = searchParams.get("filter");

  const [recordsSearch, setRecordsSearch] = useState("");
  const [compliancePropertyFilter, setCompliancePropertyFilter] = useState<string>("all");
  const [complianceTypeFilter, setComplianceTypeFilter] = useState<string>("all");
  const [complianceExpiryRange, setComplianceExpiryRange] = useState<ExpiryRange>("all");
  const [selectedComplianceId, setSelectedComplianceId] = useState<string | null>(null);

  const [category, setCategory] = useState<string | null>(null);
  const [recentlyAdded, setRecentlyAdded] = useState(false);
  const [hazards, setHazards] = useState(false);
  const [unlinked, setUnlinked] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const recordsUploadInputRef = useRef<HTMLInputElement | null>(null);
  const lastRailPickerOpenMs = useRef(0);
  const legacyFilterAppliedRef = useRef(false);

  const scopedPropertyId =
    selectedPropertyIds && selectedPropertyIds.size === 1
      ? Array.from(selectedPropertyIds)[0]
      : null;

  const { data: complianceRules = [] } = useComplianceRules(scopedPropertyId ?? undefined);

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

  // Legacy deep link: ?addRule=1 used to open the modal in Records — send to setup.
  useEffect(() => {
    if (searchParams.get("addRule") !== "1" || !scopedPropertyId) return;
    const next = new URLSearchParams(searchParams);
    next.delete("addRule");
    setSearchParams(next, { replace: true });
    navigate(propertyComplianceSetupPath(scopedPropertyId, { addRule: true }));
  }, [searchParams, scopedPropertyId, setSearchParams, navigate]);

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
      search: recordsSearch || undefined,
      expiringSoon: recordsView === "expiring",
      expired: recordsView === "overdue",
      missing: recordsView === "missing",
      recentlyAdded: tabUsesBroadFetch ? false : recentlyAdded,
      hazards: legacyDocFilter === "hazards" || hazards,
      unlinked: !tabUsesBroadFetch && unlinked,
    };
  }, [category, recordsSearch, recordsView, recentlyAdded, hazards, unlinked, legacyDocFilter]);

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
    const query = recordsSearch.trim().toLowerCase();
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
    recordsSearch,
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

  const recordsPrimaryOptions: FilterOption[] = useMemo(
    () => RECORDS_STATUS_FILTERS.map((item) => ({ id: item.id, label: item.label })),
    []
  );

  const recordsSecondaryGroups: FilterGroup[] = useMemo(
    () => [
      {
        id: "records-kind",
        label: "Kind",
        options: RECORDS_KIND_FILTERS.map((item) => ({
          id: item.id,
          label: item.label,
          icon:
            item.view === "compliance" ? (
              <Shield className="h-4 w-4" />
            ) : item.view === "asset-docs" ? (
              <Wrench className="h-4 w-4" />
            ) : (
              <FolderOpen className="h-4 w-4" />
            ),
        })),
      },
      {
        id: "document-category",
        label: "Category",
        options: DOCUMENT_CATEGORIES.map((cat) => ({
          id: `dcat-${cat}`,
          label: cat,
          icon: <Tag className="h-4 w-4" />,
        })),
      },
      {
        id: "document-flags",
        label: "Documents",
        options: [
          { id: "dflag-recent", label: "Recently added", icon: <Calendar className="h-4 w-4" /> },
          { id: "dflag-hazards", label: "Hazards", icon: <AlertTriangle className="h-4 w-4" />, color: "#EB6834" },
          { id: "dflag-unlinked", label: "Unlinked", icon: <FileText className="h-4 w-4" /> },
        ],
      },
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

  const recordsSelectedFilters = useMemo(() => {
    const s = new Set<string>();
    s.add(recordsViewFilterId(recordsView));
    if (category) s.add(`dcat-${category}`);
    if (recentlyAdded) s.add("dflag-recent");
    if (hazards) s.add("dflag-hazards");
    if (unlinked) s.add("dflag-unlinked");
    if (compliancePropertyFilter !== "all") s.add(`cprop-${compliancePropertyFilter}`);
    if (complianceTypeFilter !== "all") s.add(`ctype-${encodeURIComponent(complianceTypeFilter)}`);
    if (complianceExpiryRange !== "all") s.add(`cexp-${complianceExpiryRange}`);
    return s;
  }, [
    recordsView,
    category,
    recentlyAdded,
    hazards,
    unlinked,
    compliancePropertyFilter,
    complianceTypeFilter,
    complianceExpiryRange,
  ]);

  const recordsHasExtraFilters =
    recordsView !== "all" ||
    Boolean(category) ||
    recentlyAdded ||
    hazards ||
    unlinked ||
    compliancePropertyFilter !== "all" ||
    complianceTypeFilter !== "all" ||
    complianceExpiryRange !== "all";

  const resetRecordsFilters = useCallback(() => {
    onRecordsViewChange("all");
    setCategory(null);
    setRecentlyAdded(false);
    setHazards(false);
    setUnlinked(false);
    setCompliancePropertyFilter("all");
    setComplianceTypeFilter("all");
    setComplianceExpiryRange("all");
    setRecordsSearch("");
  }, [onRecordsViewChange]);

  const handleRecordsFilterChange = useCallback(
    (filterId: string, selected: boolean) => {
      const status = RECORDS_STATUS_FILTERS.find((item) => item.id === filterId);
      if (status) {
        onRecordsViewChange(selected ? status.view : "all");
        return;
      }
      const kind = RECORDS_KIND_FILTERS.find((item) => item.id === filterId);
      if (kind) {
        onRecordsViewChange(selected ? kind.view : "all");
        return;
      }
      if (filterId.startsWith("dcat-")) {
        const next = filterId.slice(5);
        setCategory(selected ? next : null);
        return;
      }
      if (filterId === "dflag-recent") {
        setRecentlyAdded(selected);
        return;
      }
      if (filterId === "dflag-hazards") {
        setHazards(selected);
        return;
      }
      if (filterId === "dflag-unlinked") {
        setUnlinked(selected);
        return;
      }
      if (filterId.startsWith("cprop-")) {
        const id = filterId.slice(6);
        setCompliancePropertyFilter(selected ? id : "all");
        return;
      }
      if (filterId.startsWith("ctype-")) {
        const t = decodeURIComponent(filterId.slice(6));
        setComplianceTypeFilter(selected ? t : "all");
        return;
      }
      if (filterId.startsWith("cexp-")) {
        const range = filterId.slice(5) as ExpiryRange;
        setComplianceExpiryRange(selected ? range : "all");
      }
    },
    [onRecordsViewChange]
  );

  const selectedComplianceRecord = useMemo(
    () =>
      selectedComplianceId
        ? complianceRecords.find((r) => r.id === selectedComplianceId) ??
          filteredComplianceRecords.find((r) => r.id === selectedComplianceId) ??
          null
        : null,
    [complianceRecords, filteredComplianceRecords, selectedComplianceId]
  );

  const [complianceDrawerOpen, setComplianceDrawerOpen] = useState(false);
  useEffect(() => {
    setComplianceDrawerOpen(Boolean(selectedComplianceRecord));
  }, [selectedComplianceRecord]);

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("attachment_spaces").insert({
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("attachment_assets").insert({
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("attachment_compliance").insert({
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
        <FilterBar
          primaryOptions={recordsPrimaryOptions}
          secondaryGroups={recordsSecondaryGroups}
          selectedFilters={recordsSelectedFilters}
          onFilterChange={handleRecordsFilterChange}
          primaryOptionLimit={0}
          clearPreservePrefixes={[]}
          collapseFilterChipAfterMs={2000}
          collapseInteractionRootRef={panelRef}
          showClearButton={recordsHasExtraFilters}
          onClearAll={resetRecordsFilters}
        />

        <div className="relative flex items-center gap-2 rounded-[10px] bg-background/80 px-3 py-2 shadow-[inset_1px_2px_4px_rgba(0,0,0,0.12),inset_-1px_-1px_2px_rgba(255,255,255,0.5)]">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={recordsSearch}
            onChange={(event) => setRecordsSearch(event.target.value)}
            placeholder="Search records, certificates, or types"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
            aria-label="Search records"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pb-4">
        {!scopedPropertyId && (
          <p className="text-xs text-muted-foreground rounded-xl bg-card/70 shadow-e1 p-3">
            Select a single property to upload documents, run asset-aware views, and manage rules. Portfolio slices above
            still follow your scope chips.
          </p>
        )}

        {recordsView === "compliance" && scopedPropertyId && (
          <div className="rounded-xl bg-card/70 shadow-e1 px-3 py-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0 flex items-start gap-2">
              <Shield className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {complianceRules.length === 0
                    ? "No compliance rules yet"
                    : `${complianceRules.length} compliance rule${complianceRules.length === 1 ? "" : "s"}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Set up recurring obligations and organisation automation.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 text-primary hover:text-primary/90 gap-1"
              onClick={() => navigate(propertyComplianceSetupPath(scopedPropertyId))}
            >
              Manage
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
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
                      <Waves className="h-4 w-4 text-warning-foreground" />
                    ) : record.status === "missing" ? (
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 text-success-foreground" />
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
                  className={cn(selectedComplianceRecord?.id === record.id && "ring-1 ring-primary")}
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

        {showDocumentsPanel && (
          <section className="space-y-3">
            <WorkspaceSectionHeading>Stored documents</WorkspaceSectionHeading>
            <DocumentUploadZone
              propertyId={scopedPropertyId!}
              onUploadComplete={handleRefresh}
              accept={RECORDS_FILE_ACCEPT}
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

      </div>

      <ComplianceDetailDrawer
        open={complianceDrawerOpen}
        onOpenChange={(open) => {
          setComplianceDrawerOpen(open);
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
