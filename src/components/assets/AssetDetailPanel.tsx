/**
 * AssetDetailPanel - Asset health dashboard with Overview, Activity, Compliance.
 * Paper texture modal, neumorphic tabs, 3-tab structure.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { X, Package, Activity, Shield, Plus, Copy, Trash2, Archive, ChevronDown, ChevronUp, ListTodo, ClipboardCheck, FileText, Network } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { GraphTabContent } from "@/components/graph/GraphTabContent";

const ASSET_TYPES = ["Boiler", "Appliance", "Vehicle", "HVAC", "Plumbing", "Electrical", "Other"];
const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "retired", label: "Retired" },
];

interface AssetDetailPanelProps {
  assetId: string | null;
  onClose: () => void;
  onCreateTaskClick?: () => void;
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
  const { settings } = useOrgSettings();
  const automatedIntelligence = settings?.automated_intelligence ?? "suggestions_only";
  const assetVector = { asset_type: asset?.asset_type, condition_score: asset?.condition_score, install_date: (asset as { install_date?: string })?.install_date };
  const { data: brainData } = useBrainInference(asset ? [assetVector] : [], [], automatedIntelligence !== "off");
  const brainPred = brainData?.predictions?.assets?.[0];

  const [activeTab, setActiveTab] = useState("overview");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [activityFilter, setActivityFilter] = useState<"all" | "tasks" | "inspections" | "files">("all");
  const [showCreateTask, setShowCreateTask] = useState(false);
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

  const saveAsset = useCallback(
    async (updates: Record<string, unknown>): Promise<boolean> => {
      if (!assetId || Object.keys(updates).length === 0) return false;
      try {
        const { error: err } = await supabase.from("assets").update(updates).eq("id", assetId);
        if (err) throw err;
        refresh();
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

  const handleArchive = useCallback(async () => {
    if (!assetId) return;
    setIsArchiving(true);
    try {
      const { error } = await supabase.from("assets").update({ status: "retired" }).eq("id", assetId);
      if (error) throw error;
      refresh();
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      toast({ title: "Asset archived", description: "Status set to retired." });
      setShowArchiveDialog(false);
    } catch (e: unknown) {
      toast({
        title: "Couldn't archive asset",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setIsArchiving(false);
    }
  }, [assetId, refresh, queryClient, toast]);

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

  if (!assetId) return null;

  if (loading) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col p-0">
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
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col p-0">
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

  const conditionScoreNum = parseInt(conditionScore, 10) || 0;
  const riskScore = brainPred?.risk_score ?? Math.max(0, 100 - conditionScoreNum);
  const riskLevel = riskScore >= 70 ? "HIGH" : riskScore >= 40 ? "MEDIUM" : "LOW";
  const nextAttentionDays = brainPred?.predicted_failure_days ?? 365;
  const recommendedAction = brainPred?.recommended_action ?? "Schedule routine inspection within 90 days.";

  return (
    <>
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-[960px] max-h-[90vh] overflow-hidden flex flex-col p-0 bg-background bg-paper-texture">
          <DialogHeader className="sr-only">
            <DialogTitle>Asset Details</DialogTitle>
            <DialogDescription>View and edit asset details</DialogDescription>
          </DialogHeader>
          <div className="flex flex-1 overflow-hidden flex-col bg-background bg-paper-texture">
            {/* Hidden file inputs */}
            <input ref={imageUploadInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFileUpload} />
            <input ref={fileUploadInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={handleFileUpload} />
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/20 px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/50 transition-colors shrink-0" aria-label="Close">
                    <X className="h-5 w-5 text-muted-foreground" />
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Package className="h-5 w-5 text-primary shrink-0" />
                      <h1 className="text-xl font-semibold text-foreground truncate">{asset.name || "Unnamed Asset"}</h1>
                      <Badge variant={asset.status === "active" ? "success" : asset.status === "retired" ? "neutral" : "warning"}>
                        {asset.status?.toUpperCase() ?? "ACTIVE"}
                      </Badge>
                    </div>
                    {(asset.property_name || asset.space_name) && (
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">
                        {[asset.property_name, asset.space_name].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={handleDuplicate} disabled={isDuplicating} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors">
                    Duplicate
                  </button>
                  <span className="text-muted-foreground/50">·</span>
                  <button onClick={() => setShowArchiveDialog(true)} disabled={asset.status === "retired"} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors">
                    Archive
                  </button>
                  <span className="text-muted-foreground/50">·</span>
                  <button onClick={() => setShowDeleteDialog(true)} className="text-xs text-destructive hover:text-destructive/90 px-2 py-1 rounded transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            </div>

            {/* Tabs - Neumorphic like TaskPanel */}
            <div className="flex-1 overflow-y-auto">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                <div className="sticky top-0 z-10 bg-background/95 px-5 py-3">
                  <TabsList
                    className={cn(
                      "w-full grid grid-cols-4 h-12 py-1 gap-1.5 rounded-[15px] bg-transparent",
                      "shadow-[inset_2px_6.6px_9.4px_0px_rgba(0,0,0,0.23),inset_0px_-5.7px_5.8px_0px_rgba(255,255,255,0.62)]"
                    )}
                  >
                    <TabsTrigger
                      value="overview"
                      className={cn(
                        "rounded-[8px] transition-all text-sm font-medium",
                        "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]",
                        "data-[state=active]:bg-card",
                        "data-[state=inactive]:bg-transparent",
                        "data-[state=inactive]:hover:bg-muted/20"
                      )}
                    >
                      <Package className="h-4 w-4 mr-2" />
                      Overview
                    </TabsTrigger>
                    <TabsTrigger
                      value="activity"
                      className={cn(
                        "rounded-[8px] transition-all text-sm font-medium",
                        "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]",
                        "data-[state=active]:bg-card",
                        "data-[state=inactive]:bg-transparent",
                        "data-[state=inactive]:hover:bg-muted/20"
                      )}
                    >
                      <Activity className="h-4 w-4 mr-2" />
                      Activity
                    </TabsTrigger>
                    <TabsTrigger
                      value="compliance"
                      className={cn(
                        "rounded-[8px] transition-all text-sm font-medium",
                        "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]",
                        "data-[state=active]:bg-card",
                        "data-[state=inactive]:bg-transparent",
                        "data-[state=inactive]:hover:bg-muted/20"
                      )}
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Compliance
                    </TabsTrigger>
                    <TabsTrigger
                      value="graph"
                      className={cn(
                        "rounded-[8px] transition-all text-sm font-medium",
                        "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]",
                        "data-[state=active]:bg-card",
                        "data-[state=inactive]:bg-transparent",
                        "data-[state=inactive]:hover:bg-muted/20"
                      )}
                    >
                      <Network className="h-4 w-4 mr-2" />
                      Graph
                    </TabsTrigger>
                  </TabsList>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col p-5">
                  <TabsContent value="overview" className="mt-0 flex-1 overflow-y-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-5">
                      {/* Left: Details + Timeline preview */}
                      <div className="space-y-4">
                        {/* Critical Info Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div
                            className="rounded-lg p-3 shadow-e1 bg-card cursor-pointer hover:shadow-e2 transition-shadow"
                            onClick={() => setDetailsExpanded(true)}
                          >
                            <p className="text-xs font-medium text-muted-foreground mb-1">Condition</p>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all",
                                    conditionScoreNum >= 80 ? "bg-green-500" : conditionScoreNum >= 60 ? "bg-amber-500" : "bg-red-500"
                                  )}
                                  style={{ width: `${conditionScoreNum}%` }}
                                />
                              </div>
                              <span className="text-sm font-semibold">{conditionScoreNum}%</span>
                            </div>
                          </div>
                          <div className="rounded-lg p-3 shadow-e1 bg-card">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Risk</p>
                            <div className="flex items-center gap-2">
                              <Badge variant={riskLevel === "HIGH" ? "destructive" : riskLevel === "MEDIUM" ? "warning" : "success"}>
                                {riskLevel}
                              </Badge>
                              <span className="text-sm font-medium">({riskScore}%)</span>
                            </div>
                            <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  riskLevel === "HIGH" ? "bg-red-500" : riskLevel === "MEDIUM" ? "bg-amber-500" : "bg-green-500"
                                )}
                                style={{ width: `${riskScore}%` }}
                              />
                            </div>
                          </div>
                          <div className="rounded-lg p-3 shadow-e1 bg-card">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Next Attention</p>
                            <span className="text-sm font-semibold">{nextAttentionDays}d</span>
                          </div>
                        </div>

                        {/* Recommended Action Card */}
                        <div className="rounded-lg p-4 shadow-e1 bg-card">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Recommended next step</p>
                          <p className="text-sm mb-3">{recommendedAction}</p>
                          <Button size="sm" className="btn-accent-vibrant" onClick={() => setShowLogInspection(true)}>
                            Log Inspection
                          </Button>
                        </div>

                        {/* Collapsed Details */}
                        <div className="rounded-lg shadow-e1 bg-card overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setDetailsExpanded(!detailsExpanded)}
                            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                          >
                            <span className="font-medium">Details</span>
                            {detailsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                          {detailsExpanded && (
                            <div className="px-4 pb-4 space-y-3 border-t border-border/20 pt-3">
                              <div className="grid grid-cols-2 gap-3">
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
                                  <Label className="text-xs">Condition (0-100)</Label>
                                  <NeomorphicInput type="number" min="0" max="100" value={conditionScore} onChange={(e) => setConditionScore(e.target.value)} className="h-8" />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
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
                              <div className="flex items-center gap-2">
                                <input type="checkbox" id="compliance" checked={complianceRequired} onChange={(e) => setComplianceRequired(e.target.checked)} className="rounded" />
                                <Label htmlFor="compliance" className="text-xs">Compliance required</Label>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Notes</Label>
                                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" className="input-neomorphic min-h-[60px] text-sm" rows={2} />
                              </div>
                              <div className="pt-2">
                                <Button
                                  size="sm"
                                  onClick={handleSaveDetails}
                                  disabled={isSavingDetails}
                                  className="btn-accent-vibrant"
                                >
                                  {isSavingDetails ? "Saving..." : "Save"}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Risk & Forecast */}
                      <div className="space-y-4">
                        <div className="rounded-lg p-4 shadow-e1 bg-card">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Risk & Forecast</p>
                          <p className="text-sm font-medium">Risk Level: {riskLevel}</p>
                          <p className="text-xs text-muted-foreground mt-1">Failure window: ~{nextAttentionDays} days</p>
                          {brainPred?.benchmark_percentile != null && (
                            <p className="text-xs text-muted-foreground mt-1">Compared to similar assets: {brainPred.benchmark_percentile}th percentile</p>
                          )}
                          <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                riskLevel === "HIGH" ? "bg-red-500" : riskLevel === "MEDIUM" ? "bg-amber-500" : "bg-green-500"
                              )}
                              style={{ width: `${riskScore}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-2">Based on anonymised condition patterns across Filla.</p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="activity" className="mt-0 flex-1 overflow-y-auto">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex gap-1.5 p-1 rounded-lg bg-muted/30 shadow-e1">
                          {(["all", "tasks", "inspections", "files"] as const).map((f) => (
                            <button
                              key={f}
                              type="button"
                              onClick={() => setActivityFilter(f)}
                              className={cn(
                                "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                                activityFilter === f ? "bg-card shadow-e1" : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              {f === "all" ? "All" : f === "tasks" ? "Tasks" : f === "inspections" ? "Inspections" : "Files"}
                            </button>
                          ))}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" className="btn-accent-vibrant">
                              <Plus className="h-4 w-4 mr-2" />
                              Add Activity
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setShowLogInspection(true)}>
                              <ClipboardCheck className="h-4 w-4 mr-2" />
                              Log Inspection
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setShowCreateTask(true);
                                onCreateTaskClick?.();
                              }}
                            >
                              <ListTodo className="h-4 w-4 mr-2" />
                              Create Task
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => fileUploadInputRef.current?.click()}>
                              <FileText className="h-4 w-4 mr-2" />
                              Upload File
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setShowAddFile(true)}>
                              <FileText className="h-4 w-4 mr-2" />
                              Add URL
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Unified Timeline */}
                      {(() => {
                        type TimelineItem = { type: "inspection" | "task" | "file"; date: string; id: string; data: unknown };
                        const items: TimelineItem[] = [];
                        inspections.forEach((i) => {
                          items.push({
                            type: "inspection",
                            date: i.inspection_date || "",
                            id: i.id,
                            data: i,
                          });
                        });
                        tasks.forEach((t) => {
                          items.push({
                            type: "task",
                            date: t.due_date || "",
                            id: t.id,
                            data: t,
                          });
                        });
                        files.forEach((f) => {
                          items.push({ type: "file", date: "", id: f.id, data: f });
                        });
                        items.sort((a, b) => {
                          const da = a.date ? new Date(a.date).getTime() : 0;
                          const db = b.date ? new Date(b.date).getTime() : 0;
                          return db - da;
                        });

                        const filtered = items.filter((i) => {
                          if (activityFilter === "all") return true;
                          if (activityFilter === "tasks") return i.type === "task";
                          if (activityFilter === "inspections") return i.type === "inspection";
                          if (activityFilter === "files") return i.type === "file";
                          return true;
                        });

                        if (inspectionsLoading || tasksLoading || filesLoading) {
                          return <Skeleton className="h-32 w-full" />;
                        }
                        if (filtered.length === 0) {
                          return <p className="text-sm text-muted-foreground py-4">No activity yet.</p>;
                        }
                        return (
                          <ul className="space-y-2">
                            {filtered.map((item) => (
                              <li key={`${item.type}-${item.id}`} className="p-3 rounded-lg bg-card shadow-e1">
                                {item.type === "inspection" && (
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <span className="text-sm font-medium">Inspection logged</span>
                                      <span className="text-xs text-muted-foreground ml-2">
                                        {(item.data as { inspection_date?: string }).inspection_date
                                          ? new Date((item.data as { inspection_date: string }).inspection_date).toLocaleDateString()
                                          : "—"}
                                      </span>
                                    </div>
                                    {(item.data as { condition_score?: number }).condition_score != null && (
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
                                    )}
                                  </div>
                                )}
                                {item.type === "task" && (
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium">{(item.data as { title?: string }).title || "Untitled"}</span>
                                    <Badge variant={(item.data as { status?: string }).status === "completed" ? "success" : "neutral"}>
                                      {(item.data as { status?: string }).status}
                                    </Badge>
                                  </div>
                                )}
                                {item.type === "file" && (
                                  <a
                                    href={(item.data as { file_url?: string }).file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-primary hover:underline"
                                  >
                                    Document uploaded ({(item.data as { file_type?: string }).file_type || "File"})
                                  </a>
                                )}
                              </li>
                            ))}
                          </ul>
                        );
                      })()}
                    </div>
                  </TabsContent>

                  <TabsContent value="compliance" className="mt-0 flex-1 overflow-y-auto">
                    <div className="space-y-4">
                      {/* Compliance Status Card */}
                      <div className="rounded-lg p-4 shadow-e1 bg-card overflow-hidden">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-medium">Compliance Required: {complianceRequired ? "YES" : "NO"}</span>
                        </div>
                        {linkedCompliance.length > 0 ? (
                          <>
                            {(() => {
                              const withDue = linkedCompliance
                                .map((c) => (c as { next_due_date?: string }).next_due_date)
                                .filter(Boolean) as string[];
                              const soonest = withDue.sort()[0];
                              return soonest ? (
                                <p className="text-sm text-muted-foreground">
                                  Next Due: {new Date(soonest).toLocaleDateString()}
                                </p>
                              ) : null;
                            })()}
                            <div
                              className={cn(
                                "h-1.5 rounded-full mt-2",
                                linkedCompliance.some((c) => c.expiry_state === "expired")
                                  ? "bg-red-500"
                                  : linkedCompliance.some((c) => c.expiry_state === "expiring")
                                  ? "bg-amber-500"
                                  : "bg-green-500"
                              )}
                            />
                            <p className="text-xs text-muted-foreground mt-2">
                              Status:{" "}
                              {linkedCompliance.some((c) => c.expiry_state === "expired")
                                ? "Needs attention"
                                : linkedCompliance.some((c) => c.expiry_state === "expiring")
                                ? "Expiring soon"
                                : "On Track"}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">No compliance schedule set.</p>
                        )}
                      </div>

                      {/* Recurring Checks */}
                      <div>
                        <h3 className="text-sm font-semibold text-muted-foreground mb-2">Recurring Checks</h3>
                        {complianceLoading ? (
                          <Skeleton className="h-24 w-full" />
                        ) : linkedCompliance.length === 0 ? (
                          <div className="rounded-lg p-4 shadow-e1 bg-card text-center">
                            <p className="text-sm text-muted-foreground mb-3">No compliance schedule set.</p>
                            <Button size="sm" variant="outline" onClick={() => setShowLinkCompliance(true)}>
                              Set up recurring check
                            </Button>
                          </div>
                        ) : (
                          <ul className="space-y-2">
                            {linkedCompliance.map((c) => (
                              <li key={c.id} className="p-3 rounded-lg bg-card shadow-e1 flex items-center justify-between">
                                <span className="font-medium">{c.title || "Untitled"}</span>
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
                        {linkedCompliance.length > 0 && (
                          <Button size="sm" variant="outline" className="mt-2" onClick={() => setShowLinkCompliance(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Link compliance item
                          </Button>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="graph" className="mt-0 flex-1 overflow-y-auto">
                    {assetId && (
                      <GraphTabContent start={{ type: "asset", id: assetId }} depth={3} />
                    )}
                  </TabsContent>
                </div>
              </Tabs>
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
              {isDeleting ? "Deleting..." : "Delete"}
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
              {isArchiving ? "Archiving..." : "Archive"}
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const score = parseInt(conditionScore, 10);
      const { error } = await supabase.from("asset_inspections").insert({
        asset_id: assetId,
        condition_score: !isNaN(score) ? score : null,
        notes: notes.trim() || null,
      });
      if (error) throw error;
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
            {saving ? "Saving..." : "Save"}
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
            {saving ? "Saving..." : "Add"}
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
            {saving ? "Linking..." : "Link"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
