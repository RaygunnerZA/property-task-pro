import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { propertyHubPath, propertySubPath } from "@/lib/propertyRoutes";
import {
  Building2,
  CheckCircle2,
  FileUp,
  Loader2,
  Sparkles,
  XCircle,
} from "lucide-react";
import { StandardPageWithBack } from "@/components/design-system/StandardPageWithBack";
import { EmptyState } from "@/components/design-system/EmptyState";
import { LoadingState } from "@/components/design-system/LoadingState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  useBuildingPlans,
  usePlanExtraction,
  type ExtractedRow,
  type PlanSetupInput,
} from "@/hooks/property/useBuildingPlans";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { PropertyPageScopeBar } from "@/components/properties/PropertyPageScopeBar";

function statusVariant(status: string): "warning" | "success" | "danger" | "neutral" {
  if (status === "ready_for_review" || status === "partially_reviewed" || status === "imported") {
    return "success";
  }
  if (status === "failed") return "danger";
  if (status === "converting" || status === "extracting" || status === "uploaded") return "warning";
  return "neutral";
}

function confidenceVariant(confidence: number): "success" | "warning" | "danger" {
  if (confidence >= 0.8) return "success";
  if (confidence >= 0.5) return "warning";
  return "danger";
}

function reviewBandLabel(band?: string | null): string {
  if (band === "reliable") return "Looks clear";
  if (band === "needs_confirmation") return "Confirm";
  if (band === "incomplete") return "Needs work";
  return "Review";
}

function isProcessingStatus(status?: string | null): boolean {
  return status === "converting" || status === "extracting";
}

function canReview(status?: string | null): boolean {
  return (
    status === "ready_for_review" ||
    status === "partially_reviewed" ||
    status === "imported"
  );
}

export default function PropertyBuildingPlans() {
  const { id } = useParams<{ id: string }>();
  const propertyId = id || "";
  const navigate = useNavigate();
  const { data: properties = [] } = usePropertiesQuery();
  const property = properties.find((p: { id: string }) => p.id === propertyId) as
    | { name?: string; icon_color_hex?: string | null }
    | undefined;
  const headerAccent = property?.icon_color_hex?.trim() || "#8EC9CE";
  const plansScopeBelowRow = propertyId ? (
    <PropertyPageScopeBar
      propertyId={propertyId}
      hrefForProperty={(pid) => propertySubPath(pid, "plans")}
    />
  ) : null;

  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null);
  const [setup, setSetup] = useState<PlanSetupInput>({
    building_label: "",
    floor_label: "",
    setup_notes: "",
  });
  const [activePageId, setActivePageId] = useState<string | null>(null);

  const plans = useBuildingPlans(propertyId);

  const selectedFile = useMemo(() => {
    if (!plans.files.length) return null;
    if (!selectedFileId) return plans.files[0];
    return plans.files.find((f) => f.id === selectedFileId) || plans.files[0];
  }, [plans.files, selectedFileId]);

  const runId = selectedFile ? plans.latestRunByFile[selectedFile.id]?.id : undefined;
  const extraction = usePlanExtraction(runId);

  useEffect(() => {
    if (!selectedFile) return;
    setSetup({
      building_label: selectedFile.building_label || property?.name || "",
      floor_label: selectedFile.floor_label || "",
      setup_notes: selectedFile.setup_notes || "",
      scale_known: selectedFile.scale_known ?? undefined,
      units: selectedFile.units || undefined,
    });
  }, [selectedFile?.id, selectedFile?.building_label, selectedFile?.floor_label, property?.name]);

  useEffect(() => {
    if (!extraction.pages.length) {
      setActivePageId(null);
      return;
    }
    setActivePageId((prev) =>
      prev && extraction.pages.some((p) => p.id === prev) ? prev : extraction.pages[0].id
    );
  }, [extraction.pages]);

  const acceptedCount = extraction.items.spaces.filter((s) => s.is_accepted).length;
  const activePage = extraction.pages.find((p) => p.id === activePageId) || extraction.pages[0];
  const spacesForPage = useMemo(() => {
    if (!activePage) return extraction.items.spaces;
    const filtered = extraction.items.spaces.filter((s) => s.source_page_id === activePage.id);
    return filtered.length ? filtered : extraction.items.spaces;
  }, [extraction.items.spaces, activePage]);

  const onUpload = async () => {
    if (!uploadFiles || uploadFiles.length === 0) {
      toast.error("Select one or more PDF or image files first");
      return;
    }
    try {
      const ids = await plans.uploadPlans(Array.from(uploadFiles));
      setUploadFiles(null);
      if (ids.length > 0) setSelectedFileId(ids[0]);
      toast.success(`${ids.length} plan sheet(s) uploaded — confirm building & floor next`);
    } catch (error) {
      toast.error(`Upload failed: ${String(error)}`);
    }
  };

  const onProposeSpaces = async () => {
    if (!selectedFile) return;
    if (!setup.building_label.trim() || !setup.floor_label.trim()) {
      toast.error("Confirm building and floor before proposing spaces");
      return;
    }
    try {
      await plans.proposeSpaces({ planFileId: selectedFile.id, setup });
      toast.success("Space proposals ready — review before creating");
      plans.refresh();
    } catch (error) {
      toast.error(`Could not propose spaces: ${String(error)}`);
      plans.refresh();
    }
  };

  const acceptReliable = async () => {
    for (const row of extraction.items.spaces) {
      if ((row.review_band === "reliable" || (row.confidence || 0) >= 0.75) && !row.is_accepted) {
        await extraction.updateItem({
          table: "extracted_spaces",
          id: row.id,
          values: { is_accepted: true },
        });
      }
    }
    plans.refresh();
    toast.success("Marked clear labels for create");
  };

  const rejectIncomplete = async () => {
    for (const row of extraction.items.spaces) {
      if (
        (row.review_band === "incomplete" || (row.confidence || 0) < 0.5) &&
        row.is_accepted
      ) {
        await extraction.updateItem({
          table: "extracted_spaces",
          id: row.id,
          values: { is_accepted: false },
        });
      }
    }
    plans.refresh();
    toast.success("Unchecked incomplete proposals");
  };

  const importAccepted = async () => {
    if (acceptedCount === 0) {
      toast.error("Confirm at least one space before creating");
      return;
    }
    try {
      const result = await extraction.importAccepted();
      const row = Array.isArray(result) ? result[0] : result;
      toast.success(`Created ${row?.created_spaces ?? 0} space(s)`);
      plans.refresh();
    } catch (error) {
      toast.error(`Create failed: ${String(error)}`);
    }
  };

  if (plans.isLoading) {
    return (
      <StandardPageWithBack
        title="Building setup"
        subtitle="Upload a plan sheet, confirm building & floor, then review space proposals"
        backTo={propertyId ? propertyHubPath(propertyId) : "/"}
        icon={<Building2 className="h-6 w-6" />}
        headerAccentColor={headerAccent}
        hideHeaderBack
        belowGradientRow={plansScopeBelowRow}
      >
        <LoadingState message="Loading plan sheets…" />
      </StandardPageWithBack>
    );
  }

  const processing = isProcessingStatus(selectedFile?.status) || plans.isProcessing;
  const showSetup =
    selectedFile &&
    (selectedFile.status === "uploaded" ||
      selectedFile.status === "failed" ||
      (!runId && !processing));
  const showReview = selectedFile && canReview(selectedFile.status) && runId;

  return (
    <StandardPageWithBack
      title="Building setup"
      subtitle="Confirm what this sheet covers, propose Spaces from labels, then create only what you accept"
      backTo={propertyId ? propertyHubPath(propertyId) : "/"}
      icon={<Building2 className="h-6 w-6" />}
      headerAccentColor={headerAccent}
      hideHeaderBack
      belowGradientRow={plansScopeBelowRow}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr_280px]">
        <Card className="shadow-e1 p-3 space-y-3">
          <h3 className="text-sm font-semibold">Plan sheets</h3>
          <Input
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            multiple
            onChange={(event) => setUploadFiles(event.target.files)}
          />
          <Button onClick={onUpload} disabled={plans.isUploading} className="w-full gap-2">
            {plans.isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileUp className="h-4 w-4" />
            )}
            Upload PDF / image
          </Button>
          <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
            {plans.files.map((file) => (
              <button
                key={file.id}
                type="button"
                onClick={() => setSelectedFileId(file.id)}
                className={cn(
                  "w-full text-left rounded-lg p-2 shadow-e1 transition-all",
                  selectedFile?.id === file.id ? "bg-primary/10" : "bg-card hover:bg-muted/30"
                )}
              >
                <div className="text-sm font-medium truncate">{file.file_name}</div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <Badge variant={statusVariant(file.status)}>
                    {file.status.replaceAll("_", " ")}
                  </Badge>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {file.page_count ?? 0} pg
                  </span>
                </div>
                {(file.building_label || file.floor_label) && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {[file.building_label, file.floor_label].filter(Boolean).join(" · ")}
                  </p>
                )}
                {file.error_message ? (
                  <p className="text-xs text-destructive mt-1 line-clamp-2">{file.error_message}</p>
                ) : null}
              </button>
            ))}
            {plans.files.length === 0 && (
              <EmptyState
                icon={Building2}
                title="No plan sheets yet"
                description="Upload a PDF or image of one floor, then confirm building and floor."
              />
            )}
          </div>
        </Card>

        <Card className="shadow-e1 p-3 space-y-4 min-h-[520px]">
          {!selectedFile ? (
            <EmptyState
              icon={Building2}
              title="Start with a plan sheet"
              description="Upload one floor plan PDF or image. You will confirm building and floor before any Spaces are proposed."
            />
          ) : processing ? (
            <LoadingState message="Reading labels on this sheet…" />
          ) : showSetup ? (
            <div className="space-y-4 max-w-lg">
              <div>
                <h3 className="text-sm font-semibold">What does this sheet cover?</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Filla proposes Spaces from room labels on the plan. You confirm building and floor
                  first — nothing is created until you review.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="building_label">Building</Label>
                <Input
                  id="building_label"
                  value={setup.building_label}
                  onChange={(e) => setSetup((s) => ({ ...s, building_label: e.target.value }))}
                  placeholder="e.g. Main building, Block A"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="floor_label">Floor / level</Label>
                <Input
                  id="floor_label"
                  value={setup.floor_label}
                  onChange={(e) => setSetup((s) => ({ ...s, floor_label: e.target.value }))}
                  placeholder="e.g. Ground, Level 2, Basement"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="setup_notes">Notes (optional)</Label>
                <Textarea
                  id="setup_notes"
                  value={setup.setup_notes || ""}
                  onChange={(e) => setSetup((s) => ({ ...s, setup_notes: e.target.value }))}
                  placeholder="e.g. Ignore parking sheet annotations"
                  rows={3}
                />
              </div>
              <Button onClick={onProposeSpaces} disabled={plans.isProcessing} className="gap-2">
                {plans.isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Propose Spaces from labels
              </Button>
            </div>
          ) : showReview ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="neutral">
                  {extraction.run?.status?.replaceAll("_", " ") || "ready"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {[selectedFile.building_label, selectedFile.floor_label]
                    .filter(Boolean)
                    .join(" · ") || "Building / floor"}
                </span>
                <span className="text-xs text-muted-foreground">
                  · {extraction.items.spaces.length} proposal(s)
                </span>
              </div>

              {extraction.pages.length > 1 && (
                <div className="flex flex-wrap gap-1">
                  {extraction.pages.map((page) => (
                    <Button
                      key={page.id}
                      size="sm"
                      variant={activePage?.id === page.id ? "default" : "outline"}
                      onClick={() => setActivePageId(page.id)}
                    >
                      Page {page.page_number}
                    </Button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1fr] gap-3">
                <div className="rounded-lg bg-muted/20 shadow-sm overflow-hidden min-h-[240px] flex items-center justify-center">
                  {activePage?.signedUrl ? (
                    <img
                      src={activePage.signedUrl}
                      alt={`Plan page ${activePage.page_number}`}
                      className="max-h-[420px] w-full object-contain"
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground p-4 text-center">
                      Plan preview unavailable for this page. You can still review proposed labels
                      below.
                    </p>
                  )}
                </div>

                <SpaceProposalsList
                  rows={spacesForPage}
                  isUpdating={extraction.isUpdating}
                  onUpdate={extraction.updateItem}
                />
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Building2}
              title="Waiting for setup"
              description="Confirm building and floor, then propose Spaces."
            />
          )}
        </Card>

        <Card className="shadow-e1 p-3 space-y-3">
          <h3 className="text-sm font-semibold">Create Spaces</h3>
          <p className="text-xs text-muted-foreground">
            Only confirmed proposals become Spaces. Assets, compliance and tasks are not created in
            this step.
          </p>
          <div className="rounded-lg bg-muted/30 p-2 text-xs shadow-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Confirmed</span>
              <span className="font-medium">
                {acceptedCount} / {extraction.items.spaces.length}
              </span>
            </div>
          </div>
          <Button
            onClick={acceptReliable}
            disabled={!showReview || extraction.isUpdating}
            className="w-full gap-2"
            variant="outline"
          >
            <CheckCircle2 className="h-4 w-4" />
            Confirm clear labels
          </Button>
          <Button
            variant="outline"
            onClick={rejectIncomplete}
            disabled={!showReview || extraction.isUpdating}
            className="w-full gap-2"
          >
            <XCircle className="h-4 w-4" />
            Uncheck incomplete
          </Button>
          <Button
            onClick={importAccepted}
            disabled={!showReview || extraction.isImporting || acceptedCount === 0}
            className="w-full gap-2"
          >
            {extraction.isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create {acceptedCount || ""} confirmed Space{acceptedCount === 1 ? "" : "s"}
          </Button>
          {selectedFile?.status === "imported" && (
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => navigate(`/properties/${propertyId}/spaces/organise`)}
            >
              Open Spaces organise
            </Button>
          )}
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => (propertyId ? navigate(propertyHubPath(propertyId)) : navigate("/"))}
          >
            Back to property
          </Button>
        </Card>
      </div>
    </StandardPageWithBack>
  );
}

function SpaceProposalsList({
  rows,
  isUpdating,
  onUpdate,
}: {
  rows: ExtractedRow[];
  isUpdating: boolean;
  onUpdate: (args: {
    table: "extracted_spaces";
    id: string;
    values: Record<string, unknown>;
  }) => Promise<void>;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No space labels proposed for this page. You can still add Spaces manually from Spaces
        organise.
      </p>
    );
  }

  return (
    <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
      {rows.map((row) => {
        const displayName = row.edited_name ?? row.name ?? "";
        const typeValue = row.edited_space_type ?? row.space_type ?? "unknown";
        return (
          <div key={row.id} className="rounded-lg bg-background/60 p-2 shadow-sm space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{displayName}</p>
                <p className="text-caption text-muted-foreground">
                  {reviewBandLabel(row.review_band)}
                  {row.floor_label ? ` · ${row.floor_label}` : ""}
                </p>
              </div>
              <Badge variant={confidenceVariant(row.confidence)}>
                {Math.round((row.confidence || 0) * 100)}%
              </Badge>
            </div>
            {row.rationale ? (
              <p className="text-caption text-muted-foreground line-clamp-2">{row.rationale}</p>
            ) : null}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_110px_auto] gap-2">
              <Input
                value={displayName}
                onChange={(event) =>
                  onUpdate({
                    table: "extracted_spaces",
                    id: row.id,
                    values: { edited_name: event.target.value },
                  })
                }
                placeholder="Space name"
                disabled={isUpdating}
              />
              <Input
                value={typeValue}
                onChange={(event) =>
                  onUpdate({
                    table: "extracted_spaces",
                    id: row.id,
                    values: { edited_space_type: event.target.value },
                  })
                }
                placeholder="Type"
                disabled={isUpdating}
              />
              <div className="flex items-center justify-end gap-2 px-1">
                <span className="text-caption text-muted-foreground">Create</span>
                <Switch
                  checked={Boolean(row.is_accepted)}
                  onCheckedChange={(checked) =>
                    onUpdate({
                      table: "extracted_spaces",
                      id: row.id,
                      values: { is_accepted: checked },
                    })
                  }
                  disabled={isUpdating}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
