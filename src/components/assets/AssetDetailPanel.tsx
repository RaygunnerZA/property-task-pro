/**
 * AssetDetailPanel - Dialog for viewing and editing asset details.
 * Same pattern as TaskDetailPanel: Dialog + tabs (Overview, Linked Tasks, Inspections, Files).
 */
import { useState, useEffect, useCallback } from "react";
import { X, Package, ListTodo, ClipboardCheck, FileText, Plus, Shield, Brain } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { useDebounce } from "@/hooks/useDebounce";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { AssetIntelligenceTab } from "./AssetIntelligenceTab";

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

  const [activeTab, setActiveTab] = useState("overview");
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showLogInspection, setShowLogInspection] = useState(false);
  const [showAddFile, setShowAddFile] = useState(false);
  const [showLinkCompliance, setShowLinkCompliance] = useState(false);

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

  const debouncedName = useDebounce(name, 300);
  const debouncedNotes = useDebounce(notes, 300);
  const debouncedConditionScore = useDebounce(conditionScore, 300);
  const debouncedStatus = useDebounce(status, 300);
  const debouncedAssetType = useDebounce(assetType, 300);
  const debouncedSerialNumber = useDebounce(serialNumber, 300);
  const debouncedManufacturer = useDebounce(manufacturer, 300);
  const debouncedModel = useDebounce(model, 300);
  const debouncedComplianceRequired = useDebounce(complianceRequired, 300);

  const saveAsset = useCallback(
    async (updates: Record<string, unknown>) => {
      if (!assetId || Object.keys(updates).length === 0) return;
      try {
        const { error: err } = await supabase.from("assets").update(updates).eq("id", assetId);
        if (err) throw err;
        refresh();
      } catch (e: unknown) {
        toast({
          title: "Couldn't update asset",
          description: e instanceof Error ? e.message : "Failed to save",
          variant: "destructive",
        });
      }
    },
    [assetId, refresh, toast]
  );

  useEffect(() => {
    if (!assetId || !asset) return;
    const updates: Record<string, unknown> = {};
    if (debouncedName !== (asset.name || "")) updates.name = debouncedName;
    if (debouncedNotes !== (asset.notes || "")) updates.notes = debouncedNotes;
    const score = parseInt(debouncedConditionScore, 10);
    if (!isNaN(score) && score !== (asset.condition_score ?? 100)) updates.condition_score = score;
    if (debouncedStatus !== (asset.status || "active")) updates.status = debouncedStatus;
    if (debouncedAssetType !== (asset.asset_type || "")) updates.asset_type = debouncedAssetType || null;
    if (debouncedSerialNumber !== (asset.serial_number || "")) updates.serial_number = debouncedSerialNumber || null;
    if (debouncedManufacturer !== (asset.manufacturer || "")) updates.manufacturer = debouncedManufacturer || null;
    if (debouncedModel !== (asset.model || "")) updates.model = debouncedModel || null;
    if (debouncedComplianceRequired !== (asset.compliance_required ?? false)) updates.compliance_required = debouncedComplianceRequired;
    if (Object.keys(updates).length > 0) saveAsset(updates);
  }, [
    assetId,
    asset,
    debouncedName,
    debouncedNotes,
    debouncedConditionScore,
    debouncedStatus,
    debouncedAssetType,
    debouncedSerialNumber,
    debouncedManufacturer,
    debouncedModel,
    debouncedComplianceRequired,
    saveAsset,
  ]);

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

  return (
    <>
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Asset Details</DialogTitle>
            <DialogDescription>View and edit asset details</DialogDescription>
          </DialogHeader>
          <div className="flex flex-1 overflow-hidden flex-col">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-card border-b border-border/20 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  aria-label="Close panel"
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Package className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-semibold text-foreground">{asset.name || "Unnamed Asset"}</h1>
                {asset.status && (
                  <Badge
                    variant={asset.status === "active" ? "success" : asset.status === "retired" ? "neutral" : "warning"}
                  >
                    {asset.status}
                  </Badge>
                )}
                {asset.compliance_required && (
                  <Badge variant="warning">Compliance</Badge>
                )}
                {(asset.open_tasks_count ?? 0) > 0 && (
                  <Badge variant="neutral">{asset.open_tasks_count} open tasks</Badge>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex-1 overflow-y-auto">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                <div className="sticky top-0 z-10 bg-card border-b border-border/20 px-6">
                  <TabsList className="w-full grid grid-cols-6 h-12 bg-transparent p-1">
                    <TabsTrigger
                      value="overview"
                      className={cn(
                        "rounded-lg data-[state=active]:bg-card",
                        "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]"
                      )}
                    >
                      <Package className="h-4 w-4 mr-2" />
                      Overview
                    </TabsTrigger>
                    <TabsTrigger
                      value="tasks"
                      className={cn(
                        "rounded-lg data-[state=active]:bg-card",
                        "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]"
                      )}
                    >
                      <ListTodo className="h-4 w-4 mr-2" />
                      Linked Tasks
                    </TabsTrigger>
                    <TabsTrigger
                      value="inspections"
                      className={cn(
                        "rounded-lg data-[state=active]:bg-card",
                        "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]"
                      )}
                    >
                      <ClipboardCheck className="h-4 w-4 mr-2" />
                      Inspections
                    </TabsTrigger>
                    <TabsTrigger
                      value="files"
                      className={cn(
                        "rounded-lg data-[state=active]:bg-card",
                        "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]"
                      )}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Files
                    </TabsTrigger>
                    <TabsTrigger
                      value="compliance"
                      className={cn(
                        "rounded-lg data-[state=active]:bg-card",
                        "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]"
                      )}
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Compliance
                    </TabsTrigger>
                    <TabsTrigger
                      value="intelligence"
                      className={cn(
                        "rounded-lg data-[state=active]:bg-card",
                        "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]"
                      )}
                    >
                      <Brain className="h-4 w-4 mr-2" />
                      Intelligence
                    </TabsTrigger>
                  </TabsList>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col p-6">
                  <TabsContent value="overview" className="mt-0 flex-1 overflow-y-auto">
                    <div className="grid gap-6 max-w-2xl">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <NeomorphicInput
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Asset name"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Type</Label>
                          <Select value={assetType || "none"} onValueChange={(v) => setAssetType(v === "none" ? "" : v)}>
                            <SelectTrigger className="input-neomorphic">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {ASSET_TYPES.map((t) => (
                                <SelectItem key={t} value={t}>
                                  {t}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Status</Label>
                          <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger className="input-neomorphic">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Serial Number</Label>
                          <NeomorphicInput
                            value={serialNumber}
                            onChange={(e) => setSerialNumber(e.target.value)}
                            placeholder="e.g. ABC123"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Condition Score (0-100)</Label>
                          <NeomorphicInput
                            type="number"
                            min="0"
                            max="100"
                            value={conditionScore}
                            onChange={(e) => setConditionScore(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Manufacturer</Label>
                          <NeomorphicInput
                            value={manufacturer}
                            onChange={(e) => setManufacturer(e.target.value)}
                            placeholder="Manufacturer"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Model</Label>
                          <NeomorphicInput
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            placeholder="Model"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="compliance"
                          checked={complianceRequired}
                          onChange={(e) => setComplianceRequired(e.target.checked)}
                          className="rounded"
                        />
                        <Label htmlFor="compliance">Compliance required</Label>
                      </div>
                      <div className="space-y-2">
                        <Label>Notes</Label>
                        <Textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Notes"
                          className="input-neomorphic min-h-[80px]"
                          rows={3}
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="tasks" className="mt-0 flex-1 overflow-y-auto">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-muted-foreground">Tasks linked to this asset</h3>
                        <Button
                          size="sm"
                          className="btn-accent-vibrant"
                          onClick={() => {
                            setShowCreateTask(true);
                            onCreateTaskClick?.();
                          }}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Create Task for this Asset
                        </Button>
                      </div>
                      {tasksLoading ? (
                        <Skeleton className="h-24 w-full" />
                      ) : tasks.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No tasks linked yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {tasks.map((t) => (
                            <li
                              key={t.id}
                              className="p-3 rounded-[8px] bg-card shadow-e1 flex items-center justify-between"
                            >
                              <span className="font-medium">{t.title || "Untitled"}</span>
                              <Badge variant={t.status === "completed" ? "success" : "neutral"}>{t.status}</Badge>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="inspections" className="mt-0 flex-1 overflow-y-auto">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-muted-foreground">Inspection history</h3>
                        <Button size="sm" variant="outline" onClick={() => setShowLogInspection(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Log Inspection
                        </Button>
                      </div>
                      {inspectionsLoading ? (
                        <Skeleton className="h-24 w-full" />
                      ) : inspections.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No inspections yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {inspections.map((i) => (
                            <li
                              key={i.id}
                              className="p-3 rounded-[8px] bg-card shadow-e1 flex items-center justify-between"
                            >
                              <div>
                                <span className="text-sm">
                                  {i.inspection_date
                                    ? new Date(i.inspection_date).toLocaleDateString()
                                    : "—"}
                                </span>
                                {i.notes && (
                                  <p className="text-xs text-muted-foreground mt-1">{i.notes}</p>
                                )}
                              </div>
                              {i.condition_score != null && (
                                <Badge variant={i.condition_score >= 80 ? "success" : i.condition_score >= 60 ? "warning" : "danger"}>
                                  {i.condition_score}
                                </Badge>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="files" className="mt-0 flex-1 overflow-y-auto">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-muted-foreground">Files</h3>
                        <Button size="sm" variant="outline" onClick={() => setShowAddFile(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add File
                        </Button>
                      </div>
                      {filesLoading ? (
                        <Skeleton className="h-24 w-full" />
                      ) : files.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No files yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {files.map((f) => (
                            <li key={f.id} className="p-3 rounded-[8px] bg-card shadow-e1">
                              <a
                                href={f.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline"
                              >
                                {f.file_type || "File"}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="compliance" className="mt-0 flex-1 overflow-y-auto">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-muted-foreground">Compliance related to this asset</h3>
                        <Button size="sm" variant="outline" onClick={() => setShowLinkCompliance(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Link compliance item
                        </Button>
                      </div>
                      {complianceLoading ? (
                        <Skeleton className="h-24 w-full" />
                      ) : linkedCompliance.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No compliance items linked yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {linkedCompliance.map((c) => (
                            <li
                              key={c.id}
                              className="p-3 rounded-[8px] bg-card shadow-e1 flex items-center justify-between"
                            >
                              <span className="font-medium">{c.title || "Untitled"}</span>
                              <Badge
                                variant={
                                  c.expiry_state === "expired"
                                    ? "destructive"
                                    : c.expiry_state === "expiring"
                                    ? "warning"
                                    : "success"
                                }
                              >
                                {c.expiry_state || "valid"}
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="intelligence" className="mt-0 flex-1 overflow-y-auto">
                    <AssetIntelligenceTab asset={asset} />
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
