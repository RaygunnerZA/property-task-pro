import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { propertyHubPath, propertySubPath } from "@/lib/propertyRoutes";
import { Building2, CheckCircle2, FileUp, Loader2, XCircle } from "lucide-react";
import { StandardPageWithBack } from "@/components/design-system/StandardPageWithBack";
import { EmptyState } from "@/components/design-system/EmptyState";
import { LoadingState } from "@/components/design-system/LoadingState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useBuildingPlans, usePlanExtraction } from "@/hooks/property/useBuildingPlans";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { PropertyPageScopeBar } from "@/components/properties/PropertyPageScopeBar";

type SectionKind = "spaces" | "assets" | "compliance" | "tasks";

const sectionTitles: Record<SectionKind, string> = {
  spaces: "Spaces",
  assets: "Assets",
  compliance: "Compliance elements",
  tasks: "Suggested tasks",
};

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

export default function PropertyBuildingPlans() {
  const { id } = useParams<{ id: string }>();
  const propertyId = id || "";
  const navigate = useNavigate();
  const { data: properties = [] } = usePropertiesQuery();
  const headerAccent =
    (
      properties.find((p: { id: string }) => p.id === propertyId) as
        | { icon_color_hex?: string | null }
        | undefined
    )?.icon_color_hex?.trim() || "#8EC9CE";
  const plansScopeBelowRow = propertyId ? (
    <PropertyPageScopeBar
      propertyId={propertyId}
      hrefForProperty={(pid) => propertySubPath(pid, "plans")}
      onBack={() => navigate(propertyHubPath(propertyId))}
    />
  ) : null;
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null);

  const plans = useBuildingPlans(propertyId);

  const selectedFile = useMemo(() => {
    if (!plans.files.length) return null;
    if (!selectedFileId) return plans.files[0];
    return plans.files.find((f) => f.id === selectedFileId) || plans.files[0];
  }, [plans.files, selectedFileId]);

  const runId = selectedFile ? plans.latestRunByFile[selectedFile.id]?.id : undefined;
  const extraction = usePlanExtraction(runId);

  const onUpload = async () => {
    if (!uploadFiles || uploadFiles.length === 0) {
      toast.error("Select one or more files first");
      return;
    }
    try {
      const ids = await plans.uploadPlans(Array.from(uploadFiles));
      setUploadFiles(null);
      if (ids.length > 0) setSelectedFileId(ids[0]);
      toast.success(`${ids.length} plan file(s) uploaded`);
    } catch (error) {
      toast.error(`Upload failed: ${String(error)}`);
    }
  };

  const updateAcceptedForAll = async (kind: SectionKind, accepted: boolean) => {
    const mapping: Record<
      SectionKind,
      { table: "extracted_spaces" | "extracted_assets" | "extracted_compliance_elements" | "extracted_task_suggestions"; rows: any[] }
    > = {
      spaces: { table: "extracted_spaces", rows: extraction.items.spaces },
      assets: { table: "extracted_assets", rows: extraction.items.assets },
      compliance: { table: "extracted_compliance_elements", rows: extraction.items.compliance },
      tasks: { table: "extracted_task_suggestions", rows: extraction.items.tasks },
    };
    const target = mapping[kind];
    for (const row of target.rows) {
      await extraction.updateItem({ table: target.table, id: row.id, values: { is_accepted: accepted } });
    }
    plans.refresh();
  };

  const acceptAllHighConfidence = async () => {
    const allSets = [
      { rows: extraction.items.spaces, table: "extracted_spaces" as const },
      { rows: extraction.items.assets, table: "extracted_assets" as const },
      { rows: extraction.items.compliance, table: "extracted_compliance_elements" as const },
      { rows: extraction.items.tasks, table: "extracted_task_suggestions" as const },
    ];
    for (const set of allSets) {
      for (const row of set.rows) {
        if ((row.confidence || 0) >= 0.75) {
          await extraction.updateItem({
            table: set.table,
            id: row.id,
            values: { is_accepted: true },
          });
        }
      }
    }
    plans.refresh();
    toast.success("Accepted all high confidence items");
  };

  const rejectAllLowConfidence = async () => {
    const allSets = [
      { rows: extraction.items.spaces, table: "extracted_spaces" as const },
      { rows: extraction.items.assets, table: "extracted_assets" as const },
      { rows: extraction.items.compliance, table: "extracted_compliance_elements" as const },
      { rows: extraction.items.tasks, table: "extracted_task_suggestions" as const },
    ];
    for (const set of allSets) {
      for (const row of set.rows) {
        if ((row.confidence || 0) < 0.5) {
          await extraction.updateItem({
            table: set.table,
            id: row.id,
            values: { is_accepted: false },
          });
        }
      }
    }
    plans.refresh();
    toast.success("Rejected all low confidence items");
  };

  const importAccepted = async () => {
    try {
      const result = await extraction.importAccepted();
      const row = Array.isArray(result) ? result[0] : result;
      toast.success(
        `Imported ${row?.created_spaces ?? 0} spaces, ${row?.created_assets ?? 0} assets, ${row?.created_tasks ?? 0} tasks`
      );
      plans.refresh();
    } catch (error) {
      toast.error(`Import failed: ${String(error)}`);
    }
  };

  if (plans.isLoading) {
    return (
      <StandardPageWithBack
        title="Building Plans"
        subtitle="Upload, review and import building intelligence"
        backTo={propertyId ? propertyHubPath(propertyId) : "/"}
        icon={<Building2 className="h-6 w-6" />}
        headerAccentColor={headerAccent}
        hideHeaderBack
        belowGradientRow={plansScopeBelowRow}
      >
        <LoadingState message="Loading building plans..." />
      </StandardPageWithBack>
    );
  }

  return (
    <StandardPageWithBack
      title="Building Plans"
      subtitle="Upload plans and let Filla draft your building model"
      backTo={propertyId ? propertyHubPath(propertyId) : "/"}
      icon={<Building2 className="h-6 w-6" />}
      headerAccentColor={headerAccent}
      hideHeaderBack
      belowGradientRow={plansScopeBelowRow}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr_320px]">
        <Card className="shadow-e1 p-3 space-y-3">
          <h3 className="text-sm font-semibold">Plan files</h3>
          <Input
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            multiple
            onChange={(event) => setUploadFiles(event.target.files)}
          />
          <Button onClick={onUpload} disabled={plans.isUploading} className="w-full">
            {plans.isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            Upload Building Plans
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
                <div className="mt-1 flex items-center justify-between">
                  <Badge variant={statusVariant(file.status)}>{file.status.replaceAll("_", " ")}</Badge>
                  <span className="text-xs text-muted-foreground">{file.page_count ?? 0} page(s)</span>
                </div>
                {file.error_message ? (
                  <p className="text-xs text-destructive mt-1 line-clamp-2">{file.error_message}</p>
                ) : null}
              </button>
            ))}
            {plans.files.length === 0 && (
              <EmptyState
                icon={Building2}
                title="No plans uploaded yet"
                description="Upload PDF or image plans to begin extraction."
              />
            )}
          </div>
        </Card>

        <Card className="shadow-e1 p-3 space-y-4 min-h-[520px]">
          {!runId ? (
            <EmptyState
              icon={Building2}
              title="No extraction run yet"
              description="Upload a plan file to start processing and review."
            />
          ) : extraction.isLoading ? (
            <LoadingState message="Loading extraction..." />
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Badge variant="neutral">{extraction.run?.status?.replaceAll("_", " ") || "unknown"}</Badge>
                <span className="text-xs text-muted-foreground">
                  {extraction.pages.length} page(s) processed
                </span>
              </div>

              {(["spaces", "assets", "compliance", "tasks"] as SectionKind[]).map((section) => (
                <ReviewSection
                  key={section}
                  title={sectionTitles[section]}
                  kind={section}
                  rows={extraction.items[section]}
                  onBulkAccept={() => updateAcceptedForAll(section, true)}
                  onBulkReject={() => updateAcceptedForAll(section, false)}
                  onUpdate={extraction.updateItem}
                  isUpdating={extraction.isUpdating}
                />
              ))}
            </>
          )}
        </Card>

        <Card className="shadow-e1 p-3 space-y-3">
          <h3 className="text-sm font-semibold">Review actions</h3>
          <p className="text-xs text-muted-foreground">
            Filla suggestions are editable. Nothing is auto-imported in MVP.
          </p>
          <Button onClick={acceptAllHighConfidence} disabled={!runId || extraction.isUpdating} className="w-full">
            <CheckCircle2 className="h-4 w-4" />
            Accept all high confidence
          </Button>
          <Button
            variant="outline"
            onClick={rejectAllLowConfidence}
            disabled={!runId || extraction.isUpdating}
            className="w-full"
          >
            <XCircle className="h-4 w-4" />
            Reject all low confidence
          </Button>
          <Button onClick={importAccepted} disabled={!runId || extraction.isImporting} className="w-full">
            {extraction.isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Import accepted items
          </Button>
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

function ReviewSection({
  title,
  kind,
  rows,
  onBulkAccept,
  onBulkReject,
  onUpdate,
  isUpdating,
}: {
  title: string;
  kind: SectionKind;
  rows: any[];
  onBulkAccept: () => void;
  onBulkReject: () => void;
  onUpdate: (args: {
    table:
      | "extracted_spaces"
      | "extracted_assets"
      | "extracted_compliance_elements"
      | "extracted_task_suggestions";
    id: string;
    values: Record<string, unknown>;
  }) => Promise<void>;
  isUpdating: boolean;
}) {
  const tableMap: Record<
    SectionKind,
    "extracted_spaces" | "extracted_assets" | "extracted_compliance_elements" | "extracted_task_suggestions"
  > = {
    spaces: "extracted_spaces",
    assets: "extracted_assets",
    compliance: "extracted_compliance_elements",
    tasks: "extracted_task_suggestions",
  };

  return (
    <div className="rounded-lg bg-card p-3 shadow-e1 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{title}</h4>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={onBulkAccept} disabled={isUpdating}>
            Accept all
          </Button>
          <Button variant="ghost" size="sm" onClick={onBulkReject} disabled={isUpdating}>
            Reject all
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No extracted items in this section.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const displayName = row.title ?? row.name ?? "";
            const typeValue =
              row.suggestion_type ??
              row.space_type ??
              row.asset_type ??
              row.element_type ??
              "unknown";
            return (
              <div key={row.id} className="rounded-lg bg-background/60 p-2 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{displayName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {row.source_page_id ? `Source page ${row.source_page_id.slice(0, 8)}` : "Source page unknown"}
                    </p>
                  </div>
                  <Badge variant={confidenceVariant(row.confidence)}>{Math.round((row.confidence || 0) * 100)}%</Badge>
                </div>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-[1fr_130px_auto] gap-2">
                  <Input
                    value={
                      row.edited_name ??
                      (row.title ? row.title : row.name ?? "")
                    }
                    onChange={(event) =>
                      onUpdate({
                        table: tableMap[kind],
                        id: row.id,
                        values: row.title ? { title: event.target.value } : { edited_name: event.target.value },
                      })
                    }
                    placeholder="Name"
                    disabled={isUpdating}
                  />
                  <Input
                    value={typeValue}
                    onChange={(event) =>
                      onUpdate({
                        table: tableMap[kind],
                        id: row.id,
                        values:
                          kind === "spaces"
                            ? { edited_space_type: event.target.value }
                            : kind === "assets"
                            ? { edited_asset_type: event.target.value }
                            : kind === "compliance"
                            ? { edited_element_type: event.target.value }
                            : { suggestion_type: event.target.value },
                      })
                    }
                    placeholder="Type"
                    disabled={isUpdating}
                  />
                  <div className="flex items-center justify-end gap-2 px-2">
                    <span className="text-[11px] text-muted-foreground">Accept</span>
                    <Switch
                      checked={Boolean(row.is_accepted)}
                      onCheckedChange={(checked) =>
                        onUpdate({
                          table: tableMap[kind],
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
      )}
    </div>
  );
}
