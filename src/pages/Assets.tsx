import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAssetsQuery } from "@/hooks/useAssetsQuery";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useAssetFilesForAssets } from "@/hooks/useAssetFilesForAssets";
import { useQueryClient } from "@tanstack/react-query";
import { useSpaces } from "@/hooks/useSpaces";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { AssetCard } from "@/components/assets/AssetCard";
import { AssetDetailPanel } from "@/components/assets/AssetDetailPanel";
import { AssetsSummaryRow } from "@/components/assets/AssetsSummaryRow";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Package, Plus, Search, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createTempImage, cleanupTempImage } from "@/utils/image-optimization";
import { StandardPage } from "@/components/design-system/StandardPage";
import { StandardPageWithBack } from "@/components/design-system/StandardPageWithBack";
import { propertyHubPath } from "@/lib/propertyRoutes";
import { NeomorphicButton } from "@/components/design-system/NeomorphicButton";
import { NeomorphicInput } from "@/components/design-system/NeomorphicInput";
import { FrameworkEmptyState } from "@/components/property-framework";
import { LoadingState } from "@/components/design-system/LoadingState";
import { ErrorState } from "@/components/design-system/ErrorState";
import { FilterChip } from "@/components/chips/filter";
import { PropertyWorkspaceLayout, WorkspaceSurfaceCard } from "@/components/property-workspace";
import { PropertyPageScopeBar } from "@/components/properties/PropertyPageScopeBar";
import { AddAssetWorkspaceForm } from "@/components/assets/AddAssetWorkspaceForm";
import type { Tables } from "@/integrations/supabase/types";

type AssetViewRow = Tables<"assets_view">;

const STATUS_FILTERS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "retired", label: "Retired" },
];

const WORKSPACE_WIDE_MQ = "(min-width: 1100px)";

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
  const [searchParams] = useSearchParams();
  const { data: assets = [], isLoading: loading, error } = useAssetsQuery();
  const { data: properties = [] } = usePropertiesQuery();
  const queryClient = useQueryClient();
  const { orgId } = useActiveOrg();
  const [filterPropertyId, setFilterPropertyId] = useState<string>("");
  const [filterSpaceId, setFilterSpaceId] = useState<string>("");
  const [propertyId, setPropertyId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [complianceOnly, setComplianceOnly] = useState(false);
  const [needsInspectionOnly, setNeedsInspectionOnly] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isWide = useWorkspaceWide();
  const railFormRef = useRef<HTMLDivElement>(null);

  const propertyFromUrl = searchParams.get("property") ?? "";
  const effectiveScopeId = propertyFromUrl || filterPropertyId;
  const scopedPropertyForChrome = useMemo(
    () => properties.find((p: { id: string }) => p.id === effectiveScopeId),
    [properties, effectiveScopeId]
  );
  const isPropertyScoped = Boolean(effectiveScopeId);
  const propertyHeaderAccent =
    (scopedPropertyForChrome as { icon_color_hex?: string | null } | undefined)?.icon_color_hex?.trim() ||
    "#8EC9CE";

  const assetsScopeBelowRow =
    isPropertyScoped && effectiveScopeId ? (
      <PropertyPageScopeBar
        propertyId={effectiveScopeId}
        hrefForProperty={(pid) => `/assets?property=${encodeURIComponent(pid)}`}
        hrefForAll="/assets"
        onBack={() => navigate(propertyHubPath(effectiveScopeId))}
      />
    ) : null;

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
    const next = propertyParam
      ? `/assets?property=${encodeURIComponent(propertyParam)}`
      : "/assets";
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
        })
        .select("id")
        .single();

      if (insertError) throw insertError;
      if (!newAsset?.id) throw new Error("Asset created but no ID returned");

      for (const f of pendingFiles) {
        const { error: fileErr } = await supabase.from("asset_files").insert({
          asset_id: newAsset.id,
          file_url: f.file_url,
          thumbnail_url: f.thumbnail_url || null,
          file_type: f.file_type,
        });
        if (fileErr) console.warn("Failed to link file:", fileErr);
      }

      toast.success("Asset added successfully");
      setIsDialogOpen(false);
      setName("");
      setType("");
      setSerial("");
      setPropertyId(filterPropertyId || "");
      setSpaceId("none");
      setConditionScore("100");
      setIconName("");
      setPendingFiles([]);
      queryClient.invalidateQueries({ queryKey: ["assets"] });
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
      list = list.filter((a) => a.compliance_required === true);
    }
    if (needsInspectionOnly) {
      list = list.filter((a) => (a.condition_score ?? 100) < 60);
    }
    return list;
  }, [assets, searchQuery, filterPropertyId, filterSpaceId, statusFilters, complianceOnly, needsInspectionOnly]);

  const contextAssets = useMemo(() => {
    const list = assets as AssetViewRow[];
    if (!filterPropertyId) return list;
    return list.filter((a) => a.property_id === filterPropertyId);
  }, [assets, filterPropertyId]);

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
    isSaving,
    onSave: handleSave,
  };

  const scopedSubtitleLine =
    (scopedPropertyForChrome as { nickname?: string | null; address?: string } | undefined)?.nickname ||
    (scopedPropertyForChrome as { address?: string } | undefined)?.address;

  const addAction = (
    <NeomorphicButton
      onClick={openAddFlow}
      className={
        isPropertyScoped
          ? "border-white/35 bg-white/10 text-white shadow-none hover:bg-white/20 hover:text-white"
          : undefined
      }
    >
      <Plus className="h-4 w-4 mr-2" />
      Add
    </NeomorphicButton>
  );

  if (loading) {
    if (isPropertyScoped) {
      return (
        <StandardPageWithBack
          title="Property Assets"
          subtitle={scopedSubtitleLine}
          backTo={propertyHubPath(effectiveScopeId)}
          headerAccentColor={propertyHeaderAccent}
          icon={<Package className="h-6 w-6" />}
          maxWidth="full"
          contentClassName="max-w-[1480px]"
          hideHeaderBack
          belowGradientRow={assetsScopeBelowRow}
        >
          <LoadingState message="Loading assets..." />
        </StandardPageWithBack>
      );
    }
    return (
      <StandardPage title="Assets" icon={<Package className="h-6 w-6" />} maxWidth="md">
        <LoadingState message="Loading assets..." />
      </StandardPage>
    );
  }

  if (error) {
    if (isPropertyScoped) {
      return (
        <StandardPageWithBack
          title="Property Assets"
          subtitle={scopedSubtitleLine}
          backTo={propertyHubPath(effectiveScopeId)}
          headerAccentColor={propertyHeaderAccent}
          icon={<Package className="h-6 w-6" />}
          maxWidth="full"
          contentClassName="max-w-[1480px]"
          hideHeaderBack
          belowGradientRow={assetsScopeBelowRow}
        >
          <ErrorState
            message={error?.message || String(error)}
            onRetry={() => queryClient.invalidateQueries({ queryKey: ["assets"] })}
          />
        </StandardPageWithBack>
      );
    }
    return (
      <StandardPage title="Assets" icon={<Package className="h-6 w-6" />} maxWidth="md">
        <ErrorState
          message={error?.message || String(error)}
          onRetry={() => queryClient.invalidateQueries({ queryKey: ["assets"] })}
        />
      </StandardPage>
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

      {isWide ? (
        <PropertyWorkspaceLayout
          contextColumn={
            <AssetsSummaryRow
              assets={contextAssets}
              onFilterClick={(filter) => {
                if (filter === "active") {
                  setStatusFilters([]);
                  setComplianceOnly(false);
                  setNeedsInspectionOnly(false);
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
                }
                if (filter === "nonCompliant") {
                  setStatusFilters(["active"]);
                  setComplianceOnly(true);
                  setNeedsInspectionOnly(false);
                }
              }}
            />
          }
          workColumn={
            <>
              <div className="space-y-4 mb-6">
                <div className="flex flex-wrap gap-3 items-center">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <NeomorphicInput
                      placeholder="Search name, serial, manufacturer, model..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
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
                        onClick={() => setSelectedAssetId(asset.id!)}
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
              <WorkspaceSurfaceCard title="AI assist" description="Upload a photo to suggest type and icon when you add an asset.">
                <p className="text-xs text-muted-foreground flex items-start gap-2">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
                  Use images in the add flow — Filla can infer likely asset types from your org library.
                </p>
              </WorkspaceSurfaceCard>
            </div>
          }
        />
      ) : (
      <div className="flex flex-col gap-6">
      {/* Health Snapshot Row - Framework V2 */}
      <AssetsSummaryRow
        assets={assets as AssetViewRow[]}
        onFilterClick={(filter) => {
          if (filter === "active") {
            setStatusFilters([]);
            setComplianceOnly(false);
            setNeedsInspectionOnly(false);
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
          }
          if (filter === "nonCompliant") {
            setStatusFilters(["active"]);
            setComplianceOnly(true);
            setNeedsInspectionOnly(false);
          }
        }}
      />

      {/* Filters row */}
      <div className="space-y-4 mb-6 pt-5">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <NeomorphicInput
              placeholder="Search name, serial, manufacturer, model..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterPropertyId || "all"} onValueChange={(v) => (setFilterPropertyId(v === "all" ? "" : v), setFilterSpaceId(""))}>
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
            <Select value={filterSpaceId || "all"} onValueChange={(v) => setFilterSpaceId(v === "all" ? "" : v)}>
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
                onClick={() => setSelectedAssetId(asset.id!)}
              />
            ))}
          {filteredAssets.length === 0 && assets.length > 0 && (
            <p className="text-sm text-muted-foreground text-center py-8 col-span-full">No assets match your filters.</p>
          )}
        </div>
      )}

      </div>
      )}

      {selectedAssetId && (
        <AssetDetailPanel
          assetId={selectedAssetId}
          onClose={() => setSelectedAssetId(null)}
        />
      )}
    </>
  );

  if (isPropertyScoped) {
    return (
      <StandardPageWithBack
        title="Property Assets"
        subtitle={
          scopedSubtitleLine
            ? `${scopedSubtitleLine} · ${filteredAssets.length} of ${assets.length} ${assets.length === 1 ? "asset" : "assets"}`
            : `${filteredAssets.length} of ${assets.length} ${assets.length === 1 ? "asset" : "assets"}`
        }
        backTo={propertyHubPath(effectiveScopeId)}
        headerAccentColor={propertyHeaderAccent}
        icon={<Package className="h-6 w-6" />}
        action={addAction}
        maxWidth="full"
        contentClassName="max-w-[1480px]"
        hideHeaderBack
        belowGradientRow={assetsScopeBelowRow}
      >
        {mainInner}
      </StandardPageWithBack>
    );
  }

  return (
    <StandardPage
      title="Assets"
      subtitle={`${filteredAssets.length} of ${assets.length} ${assets.length === 1 ? "asset" : "assets"}`}
      icon={<Package className="h-6 w-6" />}
      action={addAction}
      maxWidth="full"
      contentClassName="max-w-[1480px]"
    >
      {mainInner}
    </StandardPage>
  );
};

export default Assets;
