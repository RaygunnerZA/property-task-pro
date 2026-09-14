import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useAssetsQuery } from "@/hooks/useAssetsQuery";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useAssetFilesForAssets } from "@/hooks/useAssetFilesForAssets";
import { useQueryClient } from "@tanstack/react-query";
import { useSpaces } from "@/hooks/useSpaces";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { AssetCard } from "@/components/assets/AssetCard";
import { AssetDetailPanel } from "@/components/assets/AssetDetailPanel";
import type { AssetMetricKey } from "@/components/assets/AssetsSummaryRow";
import { AssetLinkedTasksList } from "@/components/assets/AssetLinkedTasksList";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Package, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createTempImage, cleanupTempImage } from "@/utils/image-optimization";
import { GlobalAppHeader } from "@/components/layout/GlobalAppHeader";
import { propertyActivityAssetsPath } from "@/lib/propertyRoutes";
import { markQuickWinComplete } from "@/lib/quickWins";
import { NeomorphicInput } from "@/components/design-system/NeomorphicInput";
import { FrameworkEmptyState } from "@/components/property-framework";
import { LoadingState } from "@/components/design-system/LoadingState";
import { ErrorState } from "@/components/design-system/ErrorState";
import { FilterChip } from "@/components/chips/filter";
import { PropertyWorkspaceLayout, WorkspaceHealthGrid, WorkspaceSurfaceCard, WorkspaceSectionHeading, WorkspaceTabList, WorkspaceTabTrigger } from "@/components/property-workspace";
import { PropertyRecentAssetsList } from "@/components/properties/PropertyRecentAssetsList";
import { PropertyAssetGroupCarousel } from "@/components/assets/PropertyAssetGroupCarousel";
import { AllAssetsDirectory } from "@/components/assets/AllAssetsDirectory";
import { ManageTagsPanel } from "@/components/property/ManageTagsPanel";
import { AddAssetWorkspaceForm } from "@/components/assets/AddAssetWorkspaceForm";
import { cn } from "@/lib/utils";
import {
  WorkbenchControlsProvider,
  useWorkbenchControls,
} from "@/contexts/WorkbenchControlsContext";
import { invalidateAssetQueries } from "@/lib/invalidateAssetQueries";
import { defaultColorForAssetType } from "@/lib/assetIconDefaults";
import { LAYOUT_BREAKPOINTS } from "@/lib/layoutBreakpoints";
import { FILLA_TURQUOISE } from "@/lib/brandColors";
import type { Json, Tables } from "@/integrations/supabase/types";

type AssetViewRow = Tables<"assets_view">;

const ASSETS_ILLUSTRATION = "/centre-workbench/assets.png";

function AssetsPageChrome({
  accentColor,
  children,
}: {
  accentColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="dashboard-workbench min-h-screen w-full max-w-full overflow-x-hidden bg-background">
      <GlobalAppHeader accentColor={accentColor} />
      {/* Full-bleed DualPane like Tasks/Calendar/Records — DualPane owns column insets. */}
      <div className="w-full pt-[20px]">{children}</div>
    </div>
  );
}

const STATUS_FILTERS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "retired", label: "Retired" },
];

type AssetsWorkTab = "groups" | "issues";

const WORKSPACE_WIDE_MQ = `(min-width: ${LAYOUT_BREAKPOINTS.layout}px)`;

function useWorkspaceWide() {
  const [wide, setWide] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(WORKSPACE_WIDE_MQ).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(WORKSPACE_WIDE_MQ);
    const onChange = () => setWide(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return wide;
}

const Assets = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { data: assets = [], isLoading: loading, error } = useAssetsQuery();
  const { data: properties = [] } = usePropertiesQuery();
  const showActivityTabs = location.pathname.startsWith("/property");
  const queryClient = useQueryClient();
  const { orgId } = useActiveOrg();
  const { searchQuery } = useWorkbenchControls();
  const [filterPropertyId, setFilterPropertyId] = useState<string>("");
  const [filterSpaceId, setFilterSpaceId] = useState<string>("");
  const [propertyId, setPropertyId] = useState("");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [complianceOnly, setComplianceOnly] = useState(false);
  const [needsInspectionOnly, setNeedsInspectionOnly] = useState(false);
  /** `?attention=1` — active assets with poor condition or open tasks (matches property hub tile). */
  const [attentionIssuesOnly, setAttentionIssuesOnly] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [assetsWorkTab, setAssetsWorkTab] = useState<AssetsWorkTab>("groups");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isWide = useWorkspaceWide();
  const railFormRef = useRef<HTMLDivElement>(null);

  const propertyFromUrl = searchParams.get("property") ?? "";
  const assetIdFromUrl = searchParams.get("assetId")?.trim() || null;

  // Deep links: `/property/assets?assetId=` (and legacy `/assets/:id` redirects).
  useEffect(() => {
    if (assetIdFromUrl) {
      setSelectedAssetId(assetIdFromUrl);
    }
  }, [assetIdFromUrl]);

  const openAsset = useCallback(
    (assetId: string | null) => {
      setSelectedAssetId(assetId);
      const next = new URLSearchParams(searchParams);
      if (assetId) {
        next.set("assetId", assetId);
      } else {
        next.delete("assetId");
      }
      const qs = next.toString();
      navigate(`${location.pathname}${qs ? `?${qs}` : ""}`, { replace: true });
    },
    [navigate, location.pathname, searchParams]
  );
  const effectiveScopeId = propertyFromUrl || filterPropertyId;
  const scopedPropertyForChrome = useMemo(
    () => properties.find((p: { id: string }) => p.id === effectiveScopeId),
    [properties, effectiveScopeId]
  );
  const isPropertyScoped = Boolean(effectiveScopeId);
  const propertyHeaderAccent =
    (scopedPropertyForChrome as { icon_color_hex?: string | null } | undefined)?.icon_color_hex?.trim() ||
    FILLA_TURQUOISE;

  const { spaces: filterSpaces } = useSpaces(filterPropertyId || undefined);
  const { spaces: formSpaces } = useSpaces(propertyId || undefined);

  const openAddFlow = useCallback(() => {
    if (isWide) {
      requestAnimationFrame(() => {
        railFormRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        const el = document.getElementById("asset-name-rail");
        if (el && "focus" in el) (el as HTMLInputElement).focus();
      });
    } else {
      setIsDialogOpen(true);
    }
  }, [isWide]);

  // Check for ?add=true in URL (preserve ?property= when present)
  useEffect(() => {
    if (searchParams.get("add") !== "true") return;
    const propertyParam = searchParams.get("property");
    const next = propertyActivityAssetsPath(propertyParam);
    navigate(next, { replace: true });
    if (typeof window !== "undefined" && window.matchMedia(WORKSPACE_WIDE_MQ).matches) {
      requestAnimationFrame(() => {
        railFormRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    } else {
      setIsDialogOpen(true);
    }
  }, [searchParams, navigate]);

  // Pre-filter by property when navigating from property context (?property=id)
  useEffect(() => {
    const propertyParam = searchParams.get("property");
    if (propertyParam) {
      setFilterPropertyId(propertyParam);
    }
  }, [searchParams]);

  useEffect(() => {
    setAttentionIssuesOnly(searchParams.get("attention") === "1");
    if (searchParams.get("attention") === "1") {
      setAssetsWorkTab("issues");
    }
  }, [searchParams]);

  useEffect(() => {
    if (filterPropertyId) {
      setPropertyId(filterPropertyId);
    }
  }, [filterPropertyId]);

  useEffect(() => {
    if (isWide && isDialogOpen) {
      setIsDialogOpen(false);
    }
  }, [isWide, isDialogOpen]);

  // Form state for create
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [serial, setSerial] = useState("");
  const [spaceId, setSpaceId] = useState("none");
  const [conditionScore, setConditionScore] = useState<string>("100");
  const [iconName, setIconName] = useState("");
  const [iconColor, setIconColor] = useState(() => defaultColorForAssetType(null));
  const [pendingFiles, setPendingFiles] = useState<{ id: string; file_url: string; thumbnail_url?: string; file_type: string; displayName: string; isImage: boolean }[]>([]);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePropertyChange = (value: string) => {
    setPropertyId(value);
    setSpaceId("none");
  };

  const isImageFile = (file: File) => {
    const t = file.type?.toLowerCase() || "";
    return t.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp"].includes(file.name.split(".").pop()?.toLowerCase() || "");
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, asImage: boolean) => {
    const files = e.target.files;
    if (!files?.length || !orgId) return;
    setIsUploadingFile(true);
    try {
      for (const file of Array.from(files)) {
        const isImg = asImage || isImageFile(file);
        if (isImg) {
          // Same fast process as task creation: generate thumb + optimized client-side, upload both
          const tempImage = await createTempImage(file);
          const uuid = crypto.randomUUID();
          const basePath = `org/${orgId}/assets/pending/${uuid}`;
          const thumbPath = `${basePath}/thumb.webp`;
          const optPath = `${basePath}/optimized.webp`;
          const { error: thumbError } = await supabase.storage
            .from("task-images")
            .upload(thumbPath, tempImage.thumbnail_blob, { contentType: "image/webp", cacheControl: "31536000" });
          if (thumbError) throw thumbError;
          const { error: optError } = await supabase.storage
            .from("task-images")
            .upload(optPath, tempImage.optimized_blob, { contentType: "image/webp", cacheControl: "31536000" });
          if (optError) throw optError;
          const { data: thumbUrl } = supabase.storage.from("task-images").getPublicUrl(thumbPath);
          const { data: optUrl } = supabase.storage.from("task-images").getPublicUrl(optPath);
          cleanupTempImage(tempImage);
          setPendingFiles((prev) => [
            ...prev,
            {
              id: uuid,
              file_url: optUrl.publicUrl,
              thumbnail_url: thumbUrl.publicUrl,
              file_type: "photo",
              displayName: file.name,
              isImage: true,
            },
          ]);
        } else {
          const ext = file.name.split(".").pop() || "bin";
          const path = `org/${orgId}/assets/pending/${crypto.randomUUID()}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("task-images")
            .upload(path, file, { cacheControl: "3600", upsert: false });
          if (uploadError) throw uploadError;
          const { data: urlData } = supabase.storage.from("task-images").getPublicUrl(path);
          setPendingFiles((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              file_url: urlData.publicUrl,
              file_type: file.type || ext,
              displayName: file.name,
              isImage: false,
            },
          ]);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploadingFile(false);
      e.target.value = "";
    }
  };

  const removePendingFile = (id: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const toggleStatusFilter = (value: string) => {
    setStatusFilters((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleSave = async () => {
    if (!orgId || !propertyId) {
      toast.error("Please select a property");
      return;
    }
    if (!name.trim()) {
      toast.error("Please enter an asset name");
      return;
    }

    setIsSaving(true);
    try {
      const { data: newAsset, error: insertError } = await supabase
        .from("assets")
        .insert({
          org_id: orgId,
          property_id: propertyId,
          space_id: spaceId && spaceId !== "none" ? spaceId : null,
          name: name.trim(),
          asset_type: type || null,
          serial_number: serial.trim() || null,
          condition_score: conditionScore ? parseInt(conditionScore, 10) : 100,
          status: "active",
          icon_name: iconName || "box",
          metadata: { icon_color_hex: iconColor } as Json,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;
      if (!newAsset?.id) throw new Error("Asset created but no ID returned");

      if (pendingFiles.length > 0) {
        const linkErrors: string[] = [];
        for (const f of pendingFiles) {
          const { error: fileErr } = await supabase.from("asset_files").insert({
            asset_id: newAsset.id,
            file_url: f.file_url,
            thumbnail_url: f.thumbnail_url || null,
            file_type: f.file_type,
          });
          if (fileErr) {
            console.error("Failed to link asset file:", fileErr);
            linkErrors.push(fileErr.message);
          }
        }
        if (linkErrors.length > 0) {
          throw new Error(`Asset created but photo link failed: ${linkErrors[0]}`);
        }
      }

      const celebrated = markQuickWinComplete("asset", propertyId);
      if (!celebrated) toast.success("Asset added successfully");
      setIsDialogOpen(false);
      setName("");
      setType("");
      setSerial("");
      setPropertyId(filterPropertyId || "");
      setSpaceId("none");
      setConditionScore("100");
      setIconName("");
      setIconColor(defaultColorForAssetType(null));
      setPendingFiles([]);
      await invalidateAssetQueries(queryClient);
      openAsset(newAsset.id);
    } catch (err: unknown) {
      console.error("Error saving asset:", err);
      toast.error(err instanceof Error ? err.message : "Failed to save asset");
    } finally {
      setIsSaving(false);
    }
  };

  // Client-side filtering
  const filteredAssets = useMemo(() => {
    let list = assets as AssetViewRow[];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (a) =>
          (a.name?.toLowerCase().includes(q)) ||
          (a.serial_number?.toLowerCase().includes(q)) ||
          (a.manufacturer?.toLowerCase().includes(q)) ||
          (a.model?.toLowerCase().includes(q))
      );
    }
    if (filterPropertyId) {
      list = list.filter((a) => a.property_id === filterPropertyId);
    }
    if (filterSpaceId) {
      list = list.filter((a) => a.space_id === filterSpaceId);
    }
    if (statusFilters.length > 0) {
      list = list.filter((a) => statusFilters.includes(a.status || "active"));
    }
    if (complianceOnly) {
      list = list.filter(
        (a) => a.compliance_required === true && (a.condition_score ?? 100) < 60
      );
    }
    if (needsInspectionOnly) {
      list = list.filter((a) => (a.condition_score ?? 100) < 60);
    }
    if (attentionIssuesOnly) {
      list = list.filter((a) => {
        const active = (a.status || "active") === "active";
        if (!active) return false;
        const score = a.condition_score ?? 100;
        const openTasks = a.open_tasks_count ?? 0;
        return score < 60 || openTasks > 0;
      });
    }
    return list;
  }, [
    assets,
    searchQuery,
    filterPropertyId,
    filterSpaceId,
    statusFilters,
    complianceOnly,
    needsInspectionOnly,
    attentionIssuesOnly,
  ]);

  const contextAssets = useMemo(() => {
    const list = assets as AssetViewRow[];
    if (!filterPropertyId) return list;
    return list.filter((a) => a.property_id === filterPropertyId);
  }, [assets, filterPropertyId]);

  const assetsWithIssuesCount = useMemo(() => {
    return contextAssets.filter((a) => {
      const active = (a.status || "active") === "active";
      if (!active) return false;
      const score = a.condition_score ?? 100;
      const openTasks = a.open_tasks_count ?? 0;
      return score < 60 || openTasks > 0;
    }).length;
  }, [contextAssets]);

  useEffect(() => {
    if (searchParams.get("attention") === "1") return;
    if (assetsWithIssuesCount === 0) {
      setAssetsWorkTab("groups");
    }
  }, [searchParams, assetsWithIssuesCount]);

  const assetsIssuesRequested = searchParams.get("attention") === "1";
  const showAssetsOperationalView = assetsWithIssuesCount > 0 || assetsIssuesRequested;

  const assetsForIssuesList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return contextAssets.filter((a) => {
      const active = (a.status || "active") === "active";
      if (!active) return false;
      const score = a.condition_score ?? 100;
      const openTasks = a.open_tasks_count ?? 0;
      if (score >= 60 && openTasks === 0) return false;
      if (q && !(a.name ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [contextAssets, searchQuery]);

  /** Standard 3-cell activity-area health stats. */
  const assetsHealthCounts = useMemo(() => {
    const total = contextAssets.length;
    const active = contextAssets.filter(
      (a) => (a.status || "active") === "active"
    ).length;
    const needsInspection = contextAssets.filter(
      (a) => (a.condition_score ?? 100) < 60 && (a.status || "active") === "active"
    ).length;
    const nonCompliant = contextAssets.filter(
      (a) => a.compliance_required && (a.condition_score ?? 100) < 60
    ).length;
    return {
      active,
      needsInspection,
      nonCompliant,
      inactive: Math.max(0, total - active),
      healthyActive: Math.max(0, active - needsInspection),
    };
  }, [contextAssets]);

  /** Matches left-column metric tile to current filters (same grammar as attention chips). */
  const assetsSummaryHighlightedFilter = useMemo(():
    | "active"
    | "needsInspection"
    | "nonCompliant"
    | "retired"
    | undefined => {
    if (needsInspectionOnly) return "needsInspection";
    if (complianceOnly) return "nonCompliant";
    if (statusFilters.length === 1 && statusFilters[0] === "retired") return "retired";
    if (statusFilters.length === 1 && statusFilters[0] === "active") return "active";
    return undefined;
  }, [needsInspectionOnly, complianceOnly, statusFilters]);

  const propertyMap = useMemo(() => {
    const map = new Map(properties.map((p) => [p.id, p.address]));
    assets.forEach((asset: AssetViewRow) => {
      if (asset.property_id && asset.property_address && !map.has(asset.property_id)) {
        map.set(asset.property_id, asset.property_address);
      }
    });
    return map;
  }, [properties, assets]);
  const propertyObjMap = useMemo(() => new Map(properties.map((p: any) => [p.id, p])), [properties]);
  const spaceMap = new Map(filterSpaces.map((s) => [s.id, s.name]));

  const filteredAssetIds = useMemo(
    () => filteredAssets.filter((a) => a.id).map((a) => a.id!),
    [filteredAssets]
  );
  const { imageMap } = useAssetFilesForAssets(filteredAssetIds);

  const clearRailForm = useCallback(() => {
    setName("");
    setType("");
    setSerial("");
    setSpaceId("none");
    setConditionScore("100");
    setIconName("");
    setIconColor(defaultColorForAssetType(null));
    setPendingFiles([]);
    setPropertyId(filterPropertyId || "");
  }, [filterPropertyId]);

  const addAssetFormProps = {
    imageInputRef,
    fileInputRef,
    isUploadingFile,
    onFileSelect: handleFileSelect,
    pendingFiles,
    onRemoveFile: removePendingFile,
    name,
    onNameChange: setName,
    type,
    onTypeChange: setType,
    serial,
    onSerialChange: setSerial,
    propertyId,
    onPropertyChange: handlePropertyChange,
    properties,
    spaceId,
    onSpaceChange: setSpaceId,
    formSpaces,
    conditionScore,
    onConditionScoreChange: setConditionScore,
    iconName,
    onIconChange: setIconName,
    iconColor,
    onIconColorChange: setIconColor,
    isSaving,
    onSave: handleSave,
    lockProperty: isPropertyScoped,
  };

  const applyAssetMetricFilter = useCallback((filter: AssetMetricKey) => {
    if (filter === "active") {
      setStatusFilters(["active"]);
      setComplianceOnly(false);
      setNeedsInspectionOnly(false);
      setAssetsWorkTab("groups");
    }
    if (filter === "retired") {
      setStatusFilters(["retired"]);
      setComplianceOnly(false);
      setNeedsInspectionOnly(false);
    }
    if (filter === "needsInspection") {
      setStatusFilters(["active"]);
      setComplianceOnly(false);
      setNeedsInspectionOnly(true);
      setAssetsWorkTab("issues");
    }
    if (filter === "nonCompliant") {
      setStatusFilters(["active"]);
      setComplianceOnly(true);
      setNeedsInspectionOnly(false);
    }
  }, []);

  const assetsHealthStats = useMemo(
    () => [
      {
        line1: "active",
        line2: "assets",
        value: assetsHealthCounts.active,
        color: "rgba(16, 185, 129, 1)",
        secondaryCount: assetsHealthCounts.inactive,
        secondaryLabel: "OFF",
        secondaryTone: "neutral" as const,
        onClick: () => applyAssetMetricFilter("active"),
        selected: assetsSummaryHighlightedFilter === "active",
      },
      {
        line1: "needs",
        line2: "inspect",
        value: assetsHealthCounts.needsInspection,
        color: "rgba(255, 184, 77, 1)",
        secondaryCount: assetsHealthCounts.nonCompliant,
        secondaryLabel: "RISK",
        secondaryTone: (assetsHealthCounts.nonCompliant > 0 ? "urgent" : "neutral") as const,
        onClick: () => applyAssetMetricFilter("needsInspection"),
        selected: assetsSummaryHighlightedFilter === "needsInspection",
      },
      {
        line1: "non",
        line2: "comp",
        value: assetsHealthCounts.nonCompliant,
        color: "rgba(235, 104, 52, 1)",
        secondaryCount: assetsHealthCounts.healthyActive,
        secondaryLabel: "OK",
        secondaryTone: "neutral" as const,
        onClick: () => applyAssetMetricFilter("nonCompliant"),
        selected: assetsSummaryHighlightedFilter === "nonCompliant",
      },
    ],
    [assetsHealthCounts, applyAssetMetricFilter, assetsSummaryHighlightedFilter]
  );

  const scopedSubtitleLine =
    (scopedPropertyForChrome as { nickname?: string | null; address?: string } | undefined)?.nickname ||
    (scopedPropertyForChrome as { address?: string } | undefined)?.address;

  const wideWorkColumnSubtitle = useMemo(
    () =>
      scopedSubtitleLine
        ? `${scopedSubtitleLine} · ${filteredAssets.length} of ${assets.length} ${assets.length === 1 ? "asset" : "assets"}`
        : `${filteredAssets.length} of ${assets.length} ${assets.length === 1 ? "asset" : "assets"}`,
    [scopedSubtitleLine, filteredAssets.length, assets.length]
  );

  const wideScopedLoadingSubtitle = scopedSubtitleLine
    ? `${scopedSubtitleLine} · Loading…`
    : "Loading assets…";

  if (loading) {
    return (
      <AssetsPageChrome accentColor={propertyHeaderAccent}>
        <PropertyWorkspaceLayout
          pageTitle="Assets"
          pageSubtitle={
            isPropertyScoped
              ? wideScopedLoadingSubtitle
              : "Equipment, plant, and fixtures you maintain."
          }
          pageIllustrationSrc={ASSETS_ILLUSTRATION}
          contextColumn={null}
          workColumn={<LoadingState message="Loading assets…" />}
          actionColumn={null}
        />
      </AssetsPageChrome>
    );
  }

  if (error) {
    return (
      <AssetsPageChrome accentColor={propertyHeaderAccent}>
        <PropertyWorkspaceLayout
          pageTitle="Assets"
          pageSubtitle={
            isPropertyScoped
              ? scopedSubtitleLine ?? "Something went wrong while loading assets"
              : "Equipment, plant, and fixtures you maintain."
          }
          pageIllustrationSrc={ASSETS_ILLUSTRATION}
          contextColumn={null}
          workColumn={
            <ErrorState
              message={error?.message || String(error)}
              onRetry={() => queryClient.invalidateQueries({ queryKey: ["assets"] })}
            />
          }
          actionColumn={null}
        />
      </AssetsPageChrome>
    );
  }

  const mainInner = (
    <>
      {!isWide && (
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) setPendingFiles([]);
          }}
        >
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <AddAssetWorkspaceForm
              variant="dialog"
              {...addAssetFormProps}
              onCancel={() => setIsDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}

        <PropertyWorkspaceLayout
          pageTitle="Assets"
          pageSubtitle={
            isPropertyScoped
              ? wideWorkColumnSubtitle
              : "Equipment, plant, and fixtures you maintain."
          }
          pageIllustrationSrc={ASSETS_ILLUSTRATION}
          contextColumn={
            isPropertyScoped && effectiveScopeId ? (
              <div className="space-y-4">
                <WorkspaceHealthGrid stats={assetsHealthStats} ariaLabel="Asset health" />
                <div className="perforation-section pointer-events-none" aria-hidden />
                <div className="flex flex-col overflow-hidden">
                  <PropertyRecentAssetsList
                    propertyId={effectiveScopeId}
                    onAssetClick={openAsset}
                  />
                </div>
              </div>
            ) : (
              <>
                <WorkspaceHealthGrid stats={assetsHealthStats} ariaLabel="Asset health" />
                <div className="perforation-section pointer-events-none" aria-hidden />
              </>
            )
          }
          workColumn={
            isPropertyScoped && effectiveScopeId ? (
              <div className="space-y-5">
                {showAssetsOperationalView ? (
                  <div>
                    <WorkspaceSectionHeading>Operational view</WorkspaceSectionHeading>
                    <WorkspaceTabList>
                      <WorkspaceTabTrigger
                        selected={assetsWorkTab === "groups"}
                        onClick={() => setAssetsWorkTab("groups")}
                      >
                        By group
                      </WorkspaceTabTrigger>
                      <WorkspaceTabTrigger
                        selected={assetsWorkTab === "issues"}
                        onClick={() => setAssetsWorkTab("issues")}
                      >
                        With issues ({assetsWithIssuesCount})
                      </WorkspaceTabTrigger>
                    </WorkspaceTabList>
                  </div>
                ) : null}

                {showAssetsOperationalView && assetsWorkTab === "issues" ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Active assets with poor condition or open tasks — open an asset to work it in detail.
                    </p>
                    <ul className="space-y-2">
                      {assetsForIssuesList.map((a) => (
                        <li key={a.id}>
                          <button
                            type="button"
                            onClick={() => a.id && openAsset(a.id)}
                            className="w-full text-left rounded-lg px-3 py-2.5 bg-card/80 shadow-e1 text-sm font-medium hover:shadow-md transition-shadow"
                          >
                            {a.name || "Unnamed asset"}
                          </button>
                        </li>
                      ))}
                      {assetsForIssuesList.length === 0 && (
                        <p className="text-sm text-muted-foreground py-6">
                          {searchQuery.trim()
                            ? "No assets match your search."
                            : "No assets need attention."}
                        </p>
                      )}
                    </ul>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <PropertyAssetGroupCarousel
                      propertyId={effectiveScopeId}
                      assetFilter={searchQuery}
                      onViewAsset={openAsset}
                    />
                    <div className="border-t border-border/30 pt-5">
                      <AllAssetsDirectory
                        propertyId={effectiveScopeId}
                        assetFilter={searchQuery}
                        onAssetClick={openAsset}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-4 mb-6">
                  <div className="flex flex-wrap gap-3 items-center">
                    <Select
                      value={filterPropertyId || "all"}
                      onValueChange={(v) => {
                        setFilterPropertyId(v === "all" ? "" : v);
                        setFilterSpaceId("");
                      }}
                    >
                      <SelectTrigger className="input-neomorphic w-[180px]">
                        <SelectValue placeholder="Property" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All properties</SelectItem>
                        {properties.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.address}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {filterPropertyId && (
                      <Select
                        value={filterSpaceId || "all"}
                        onValueChange={(v) => setFilterSpaceId(v === "all" ? "" : v)}
                      >
                        <SelectTrigger className="input-neomorphic w-[160px]">
                          <SelectValue placeholder="Space" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All spaces</SelectItem>
                          {filterSpaces.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    {STATUS_FILTERS.map((s) => (
                      <FilterChip
                        key={s.value}
                        label={s.label}
                        selected={statusFilters.includes(s.value)}
                        onSelect={() => toggleStatusFilter(s.value)}
                      />
                    ))}
                    <FilterChip
                      label="Compliance"
                      selected={complianceOnly}
                      onSelect={() => setComplianceOnly((prev) => !prev)}
                    />
                  </div>
                </div>
                {assets.length === 0 ? (
                  <FrameworkEmptyState
                    icon={Package}
                    title="No assets yet"
                    description="Add your first asset to get started"
                    action={{ label: "Add Asset", onClick: openAddFlow }}
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredAssets
                      .filter((a) => a.id)
                      .map((asset) => (
                        <AssetCard
                          key={asset.id!}
                          asset={asset}
                          propertyName={propertyMap.get(asset.property_id ?? "")}
                          property={asset.property_id ? propertyObjMap.get(asset.property_id) : null}
                          spaceName={asset.space_id ? spaceMap.get(asset.space_id) : undefined}
                          imageUrl={imageMap.get(asset.id!)}
                          onClick={() => openAsset(asset.id!)}
                        />
                      ))}
                    {filteredAssets.length === 0 && assets.length > 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8 col-span-full">
                        No assets match your filters.
                      </p>
                    )}
                  </div>
                )}
              </>
            )
          }
          actionColumn={
            <div ref={railFormRef} className="space-y-4 scroll-mt-6">
              <WorkspaceSurfaceCard>
                <AddAssetWorkspaceForm
                  variant="rail"
                  {...addAssetFormProps}
                  onRailReset={clearRailForm}
                />
              </WorkspaceSurfaceCard>
              <div className="px-0.5">
                <p className="mb-1.5 text-2xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Tasks on assets
                </p>
                <AssetLinkedTasksList
                  assetIds={
                    isPropertyScoped
                      ? contextAssets.filter((a) => a.id).map((a) => a.id!)
                      : filteredAssetIds
                  }
                  onOpenAsset={openAsset}
                />
              </div>
              {showActivityTabs ? <ManageTagsPanel surface="assets" /> : null}
            </div>
          }
        />

      {selectedAssetId && (
        <AssetDetailPanel
          assetId={selectedAssetId}
          onClose={() => openAsset(null)}
          onOpenAsset={openAsset}
          siblingAssetIds={
            isPropertyScoped && assetsWorkTab === "issues"
              ? assetsForIssuesList.filter((a) => a.id).map((a) => a.id!)
              : filteredAssetIds
          }
        />
      )}
    </>
  );

  return (
    <AssetsPageChrome accentColor={propertyHeaderAccent}>{mainInner}</AssetsPageChrome>
  );
};

export default function AssetsPage() {
  return (
    <WorkbenchControlsProvider defaultPropertyId="all" initialFilters={new Set()}>
      <Assets />
    </WorkbenchControlsProvider>
  );
}
