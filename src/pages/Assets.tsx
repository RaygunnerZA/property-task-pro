import React, { useState, useEffect, useMemo, useRef } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Package, Plus, Search, ImagePlus, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createTempImage, cleanupTempImage } from "@/utils/image-optimization";
import { StandardPage } from "@/components/design-system/StandardPage";
import { NeomorphicButton } from "@/components/design-system/NeomorphicButton";
import { NeomorphicInput } from "@/components/design-system/NeomorphicInput";
import { FrameworkEmptyState } from "@/components/property-framework";
import { LoadingState } from "@/components/design-system/LoadingState";
import { ErrorState } from "@/components/design-system/ErrorState";
import { FilterChip } from "@/components/chips/filter";
import { AIIconColorPicker } from "@/components/ui/AIIconColorPicker";
import type { Tables } from "@/integrations/supabase/types";

type AssetViewRow = Tables<"assets_view">;

const ASSET_TYPES = ["Boiler", "Appliance", "Vehicle", "HVAC", "Plumbing", "Electrical", "Other"];
const STATUS_FILTERS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "retired", label: "Retired" },
];

const Assets = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: assets = [], isLoading: loading, error } = useAssetsQuery();
  const { data: properties = [] } = usePropertiesQuery();
  const queryClient = useQueryClient();
  const { orgId } = useActiveOrg();
  const [filterPropertyId, setFilterPropertyId] = useState<string>("");
  const [filterSpaceId, setFilterSpaceId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [complianceOnly, setComplianceOnly] = useState(false);
  const [needsInspectionOnly, setNeedsInspectionOnly] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { spaces } = useSpaces(filterPropertyId || undefined);

  // Check for ?add=true in URL to open dialog (preserve ?property= when present)
  useEffect(() => {
    if (searchParams.get("add") === "true") {
      setIsDialogOpen(true);
      const propertyParam = searchParams.get("property");
      const next = propertyParam
        ? `/assets?property=${encodeURIComponent(propertyParam)}`
        : "/assets";
      navigate(next, { replace: true });
    }
  }, [searchParams, navigate]);

  // Pre-filter by property when navigating from property context (?property=id)
  useEffect(() => {
    const propertyParam = searchParams.get("property");
    if (propertyParam) {
      setFilterPropertyId(propertyParam);
    }
  }, [searchParams]);

  // Form state for create
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [serial, setSerial] = useState("");
  const [propertyId, setPropertyId] = useState("");
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
      setPropertyId("");
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
  const spaceMap = new Map(spaces.map((s) => [s.id, s.name]));

  const filteredAssetIds = useMemo(
    () => filteredAssets.filter((a) => a.id).map((a) => a.id!),
    [filteredAssets]
  );
  const { imageMap } = useAssetFilesForAssets(filteredAssetIds);

  if (loading) {
    return (
      <StandardPage title="Assets" icon={<Package className="h-6 w-6" />} maxWidth="md">
        <LoadingState message="Loading assets..." />
      </StandardPage>
    );
  }

  if (error) {
    return (
      <StandardPage title="Assets" icon={<Package className="h-6 w-6" />} maxWidth="md">
        <ErrorState
          message={error?.message || String(error)}
          onRetry={() => queryClient.invalidateQueries({ queryKey: ["assets"] })}
        />
      </StandardPage>
    );
  }

  return (
    <StandardPage
      title="Assets"
      subtitle={`${filteredAssets.length} of ${assets.length} ${assets.length === 1 ? "asset" : "assets"}`}
      icon={<Package className="h-6 w-6" />}
      action={
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) setPendingFiles([]);
          }}
        >
          <DialogTrigger asChild>
            <NeomorphicButton>
              <Plus className="h-4 w-4 mr-2" />
              Add
            </NeomorphicButton>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <DialogTitle>Add Asset</DialogTitle>
                  <DialogDescription>Register a new asset in your property registry</DialogDescription>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e, true)}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    onChange={(e) => handleFileSelect(e, false)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="btn-neomorphic h-8 px-3"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={isUploadingFile}
                  >
                    <ImagePlus className="h-4 w-4 mr-1.5" />
                    Add Image
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="btn-neomorphic h-8 px-3"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingFile}
                  >
                    <Upload className="h-4 w-4 mr-1.5" />
                    Upload
                  </Button>
                </div>
              </div>
              {pendingFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {pendingFiles.map((f) => (
                    <div
                      key={f.id}
                      className="relative group rounded-lg overflow-hidden bg-muted/50 border border-border/50"
                    >
                      {f.isImage ? (
                        <img
                          src={f.thumbnail_url || f.file_url}
                          alt={f.displayName}
                          className="w-14 h-14 object-cover"
                        />
                      ) : (
                        <div className="w-14 h-14 flex items-center justify-center p-1">
                          <span className="text-[10px] text-muted-foreground truncate text-center">
                            {f.displayName}
                          </span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removePendingFile(f.id)}
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        aria-label="Remove"
                      >
                        <X className="h-5 w-5 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <NeomorphicInput
                  id="name"
                  placeholder="e.g., Main Boiler"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger id="type" className="input-neomorphic">
                    <SelectValue placeholder="Select asset type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_TYPES.map((assetType) => (
                      <SelectItem key={assetType} value={assetType}>
                        {assetType}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="serial">Serial Number</Label>
                <NeomorphicInput
                  id="serial"
                  placeholder="e.g., ABC123456"
                  value={serial}
                  onChange={(e) => setSerial(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="property">Property *</Label>
                <Select value={propertyId} onValueChange={handlePropertyChange}>
                  <SelectTrigger id="property" className="input-neomorphic">
                    <SelectValue placeholder="Select a property" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.address}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {propertyId && (
                <div className="space-y-2">
                  <Label htmlFor="space">Space (Optional)</Label>
                  <Select value={spaceId || "none"} onValueChange={setSpaceId}>
                    <SelectTrigger id="space" className="input-neomorphic">
                      <SelectValue placeholder="Select a space (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {spaces.map((space) => (
                        <SelectItem key={space.id} value={space.id}>
                          {space.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="condition">Condition Score (0-100)</Label>
                <NeomorphicInput
                  id="condition"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="100"
                  value={conditionScore}
                  onChange={(e) => setConditionScore(e.target.value)}
                />
              </div>
              <AIIconColorPicker
                searchText={[name, type].filter(Boolean).join(" ").trim()}
                value={{ iconName, color: "#8EC9CE" }}
                onChange={(icon) => setIconName(icon)}
                defaultIcons={["package", "box", "wrench", "plug", "cpu"]}
                fallbackSearch="asset"
                disabled={isSaving}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving} className="input-neomorphic">
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving || !propertyId || !name.trim()} className="btn-accent-vibrant">
                {isSaving ? "Saving..." : "Save Asset"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
      maxWidth="md"
    >
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
                {spaces.map((s) => (
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
          action={{ label: "Add Asset", onClick: () => setIsDialogOpen(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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

      {selectedAssetId && (
        <AssetDetailPanel
          assetId={selectedAssetId}
          onClose={() => setSelectedAssetId(null)}
        />
      )}
    </StandardPage>
  );
};

export default Assets;
