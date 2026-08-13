/**
 * AssetDetailPanel — image-led identity, tight details + compliance, action bar.
 * Activity is a discrete footer link (same pattern as Task Detail).
 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { dialogContentClass } from "@/lib/layoutClasses";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NeomorphicInput } from "@/components/design-system/NeomorphicInput";
import { useAssetDetail } from "@/hooks/useAssetDetail";
import { useAssetInspections } from "@/hooks/useAssetInspections";
import { useAssetFiles } from "@/hooks/useAssetFiles";
import { useLinkedTasks } from "@/hooks/useLinkedTasks";
import { useAssetComplianceQuery } from "@/hooks/useAssetComplianceQuery";
import { useComplianceQuery } from "@/hooks/useComplianceQuery";
import { useBrainInference } from "@/hooks/useBrainInference";
import { useOrgSettings } from "@/hooks/useOrgSettings";
import { supabase } from "@/integrations/supabase/client";
import { createTempImage, cleanupTempImage } from "@/utils/image-optimization";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useRetireAssetMutation } from "@/hooks/mutations/useRetireAssetMutation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { IntakeModal } from "@/components/intake/IntakeModal";
import { useAssistantContext } from "@/contexts/AssistantContext";
import { AssetDetailHero } from "@/components/assets/AssetDetailHero";
import { AssetDetailActionBar } from "@/components/assets/AssetDetailActionBar";
import type { AssetFileRow } from "@/hooks/useAssetFiles";

const ASSET_TYPES = ["Boiler", "Appliance", "Vehicle", "HVAC", "Plumbing", "Electrical", "Other"];
const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "retired", label: "Retired" },
];

function isAssetImageFile(file: Pick<AssetFileRow, "file_url" | "file_type">): boolean {
  const t = (file.file_type || "").toLowerCase();
  if (t.startsWith("image/") || t === "photo" || t === "image") return true;
  const ext = file.file_url.split(".").pop()?.toLowerCase() || "";
  return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
}

interface AssetDetailPanelProps {
  assetId: string | null;
  onClose: () => void;
  onCreateTaskClick?: () => void;
}

function deriveInspectionIssueSignals(notes: string | null | undefined): {
  issue_present?: boolean;
  severity_bucket?: "low" | "medium" | "high" | "critical";
  confidence_bucket?: "low" | "medium" | "high";
} {
  const note = (notes || "").trim().toLowerCase();
  if (!note) return {};

  const uncertainTerms = ["maybe", "possibly", "might", "unclear", "unknown", "monitor"];
  const criticalTerms = ["critical", "urgent", "unsafe", "danger", "hazard", "fire", "electrical fault"];
  const highTerms = ["failed", "failure", "broken", "leak", "major", "severe", "non-compliant", "unsafe condition"];
  const mediumTerms = ["wear", "degrading", "service due", "attention", "repair", "fault", "issue"];
  const healthyTerms = ["ok", "good condition", "no issue", "stable", "pass", "passed"];

  const hasCritical = criticalTerms.some((t) => note.includes(t));
  const hasHigh = highTerms.some((t) => note.includes(t));
  const hasMedium = mediumTerms.some((t) => note.includes(t));
  const hasHealthy = healthyTerms.some((t) => note.includes(t));
  const hasUncertain = uncertainTerms.some((t) => note.includes(t));

  const issuePresent = hasCritical || hasHigh || hasMedium || (!hasHealthy && note.length > 8);
  if (!issuePresent) {
    return { issue_present: false, severity_bucket: "low", confidence_bucket: hasUncertain ? "low" : "medium" };
  }

  let severity: "low" | "medium" | "high" | "critical" = "low";
  if (hasCritical) severity = "critical";
  else if (hasHigh) severity = "high";
  else if (hasMedium) severity = "medium";

  let confidence: "low" | "medium" | "high" = "medium";
  if (hasUncertain) confidence = "low";
  else if (hasCritical || hasHigh) confidence = "high";

  return {
    issue_present: true,
    severity_bucket: severity,
    confidence_bucket: confidence,
  };
}

function deriveTrendDeltaBucket(scoresDesc: number[]): "improving_strong" | "improving" | "stable" | "worsening" | "worsening_strong" | undefined {
  if (scoresDesc.length < 2) return undefined;
  const delta = scoresDesc[0] - scoresDesc[1];
  if (delta >= 10) return "improving_strong";
  if (delta > 0) return "improving";
  if (delta <= -10) return "worsening_strong";
  if (delta < 0) return "worsening";
  return "stable";
}

export function AssetDetailPanel({ assetId, onClose, onCreateTaskClick }: AssetDetailPanelProps) {
  const { asset, loading, error, refresh } = useAssetDetail(assetId ?? undefined);
  const { inspections, loading: inspectionsLoading, refresh: refreshInspections } = useAssetInspections(assetId ?? undefined);
  const { files, loading: filesLoading, refresh: refreshFiles } = useAssetFiles(assetId ?? undefined);
  const { tasks, loading: tasksLoading, refresh: refreshTasks } = useLinkedTasks(assetId ?? undefined);
  const { data: linkedCompliance = [], isLoading: complianceLoading, refetch: refreshCompliance } = useAssetComplianceQuery(assetId ?? undefined);
  const { data: complianceOptions = [] } = useComplianceQuery();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { orgId } = useActiveOrg();
  const retireAssetMutation = useRetireAssetMutation();
  const { settings } = useOrgSettings();
  const automatedIntelligence = settings?.automated_intelligence ?? "suggestions_only";
  const latestInspectionSignals = useMemo(() => {
    const latest = inspections[0];
    const scoreSeries = inspections
      .map((i) => i.condition_score)
      .filter((s): s is number => typeof s === "number");
    return {
      ...deriveInspectionIssueSignals(latest?.notes),
      trend_delta_bucket: deriveTrendDeltaBucket(scoreSeries),
    };
  }, [inspections]);
  const assetVector = {
    asset_type: asset?.asset_type,
    condition_score: asset?.condition_score,
    install_date: (asset as { install_date?: string })?.install_date,
    ...latestInspectionSignals,
  };
  const { data: brainData } = useBrainInference(asset ? [assetVector] : [], [], automatedIntelligence !== "off");
  const brainPred = brainData?.predictions?.assets?.[0];
  const { openAssistant } = useAssistantContext();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activityFilter, setActivityFilter] = useState<"all" | "tasks" | "inspections" | "files">("all");
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [showLogInspection, setShowLogInspection] = useState(false);
  const [showAddFile, setShowAddFile] = useState(false);
  const [showLinkCompliance, setShowLinkCompliance] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const fileUploadInputRef = useRef<HTMLInputElement>(null);
  const imageUploadInputRef = useRef<HTMLInputElement>(null);

  // Editable Overview fields (local state)
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [conditionScore, setConditionScore] = useState<string>("100");
  const [status, setStatus] = useState("active");
  const [assetType, setAssetType] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [complianceRequired, setComplianceRequired] = useState(false);

  // Sync from asset
  useEffect(() => {
    if (asset) {
      setName(asset.name || "");
      setNotes(asset.notes || "");
      setConditionScore(String(asset.condition_score ?? 100));
      setStatus(asset.status || "active");
      setAssetType(asset.asset_type || "");
      setSerialNumber(asset.serial_number || "");
      setManufacturer(asset.manufacturer || "");
      setModel(asset.model || "");
      setComplianceRequired(asset.compliance_required ?? false);
    }
  }, [asset]);

  useEffect(() => {
    setSelectedImageIndex(0);
    setActivityExpanded(false);
  }, [assetId]);

  const imageFiles = useMemo(() => files.filter(isAssetImageFile), [files]);

  const saveAsset = useCallback(
    async (updates: Record<string, unknown>): Promise<boolean> => {
      if (!assetId || Object.keys(updates).length === 0) return false;
      try {
        const { data: updated, error: err } = await supabase
          .from("assets")
          .update(updates)
          .eq("id", assetId)
          .select("id")
          .single();
        if (err) throw err;
        if (!updated) throw new Error("Update did not affect any rows. You may not have permission.");
        await refresh();
        return true;
      } catch (e: unknown) {
        toast({
          title: "Couldn't update asset",
          description: e instanceof Error ? e.message : "Failed to save",
          variant: "destructive",
        });
        return false;
      }
    },
    [assetId, refresh, toast]
  );

  const handleDuplicate = useCallback(async () => {
    if (!asset || !orgId) return;
    setIsDuplicating(true);
    try {
      const { data: newAsset, error } = await supabase
        .from("assets")
        .insert({
          org_id: orgId,
          property_id: asset.property_id,
          space_id: asset.space_id,
          name: `${asset.name || "Unnamed Asset"} (Copy)`,
          asset_type: asset.asset_type || null,
          serial_number: null,
          condition_score: asset.condition_score ?? 100,
          status: "active",
          manufacturer: asset.manufacturer || null,
          model: asset.model || null,
          notes: asset.notes || null,
          compliance_required: asset.compliance_required ?? false,
        })
        .select("id")
        .single();
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      toast({ title: "Asset duplicated", description: "A copy has been created." });
      onClose();
    } catch (e: unknown) {
      toast({
        title: "Couldn't duplicate asset",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setIsDuplicating(false);
    }
  }, [asset, orgId, queryClient, toast, onClose]);

  const handleDelete = useCallback(async () => {
    if (!assetId) return;
    setIsDeleting(true);
    try {
      const { data, error } = await supabase
        .from("assets")
        .delete()
        .eq("id", assetId)
        .select("id");
      if (error) throw error;
      if (!data?.length) {
        throw new Error("Asset could not be deleted. You may not have permission.");
      }
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["asset-detail"] });
      toast({ title: "Asset deleted" });
      setShowDeleteDialog(false);
      onClose();
    } catch (e: unknown) {
      toast({
        title: "Couldn't delete asset",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }, [assetId, queryClient, toast, onClose]);

  const handleArchive = useCallback(() => {
    if (!assetId) return;
    setIsArchiving(true);
    retireAssetMutation.mutate(
      { assetId, orgId: orgId ?? undefined },
      {
        onSuccess: () => {
          refresh();
          toast({ title: "Asset archived", description: "Status set to retired." });
          setShowArchiveDialog(false);
          setIsArchiving(false);
        },
        onError: (e) => {
          toast({
            title: "Couldn't archive asset",
            description: e instanceof Error ? e.message : "Try again",
            variant: "destructive",
          });
          setIsArchiving(false);
        },
      }
    );
  }, [assetId, orgId, refresh, retireAssetMutation, toast]);

  const isImageFile = (file: File) => {
    const t = file.type?.toLowerCase() || "";
    return t.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp"].includes(file.name.split(".").pop()?.toLowerCase() || "");
  };

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length || !assetId || !orgId) return;
      setIsUploadingFile(true);
      try {
        for (const file of Array.from(files)) {
          if (isImageFile(file)) {
            const tempImage = await createTempImage(file);
            const uuid = crypto.randomUUID();
            const basePath = `org/${orgId}/assets/${assetId}/${uuid}`;
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
            const { error: insertErr } = await supabase.from("asset_files").insert({
              asset_id: assetId,
              file_url: optUrl.publicUrl,
              thumbnail_url: thumbUrl.publicUrl,
              file_type: "photo",
            });
            if (insertErr) throw insertErr;
          } else {
            const ext = file.name.split(".").pop() || "bin";
            const path = `org/${orgId}/assets/${assetId}/${crypto.randomUUID()}.${ext}`;
            const { error: uploadError } = await supabase.storage.from("task-images").upload(path, file, { cacheControl: "3600" });
            if (uploadError) throw uploadError;
            const { data: urlData } = supabase.storage.from("task-images").getPublicUrl(path);
            const { error: insertErr } = await supabase.from("asset_files").insert({
              asset_id: assetId,
              file_url: urlData.publicUrl,
              file_type: file.type || ext,
            });
            if (insertErr) throw insertErr;
          }
        }
        toast({ title: "File uploaded" });
        refreshFiles();
        queryClient.invalidateQueries({ queryKey: ["asset-files-for-list"] });
        queryClient.invalidateQueries({ queryKey: ["assets"] });
      } catch (err: unknown) {
        toast({
          title: "Upload failed",
          description: err instanceof Error ? err.message : "Try again",
          variant: "destructive",
        });
      } finally {
        setIsUploadingFile(false);
        e.target.value = "";
      }
    },
    [assetId, orgId, refreshFiles, queryClient, toast]
  );

  const handleSaveDetails = useCallback(async () => {
    if (!assetId || !asset) return;
    const updates: Record<string, unknown> = {};
    if (name !== (asset.name || "")) updates.name = name;
    if (notes !== (asset.notes || "")) updates.notes = notes;
    const score = parseInt(conditionScore, 10);
    if (!isNaN(score) && score !== (asset.condition_score ?? 100)) updates.condition_score = score;
    if (status !== (asset.status || "active")) updates.status = status;
    if (assetType !== (asset.asset_type || "")) updates.asset_type = assetType || null;
    if (serialNumber !== (asset.serial_number || "")) updates.serial_number = serialNumber || null;
    if (manufacturer !== (asset.manufacturer || "")) updates.manufacturer = manufacturer || null;
    if (model !== (asset.model || "")) updates.model = model || null;
    if (complianceRequired !== (asset.compliance_required ?? false)) updates.compliance_required = complianceRequired;
    if (Object.keys(updates).length === 0) {
      toast({ title: "No changes to save" });
      return;
    }
    setIsSavingDetails(true);
    try {
      const ok = await saveAsset(updates);
      if (ok) toast({ title: "Details saved" });
    } finally {
      setIsSavingDetails(false);
    }
  }, [assetId, asset, name, notes, conditionScore, status, assetType, serialNumber, manufacturer, model, complianceRequired, saveAsset, toast]);

  const imageCount = imageFiles.length;

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setLightboxOpen(false);
      } else if (e.key === "ArrowLeft" && imageCount > 1) {
        setSelectedImageIndex((i) => (i - 1 + imageCount) % imageCount);
      } else if (e.key === "ArrowRight" && imageCount > 1) {
        setSelectedImageIndex((i) => (i + 1) % imageCount);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, imageCount]);

  if (!assetId) return null;

  if (loading) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className={cn(dialogContentClass, "max-h-[90vh] overflow-hidden flex flex-col p-0")}>
          <DialogHeader className="sr-only">
            <DialogTitle>Loading Asset</DialogTitle>
          </DialogHeader>
          <div className="flex flex-1 p-6">
            <Skeleton className="h-32 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error || !asset) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className={cn(dialogContentClass, "max-h-[90vh] overflow-hidden flex flex-col p-0")}>
          <DialogHeader className="sr-only">
            <DialogTitle>Asset Error</DialogTitle>
          </DialogHeader>
          <div className="flex flex-1 p-6">
            <p className="text-destructive">{error || "Couldn't find this asset"}</p>
            <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const recommendedAction = brainPred?.recommended_action ?? null;
  const detailsDirty =
    name !== (asset.name || "") ||
    notes !== (asset.notes || "") ||
    status !== (asset.status || "active") ||
    assetType !== (asset.asset_type || "") ||
    serialNumber !== (asset.serial_number || "") ||
    manufacturer !== (asset.manufacturer || "") ||
    model !== (asset.model || "") ||
    complianceRequired !== (asset.compliance_required ?? false) ||
    (parseInt(conditionScore, 10) || 0) !== (asset.condition_score ?? 100);

  const heroImages = imageFiles.map((f) => ({
    id: f.id,
    src: f.thumbnail_url || f.file_url,
    heroSrc: f.file_url,
    alt: asset.name || "Asset photo",
  }));
  const safeImageIndex = selectedImageIndex < heroImages.length ? selectedImageIndex : 0;
  const statusTone =
    status === "active" ? "active" : status === "retired" ? "retired" : status === "inactive" ? "inactive" : "other";
  const nextDueDate = linkedCompliance
    .map((c) => (c as { next_due_date?: string }).next_due_date)
    .filter((d): d is string => Boolean(d))
    .sort()[0];
  const complianceStatus = linkedCompliance.some((c) => c.expiry_state === "expired")
    ? "Needs attention"
    : linkedCompliance.some((c) => c.expiry_state === "expiring")
      ? "Expiring soon"
      : linkedCompliance.length > 0
        ? "On track"
        : null;
  const isBusy = isDeleting || isArchiving || isDuplicating || isSavingDetails;

  return (
    <>
      <Dialog
        open={true}
        modal={!lightboxOpen && !showAddRecord}
        onOpenChange={(open) => {
          if (!open && lightboxOpen) {
            setLightboxOpen(false);
            return;
          }
          if (!open) onClose();
        }}
      >
        <DialogContent
          hideCloseButton
          className={cn(dialogContentClass, "max-h-[90vh] overflow-hidden flex flex-col p-0 bg-background bg-paper-texture")}
          onPointerDownOutside={(event) => {
            if (lightboxOpen || showAddRecord) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (lightboxOpen || showAddRecord) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (lightboxOpen) {
              event.preventDefault();
              setLightboxOpen(false);
            }
          }}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Asset Details</DialogTitle>
            <DialogDescription>View and edit asset details</DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background bg-paper-texture">
            <input ref={imageUploadInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFileUpload} />
            <input ref={fileUploadInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={handleFileUpload} />

            <div className="min-h-0 flex-1 overflow-y-auto">
              <AssetDetailHero
                title={asset.name || "Unnamed Asset"}
                images={heroImages}
                selectedIndex={safeImageIndex}
                onSelectImage={setSelectedImageIndex}
                onOpenImage={(index) => {
                  setSelectedImageIndex(index);
                  setLightboxOpen(true);
                }}
                onAddPhoto={() => imageUploadInputRef.current?.click()}
                onClose={onClose}
                statusLabel={(asset.status || "active").replace("_", " ")}
                statusTone={statusTone}
                conditionLabel={`Condition ${asset.condition_score ?? 100}`}
                typeLabel={asset.asset_type || null}
                contextLine={[asset.property_name, asset.space_name].filter(Boolean).join(" · ") || null}
                isUploading={isUploadingFile}
              />

              <div className="space-y-4 px-5 pb-4 pt-4">
                {recommendedAction ? (
                  <p className="text-caption leading-snug text-muted-foreground">
                    {recommendedAction}{" "}
                    <button
                      type="button"
                      onClick={() => setShowLogInspection(true)}
                      className="font-medium text-foreground underline-offset-2 hover:underline"
                    >
                      Log inspection
                    </button>
                  </p>
                ) : null}

                <section className="space-y-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">Details</h3>
                    {detailsDirty ? (
                      <Button
                        size="sm"
                        className="h-7 px-3 font-mono text-caption uppercase tracking-wide shadow-primary-btn"
                        onClick={handleSaveDetails}
                        disabled={isSavingDetails}
                      >
                        {isSavingDetails ? "Saving…" : "Save"}
                      </Button>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <Label className="text-xs">Name</Label>
                      <NeomorphicInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Asset name" className="h-8" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Type</Label>
                      <Select value={assetType || "none"} onValueChange={(v) => setAssetType(v === "none" ? "" : v)}>
                        <SelectTrigger className="input-neomorphic h-8"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {ASSET_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Status</Label>
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger className="input-neomorphic h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Condition</Label>
                      <NeomorphicInput type="number" min="0" max="100" value={conditionScore} onChange={(e) => setConditionScore(e.target.value)} className="h-8" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Serial</Label>
                      <NeomorphicInput value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder="e.g. ABC123" className="h-8" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Manufacturer</Label>
                      <NeomorphicInput value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder="Manufacturer" className="h-8" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Model</Label>
                      <NeomorphicInput value={model} onChange={(e) => setModel(e.target.value)} placeholder="Model" className="h-8" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Notes</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" className="input-neomorphic min-h-[52px] text-sm" rows={2} />
                  </div>
                </section>

                <section className="space-y-2 border-t border-border/20 pt-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">Compliance</h3>
                    <span className="text-caption text-muted-foreground">
                      {complianceStatus ?? (complianceRequired ? "No items" : "Not required")}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <label className="flex items-center gap-2 text-caption text-muted-foreground">
                      <input
                        type="checkbox"
                        id="compliance"
                        checked={complianceRequired}
                        onChange={(e) => setComplianceRequired(e.target.checked)}
                        className="rounded"
                      />
                      Required
                    </label>
                    {nextDueDate ? (
                      <span className="text-caption text-muted-foreground">
                        Next due {new Date(nextDueDate).toLocaleDateString()}
                      </span>
                    ) : null}
                  </div>
                  {complianceLoading ? (
                    <Skeleton className="h-8 w-full" />
                  ) : linkedCompliance.length === 0 ? (
                    <p className="text-caption text-muted-foreground">No linked items.</p>
                  ) : (
                    <ul className="divide-y divide-border/20">
                      {linkedCompliance.map((c) => (
                        <li key={c.id} className="flex items-center justify-between gap-2 py-1.5">
                          <span className="min-w-0 truncate text-sm">{c.title || "Untitled"}</span>
                          <Badge
                            variant={
                              c.expiry_state === "expired" ? "destructive" : c.expiry_state === "expiring" ? "warning" : "success"
                            }
                          >
                            {c.expiry_state || "valid"}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowLinkCompliance(true)}
                    className="inline-flex items-center gap-1 text-caption font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    <Plus className="h-3 w-3" aria-hidden />
                    {linkedCompliance.length === 0 ? "Link compliance item" : "Link another"}
                  </button>
                </section>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-1.5 px-4 pb-4 pt-2">
              <AssetDetailActionBar
                isBusy={isBusy}
                isRetired={asset.status === "retired"}
                onCreateTask={() => {
                  setShowCreateTask(true);
                  onCreateTaskClick?.();
                }}
                onAddRecord={() => setShowAddRecord(true)}
                onLogInspection={() => setShowLogInspection(true)}
                onDuplicate={() => void handleDuplicate()}
                onArchive={() => setShowArchiveDialog(true)}
                onDelete={() => setShowDeleteDialog(true)}
                onAskFilla={() => assetId && openAssistant({ type: "asset", id: assetId, name: asset?.name })}
              />
              <div className="flex items-start justify-end gap-3 px-0.5">
                <button
                  type="button"
                  onClick={() => setActivityExpanded((open) => !open)}
                  className="shrink-0 pt-px text-caption font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                  aria-expanded={activityExpanded}
                  aria-controls="asset-detail-activity-panel"
                >
                  Activity
                </button>
              </div>
              <div
                id="asset-detail-activity-panel"
                className={cn(
                  "grid transition-[grid-template-rows] duration-200 ease-out",
                  activityExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                )}
              >
                <div className="min-h-0 overflow-hidden">
                  {activityExpanded ? (
                    <div className="max-h-[28vh] space-y-3 overflow-y-auto border-t border-border/20 pt-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex gap-1">
                          {(["all", "tasks", "inspections", "files"] as const).map((f) => (
                            <button
                              key={f}
                              type="button"
                              onClick={() => setActivityFilter(f)}
                              className={cn(
                                "rounded-md px-2 py-1 text-caption font-medium capitalize transition-colors",
                                activityFilter === f
                                  ? "bg-card text-foreground shadow-e1"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => fileUploadInputRef.current?.click()}
                            className="text-caption text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                          >
                            Upload
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowAddFile(true)}
                            className="text-caption text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                          >
                            Add URL
                          </button>
                        </div>
                      </div>
                      <AssetActivityTimeline
                        inspections={inspections}
                        tasks={tasks}
                        files={files}
                        filter={activityFilter}
                        loading={inspectionsLoading || tasksLoading || filesLoading}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Task Modal - preseed property, space, asset */}
      <CreateTaskModal
        open={showCreateTask}
        onOpenChange={setShowCreateTask}
        defaultPropertyId={asset.property_id ?? undefined}
        defaultSpaceIds={asset.space_id ? [asset.space_id] : undefined}
        defaultAssetIds={[assetId]}
        onTaskCreated={() => {
          refreshTasks();
          refresh();
        }}
      />

      <IntakeModal
        open={showAddRecord}
        onOpenChange={(open) => {
          setShowAddRecord(open);
          if (!open) {
            void refreshCompliance();
            refresh();
          }
        }}
        initialIntakeMode="add_record"
        defaultPropertyId={asset.property_id ?? undefined}
        defaultSpaceIds={asset.space_id ? [asset.space_id] : undefined}
        defaultAssetIds={[assetId]}
      />

      {lightboxOpen && heroImages.length > 0
        ? createPortal(
            <div
              className="fixed inset-0 z-[9999] flex flex-col bg-black/90"
              role="dialog"
              aria-modal="true"
              aria-label="Asset photo preview"
              onClick={(e) => {
                if (e.target === e.currentTarget) setLightboxOpen(false);
              }}
            >
              <header className="relative z-20 flex shrink-0 items-center gap-2 border-b border-white/10 bg-black/50 px-3 py-2.5 backdrop-blur-md">
                <button
                  type="button"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                  onClick={() => setLightboxOpen(false)}
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{asset.name || "Asset photo"}</p>
                  <p className="truncate text-xs text-white/55">
                    {safeImageIndex + 1} / {heroImages.length} · Esc to close
                  </p>
                </div>
              </header>
              <div
                className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3 sm:p-6"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setLightboxOpen(false);
                }}
              >
                {heroImages.length > 1 ? (
                  <>
                    <button
                      type="button"
                      className="absolute left-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60 sm:left-4"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedImageIndex(
                          (safeImageIndex - 1 + heroImages.length) % heroImages.length
                        );
                      }}
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </button>
                    <button
                      type="button"
                      className="absolute right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60 sm:right-4"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedImageIndex((safeImageIndex + 1) % heroImages.length);
                      }}
                      aria-label="Next image"
                    >
                      <ChevronRight className="h-6 w-6" />
                    </button>
                  </>
                ) : null}
                <img
                  src={
                    heroImages[safeImageIndex]?.heroSrc ||
                    heroImages[safeImageIndex]?.src
                  }
                  alt={heroImages[safeImageIndex]?.alt || asset.name || "Asset photo"}
                  className="max-h-full max-w-full rounded-md object-contain shadow-lg"
                />
              </div>
            </div>,
            document.body
          )
        : null}

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{asset.name || "Unnamed Asset"}&quot;? This action cannot be undone and will permanently remove the asset and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Confirmation */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Asset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive &quot;{asset.name || "Unnamed Asset"}&quot;? The asset status will be set to retired. You can change it back to active later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} disabled={isArchiving}>
              {isArchiving ? "Archiving…" : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Log Inspection Modal */}
      {showLogInspection && (
        <LogInspectionModal
          assetId={assetId}
          onClose={() => setShowLogInspection(false)}
          onSaved={() => {
            refreshInspections();
            refresh();
          }}
        />
      )}

      {/* Add File Modal */}
      {showAddFile && (
        <AddFileModal
          assetId={assetId}
          onClose={() => setShowAddFile(false)}
          onSaved={() => {
            refreshFiles();
            refresh();
          }}
        />
      )}

      {/* Link Compliance Modal */}
      {showLinkCompliance && assetId && (
        <LinkComplianceModal
          assetId={assetId}
          complianceOptions={complianceOptions}
          linkedIds={linkedCompliance.map((c) => c.id)}
          onClose={() => setShowLinkCompliance(false)}
          onSaved={() => {
            refreshCompliance();
            refresh();
          }}
        />
      )}
    </>
  );
}

function AssetActivityTimeline({
  inspections,
  tasks,
  files,
  filter,
  loading,
}: {
  inspections: Array<{ id: string; inspection_date?: string | null; condition_score?: number | null; notes?: string | null }>;
  tasks: Array<{ id: string; title?: string | null; status?: string | null; due_date?: string | null }>;
  files: AssetFileRow[];
  filter: "all" | "tasks" | "inspections" | "files";
  loading: boolean;
}) {
  type TimelineItem = { type: "inspection" | "task" | "file"; date: string; id: string; data: unknown };
  const items: TimelineItem[] = [];
  inspections.forEach((i) => {
    items.push({ type: "inspection", date: i.inspection_date || "", id: i.id, data: i });
  });
  tasks.forEach((t) => {
    items.push({ type: "task", date: t.due_date || "", id: t.id, data: t });
  });
  files.forEach((f) => {
    items.push({ type: "file", date: f.uploaded_at || "", id: f.id, data: f });
  });
  items.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });

  const filtered = items.filter((i) => {
    if (filter === "all") return true;
    if (filter === "tasks") return i.type === "task";
    if (filter === "inspections") return i.type === "inspection";
    if (filter === "files") return i.type === "file";
    return true;
  });

  if (loading) return <Skeleton className="h-20 w-full" />;
  if (filtered.length === 0) {
    return <p className="py-2 text-caption text-muted-foreground">No activity yet.</p>;
  }

  return (
    <ul className="space-y-1.5">
      {filtered.map((item) => (
        <li key={`${item.type}-${item.id}`} className="flex items-baseline justify-between gap-2 py-1">
          {item.type === "inspection" && (
            <>
              <span className="min-w-0 truncate text-sm">
                Inspection
                {(item.data as { inspection_date?: string }).inspection_date ? (
                  <span className="ml-1.5 text-caption text-muted-foreground">
                    {new Date((item.data as { inspection_date: string }).inspection_date).toLocaleDateString()}
                  </span>
                ) : null}
              </span>
              {(item.data as { condition_score?: number }).condition_score != null ? (
                <Badge
                  variant={
                    (item.data as { condition_score: number }).condition_score >= 80
                      ? "success"
                      : (item.data as { condition_score: number }).condition_score >= 60
                        ? "warning"
                        : "danger"
                  }
                >
                  {(item.data as { condition_score: number }).condition_score}
                </Badge>
              ) : null}
            </>
          )}
          {item.type === "task" && (
            <>
              <span className="min-w-0 truncate text-sm">{(item.data as { title?: string }).title || "Untitled"}</span>
              <Badge variant={(item.data as { status?: string }).status === "completed" ? "success" : "neutral"}>
                {(item.data as { status?: string }).status}
              </Badge>
            </>
          )}
          {item.type === "file" && (
            <a
              href={(item.data as { file_url?: string }).file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 truncate text-sm text-primary hover:underline"
            >
              {(item.data as { file_type?: string }).file_type || "File"} uploaded
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

function LogInspectionModal({
  assetId,
  onClose,
  onSaved,
}: {
  assetId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [conditionScore, setConditionScore] = useState<string>("100");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSave = async () => {
    setSaving(true);
    try {
      const score = parseInt(conditionScore, 10);
      const normalizedScore = !isNaN(score) ? score : null;
      const normalizedNotes = notes.trim() || null;
      const { data: insertedInspection, error: insertError } = await supabase
        .from("asset_inspections")
        .insert({
          asset_id: assetId,
          condition_score: normalizedScore,
          notes: normalizedNotes,
        })
        .select("*")
        .single();
      if (insertError) throw insertError;

      if (normalizedScore != null) {
        const { error: assetUpdateError } = await supabase
          .from("assets")
          .update({ condition_score: normalizedScore })
          .eq("id", assetId);
        if (assetUpdateError) throw assetUpdateError;
      }

      queryClient.setQueryData(
        ["asset-inspections", assetId],
        (prev: Array<{
          id: string;
          inspection_date?: string | null;
          condition_score?: number | null;
          notes?: string | null;
        }> | undefined) => [insertedInspection, ...(prev ?? [])]
      );
      queryClient.setQueriesData(
        { queryKey: ["asset-detail"] },
        (prev: { id?: string; condition_score?: number | null } | null | undefined) => {
          if (!prev || prev.id !== assetId || normalizedScore == null) return prev;
          return { ...prev, condition_score: normalizedScore };
        }
      );

      toast({ title: "Inspection logged" });
      onSaved();
      onClose();
    } catch (e: unknown) {
      toast({
        title: "Failed to log inspection",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log Inspection</DialogTitle>
          <DialogDescription>Record an inspection for this asset</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Condition Score (0-100)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={conditionScore}
              onChange={(e) => setConditionScore(e.target.value)}
              className="input-neomorphic"
            />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
              className="input-neomorphic"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="btn-accent-vibrant">
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddFileModal({
  assetId,
  onClose,
  onSaved,
}: {
  assetId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fileUrl, setFileUrl] = useState("");
  const [fileType, setFileType] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!fileUrl.trim()) {
      toast({ title: "URL required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("asset_files").insert({
        asset_id: assetId,
        file_url: fileUrl.trim(),
        file_type: fileType.trim() || null,
      });
      if (error) throw error;
      toast({ title: "File added" });
      onSaved();
      onClose();
    } catch (e: unknown) {
      toast({
        title: "Failed to add file",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add File</DialogTitle>
          <DialogDescription>Add a file reference (URL) for this asset</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>File URL *</Label>
            <Input
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              placeholder="https://..."
              className="input-neomorphic"
            />
          </div>
          <div className="space-y-2">
            <Label>Type (optional)</Label>
            <Input
              value={fileType}
              onChange={(e) => setFileType(e.target.value)}
              placeholder="e.g. certificate, photo, invoice"
              className="input-neomorphic"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !fileUrl.trim()} className="btn-accent-vibrant">
            {saving ? "Saving…" : "Add"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LinkComplianceModal({
  assetId,
  complianceOptions,
  linkedIds,
  onClose,
  onSaved,
}: {
  assetId: string;
  complianceOptions: Array<{ id: string; title?: string | null }>;
  linkedIds: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const available = complianceOptions.filter((c) => !linkedIds.includes(c.id));

  const handleSave = async () => {
    if (!selectedId) {
      toast({ title: "Select a compliance item", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: existing, error: fetchError } = await supabase
        .from("compliance_documents")
        .select("linked_asset_ids")
        .eq("id", selectedId)
        .single();
      if (fetchError) throw fetchError;
      const current = (existing?.linked_asset_ids as string[]) || [];
      const updated = current.includes(assetId) ? current : [...current, assetId];
      const { error: updateError } = await supabase
        .from("compliance_documents")
        .update({ linked_asset_ids: updated })
        .eq("id", selectedId);
      if (updateError) throw updateError;
      toast({ title: "Compliance item linked" });
      onSaved();
      onClose();
    } catch (e: unknown) {
      toast({
        title: "Failed to link",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link compliance item</DialogTitle>
          <DialogDescription>Add this asset to a compliance document&apos;s linked assets</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Compliance item</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {available.length === 0 ? (
                  <SelectItem value="_none" disabled>
                    No compliance items available
                  </SelectItem>
                ) : (
                  available.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title || "Untitled"}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !selectedId || available.length === 0}
            className="btn-accent-vibrant"
          >
            {saving ? "Linking…" : "Link"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
