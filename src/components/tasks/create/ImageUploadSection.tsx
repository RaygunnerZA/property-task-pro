import { useState, useRef, useEffect } from "react";
import { X, Camera, Upload, SquarePen, AlertCircle, FileText, Loader2, BadgeCheck, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TempImage, UploadStatus } from "@/types/temp-image";
import { createTempImage, cleanupTempImage } from "@/utils/image-optimization";
import { ImageAnnotationEditor } from "@/components/tasks/ImageAnnotationEditor";
import type { Annotation } from "@/types/image-annotations";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import type { IntakeMode } from "@/types/intake";

export interface PendingTaskFile {
  local_id: string;
  file: File;
  display_name: string;
  file_size: number;
  file_type: string;
}

interface ImageUploadSectionProps {
  images: TempImage[];
  onImagesChange: (images: TempImage[]) => void;
  /** Merge fields onto a single temp image (e.g. intake preferences) */
  onPatchImage?: (localId: string, patch: Partial<TempImage>) => void;
  /** User explicitly requested full compliance extraction */
  onRunFullIntakeAnalysis?: (localId: string) => void | Promise<void>;
  files: PendingTaskFile[];
  onFilesChange: (files: PendingTaskFile[]) => void;
  taskId?: string; // Only set after task creation
  /** Drives upload microcopy and file-picker emphasis in unified intake */
  intakeMode?: IntakeMode;
}

export function ImageUploadSection({
  images,
  onImagesChange,
  onPatchImage,
  onRunFullIntakeAnalysis,
  files,
  onFilesChange,
  taskId,
  intakeMode = "report_issue",
}: ImageUploadSectionProps) {
  const { toast } = useToast();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAnnotationEditor, setShowAnnotationEditor] = useState(false);
  const [editingImageIndex, setEditingImageIndex] = useState<number | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  // Cleanup blob URLs on unmount only
  useEffect(() => {
    return () => {
      images.forEach(cleanupTempImage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileSelect = async (incomingFiles: FileList | null) => {
    if (!incomingFiles) return;

    const nextImages = [...images];
    const newFiles: PendingTaskFile[] = [];
    const imageJobs: Promise<void>[] = [];
    let oversizedCount = 0;
    const commitImages = () => onImagesChange([...nextImages]);

    for (const file of Array.from(incomingFiles)) {
      if (file.size > MAX_FILE_SIZE) {
        oversizedCount += 1;
        continue;
      }

      if (!file.type.startsWith("image/")) {
        newFiles.push({
          local_id: crypto.randomUUID(),
          file,
          display_name: file.name,
          file_size: file.size,
          file_type: file.type || "application/octet-stream",
        });
        continue;
      }

      const localId = crypto.randomUUID();
      const provisionalUrl = URL.createObjectURL(file);
      const provisionalImage: TempImage = {
        local_id: localId,
        display_name: file.name,
        original_file: file,
        thumbnail_blob: file,
        optimized_blob: file,
        annotation_json: [],
        uploaded: false,
        upload_status: "pending",
        thumbnail_url: provisionalUrl,
        optimized_url: provisionalUrl,
      };
      // Instant preview path: add a provisional image immediately, then upgrade it.
      nextImages.push(provisionalImage);
      commitImages();

      const job = createTempImage(file)
        .then((tempImage) => {
          const idx = nextImages.findIndex((img) => img.local_id === localId);
          if (idx === -1) {
            cleanupTempImage(tempImage);
            return;
          }
          const existing = nextImages[idx];
          if (existing.thumbnail_url === existing.optimized_url && existing.thumbnail_url) {
            URL.revokeObjectURL(existing.thumbnail_url);
          } else {
            if (existing.thumbnail_url) URL.revokeObjectURL(existing.thumbnail_url);
            if (existing.optimized_url) URL.revokeObjectURL(existing.optimized_url);
          }
          nextImages[idx] = {
            ...tempImage,
            local_id: localId,
            display_name: existing.display_name,
            original_file: existing.original_file,
            annotation_json: existing.annotation_json ?? [],
            uploaded: existing.uploaded,
            upload_status: existing.upload_status ?? "pending",
          };
          commitImages();
        })
        .catch((error) => {
          console.error(`Failed to process "${file.name}":`, error);
          const idx = nextImages.findIndex((img) => img.local_id === localId);
          if (idx !== -1) {
            const failed = nextImages[idx];
            nextImages[idx] = {
              ...failed,
              upload_status: "failed",
              upload_error: "Image processing failed",
            };
            commitImages();
          }
        });
      imageJobs.push(job);
    }

    if (imageJobs.length > 0) {
      await Promise.allSettled(imageJobs);
    }

    if (oversizedCount > 0) {
      toast({
        title: "File too large",
        description: `${oversizedCount} file${oversizedCount === 1 ? "" : "s"} exceeded 50MB.`,
        variant: "destructive",
      });
    }

    if (newFiles.length > 0) {
      onFilesChange([...files, ...newFiles]);
    }
  };

  const removeImage = (index: number) => {
    const imageToRemove = images[index];
    cleanupTempImage(imageToRemove);
    onImagesChange(images.filter((_, i) => i !== index));
  };

  const updateImageAnnotations = (index: number, annotations: Annotation[]) => {
    const updated = [...images];
    updated[index] = {
      ...updated[index],
      annotation_json: annotations,
    };
    onImagesChange(updated);
  };

  const removeFile = (localId: string) => {
    onFilesChange(files.filter((file) => file.local_id !== localId));
  };

  const handleDrag = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(event.type === "dragenter" || event.type === "dragover");
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    handleFileSelect(event.dataTransfer.files);
  };

  const getStatusIcon = (status?: UploadStatus) => {
    switch (status) {
      case 'uploading':
        return <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" />;
      case 'failed':
        return <AlertCircle className="h-3 w-3 text-red-400" />;
      case 'uploaded':
        return <div className="h-3 w-3 bg-green-500 rounded-full" />;
      default:
        return null;
    }
  };

  const inferComplianceTypeFromName = (name?: string) => {
    const normalized = (name || "").replace(/[_\-\.]/g, " ").toLowerCase();
    if (!normalized) return null;
    if (/\bfire\b.*\bcertificate\b/.test(normalized)) return "Fire Certificate";
    if (/\bgas\b.*\bsafety\b/.test(normalized) || /\bgas\s*safe\b/.test(normalized)) {
      return "Gas Safety Certificate";
    }
    if (/\belectrical\b.*\bcertificate\b/.test(normalized)) return "Electrical Certificate";
    if (/\beicr\b/.test(normalized)) return "EICR";
    if (/\bepc\b/.test(normalized)) return "EPC";
    if (/\bpat\b/.test(normalized)) return "PAT Test";
    if (/\bcertificate\b|\binspection\b/.test(normalized)) return "Safety Certificate";
    return null;
  };

  const inferExpiryFromText = (text?: string) => {
    const value = (text || "").trim();
    if (!value) return null;

    const patterns = [
      /\b(?:expiry|expires|expiration|valid until|renewal|renew by|due)\b[^\dA-Za-z]{0,12}(\d{4}-\d{2}-\d{2})/i,
      /\b(?:expiry|expires|expiration|valid until|renewal|renew by|due)\b[^\dA-Za-z]{0,12}(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i,
      /\b(?:expiry|expires|expiration|valid until|renewal|renew by|due)\b[^\dA-Za-z]{0,12}(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/i,
      /\b(?:expiry|expires|expiration|valid until|renewal|renew by|due)\b[^\dA-Za-z]{0,12}([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/i,
    ];

    for (const pattern of patterns) {
      const match = value.match(pattern);
      if (match?.[1]) return match[1].trim();
    }

    return null;
  };

  const formatDisplayDate = (value?: string | null) => {
    if (!value) return null;
    const normalized = value.trim();
    if (!normalized) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      const parsed = new Date(`${normalized}T00:00:00`);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
      }
    }

    if (/^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}$/.test(normalized)) {
      const parts = normalized.split(/[\/.-]/).map((part) => part.trim());
      const [day, month, year] = parts;
      if (day && month && year) {
        const fullYear = year.length === 2 ? `20${year}` : year;
        const parsed = new Date(`${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T00:00:00`);
        if (!Number.isNaN(parsed.getTime())) {
          return parsed.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          });
        }
      }
    }

    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }

    return normalized;
  };

  type IntakePanelState =
    | { kind: "upload_failed" }
    | { kind: "preparing" }
    | { kind: "router_scanning" }
    | { kind: "full_scanning" }
    | { kind: "full_done"; specificType: string | null; formattedExpiryDate: string | null }
    | { kind: "router_ui"; branch: "task" | "compliance" | "uncertain"; confidence?: number };

  const getIntakePanelState = (image: TempImage): IntakePanelState => {
    if (image.upload_status === "failed") return { kind: "upload_failed" };
    const webpReady = image.thumbnail_blob?.type === "image/webp";
    if (!webpReady) return { kind: "preparing" };
    if (image.intakeFullAnalysisPending) return { kind: "full_scanning" };
    if (!image.rawAnalysis) return { kind: "router_scanning" };

    const meta = image.rawAnalysis.metadata as
      | {
          intake_stage?: string;
          router_mode?: boolean;
          workflow_hint?: string;
          workflow_confidence?: number;
          normalized_document_type?: string;
          document_classification?: { type?: string; expiry_date?: string };
        }
      | undefined;

    const isFullStage = meta?.intake_stage === "full";
    const isRouterStage = meta?.intake_stage === "router" || meta?.router_mode === true;
    const legacyFull = Boolean(image.rawAnalysis) && !isRouterStage && meta?.intake_stage !== "router";

    if (isFullStage || legacyFull) {
      const specificType =
        meta?.normalized_document_type ||
        meta?.document_classification?.type ||
        inferComplianceTypeFromName(image.display_name);
      const expiryDate =
        meta?.document_classification?.expiry_date ||
        image.rawAnalysis.detected_objects?.find((obj) => obj.expiry_date)?.expiry_date ||
        inferExpiryFromText(image.aiOcrText);
      return {
        kind: "full_done",
        specificType: specificType ?? null,
        formattedExpiryDate: formatDisplayDate(expiryDate),
      };
    }

    const hint = String(meta?.workflow_hint ?? "uncertain").toLowerCase();
    const conf =
      typeof meta?.workflow_confidence === "number" && Number.isFinite(meta.workflow_confidence)
        ? meta.workflow_confidence
        : undefined;

    if (image.intakeUserPrefersTask) {
      return { kind: "router_ui", branch: "task", confidence: conf };
    }
    if (hint === "compliance" || hint === "document") {
      return { kind: "router_ui", branch: "compliance", confidence: conf };
    }
    if (hint === "task") {
      return { kind: "router_ui", branch: "task", confidence: conf };
    }
    return { kind: "router_ui", branch: "uncertain", confidence: conf };
  };

  const confidenceCaption = (c?: number) => {
    if (c === undefined) return null;
    const pct = Math.round(Math.max(0, Math.min(1, c)) * 100);
    return `${pct}% confidence`;
  };

  return (
    <div className={cn("space-y-3", images.length === 0 && files.length === 0 && "min-h-[65px]")}>
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !dragActive && fileInputRef.current?.click()}
        className={cn(
          "relative min-h-[65px] rounded-[12px] border-2 border-dashed border-white/90 bg-muted/35 transition-colors",
          "flex items-start justify-start px-4 pr-[88px] pt-[13px] pb-5 cursor-pointer",
          dragActive && "bg-primary/15 border-white"
        )}
      >
        <div className="text-left min-w-0 flex-1 pointer-events-none">
          <p className="text-[12px] font-normal text-muted-foreground pr-[5px] leading-[17px]">
            {intakeMode === "add_record"
              ? "Add certificate, inspection, or document — drag & drop or choose file"
              : "Add photos or files — capture the issue (drag & drop or choose)"}
          </p>
          <p className="mt-1 text-[10px] text-primary">50 MB max file size</p>
        </div>
        <div className="absolute top-3 right-3 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              cameraInputRef.current?.click();
            }}
            className="h-[35px] w-[35px] rounded-[8px] flex items-center justify-center bg-muted/60 shadow-e1 hover:shadow-e2 transition-all"
            title="Take photo"
          >
            <Camera className="h-5 w-5 text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="h-[35px] w-[35px] rounded-[8px] flex items-center justify-center bg-muted/60 shadow-e1 hover:shadow-e2 transition-all"
            title="Upload file"
          >
            <Upload className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {images.length > 0 && (
        <div className="space-y-2">
          {images.map((image, idx) => {
            const panel = getIntakePanelState(image);

            return (
              <div
                key={image.local_id}
                className="flex items-stretch gap-2 rounded-[10px] bg-muted/25 p-1.5"
              >
                <div className="relative group h-[88px] w-[88px] shrink-0 rounded-[8px] overflow-hidden shadow-e1">
                  <img
                    src={image.thumbnail_url}
                    alt={image.display_name}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-destructive/90 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingImageIndex(idx);
                      setShowAnnotationEditor(true);
                    }}
                    className="absolute bottom-1 right-1 p-1.5 bg-black/50 hover:bg-black/70 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Annotate image"
                  >
                    <SquarePen className="h-3 w-3" />
                  </button>
                  {image.upload_status && image.upload_status !== "pending" && (
                    <div className="absolute top-1 left-1 p-1 bg-black/50 rounded">
                      {getStatusIcon(image.upload_status)}
                    </div>
                  )}
                  {image.annotation_json && image.annotation_json.length > 0 && (
                    <div className="absolute bottom-1 left-1 text-[10px] font-mono text-white bg-black/50 px-1 rounded">
                      {image.annotation_json.length}
                    </div>
                  )}
                </div>

                {panel.kind === "upload_failed" ? (
                  <div className="min-w-0 flex-1 rounded-[8px] bg-background/55 px-3 py-2 shadow-engraved">
                    <p className="truncate text-xs font-medium text-foreground">{image.display_name}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {image.upload_error || "Image processing failed."}
                    </p>
                  </div>
                ) : (
                  <div className="min-w-0 flex-1 rounded-[8px] px-3 py-2 shadow-e1 bg-background/40">
                    {panel.kind === "preparing" && (
                      <p className="text-[12px] text-muted-foreground">Preparing image…</p>
                    )}
                    {panel.kind === "router_scanning" && (
                      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                        <span>Scanning…</span>
                      </div>
                    )}
                    {panel.kind === "full_scanning" && (
                      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                        <span>Running compliance scan…</span>
                      </div>
                    )}
                    {panel.kind === "router_ui" && panel.branch === "task" && (
                      <div className="space-y-2">
                        <p className="text-[13px] font-medium text-foreground">This looks like a task</p>
                        {confidenceCaption(panel.confidence) ? (
                          <p className="text-[10px] text-muted-foreground">{confidenceCaption(panel.confidence)}</p>
                        ) : null}
                        {onRunFullIntakeAnalysis ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-[11px] text-primary hover:text-primary shadow-none"
                            onClick={() => void onRunFullIntakeAnalysis(image.local_id)}
                          >
                            Scan as compliance instead
                          </Button>
                        ) : null}
                      </div>
                    )}
                    {panel.kind === "router_ui" && panel.branch === "compliance" && (
                      <div className="space-y-2">
                        <p className="text-[13px] font-medium text-foreground">This may be a compliance document</p>
                        {confidenceCaption(panel.confidence) ? (
                          <p className="text-[10px] text-muted-foreground">{confidenceCaption(panel.confidence)}</p>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-2">
                          {onRunFullIntakeAnalysis ? (
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 text-[11px] shadow-primary-btn"
                              onClick={() => void onRunFullIntakeAnalysis(image.local_id)}
                            >
                              Begin compliance scan
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-[11px] text-muted-foreground"
                            onClick={() => onPatchImage?.(image.local_id, { intakeUserPrefersTask: true })}
                          >
                            Create task instead
                          </Button>
                        </div>
                      </div>
                    )}
                    {panel.kind === "router_ui" && panel.branch === "uncertain" && (
                      <div className="space-y-2">
                        <p className="text-[13px] font-medium text-foreground">What would you like to do with this?</p>
                        <p className="text-[12px] text-muted-foreground">This looks like a task</p>
                        {confidenceCaption(panel.confidence) ? (
                          <p className="text-[10px] text-muted-foreground">{confidenceCaption(panel.confidence)}</p>
                        ) : null}
                        {onRunFullIntakeAnalysis ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-[11px] text-primary hover:text-primary shadow-none"
                            onClick={() => void onRunFullIntakeAnalysis(image.local_id)}
                          >
                            Scan for compliance
                          </Button>
                        ) : null}
                      </div>
                    )}
                    {panel.kind === "full_done" && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[12px] text-foreground">
                          <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />
                          <span className="font-medium">Compliance scan complete</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {panel.specificType ? (
                            <div className="inline-flex rounded-[5px] bg-[#f6f4f2] px-[9px] py-1 text-[11px] font-medium text-foreground shadow-sm">
                              {panel.specificType}
                            </div>
                          ) : (
                            <p className="text-[11px] text-muted-foreground">No specific certificate type detected.</p>
                          )}
                          {panel.formattedExpiryDate ? (
                            <div className="inline-flex items-center gap-1 rounded-full bg-background/80 px-2 py-1 text-[11px] font-medium text-foreground shadow-e1">
                              <CalendarDays className="h-3.5 w-3.5 text-primary" />
                              <span>Expiry {panel.formattedExpiryDate}</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.local_id}
              className="flex items-center gap-2 rounded-[8px] bg-muted/40 px-3 py-2 shadow-e1"
            >
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">{file.display_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {(file.file_size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeFile(file.local_id)}
                className="p-1 rounded-full hover:bg-muted"
                title="Remove file"
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept={
          intakeMode === "add_record"
            ? ".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,image/*"
            : "image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
        }
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />

      {/* Annotation Editor - works with temp images */}
      {showAnnotationEditor && editingImageIndex !== null && images[editingImageIndex] && (
        <TempImageAnnotationEditor
          tempImage={images[editingImageIndex]}
          onSave={(annotations, isAutosave) => {
            updateImageAnnotations(editingImageIndex, annotations);
            if (!isAutosave) {
              setShowAnnotationEditor(false);
              setEditingImageIndex(null);
            }
          }}
          onCancel={() => {
            setShowAnnotationEditor(false);
            setEditingImageIndex(null);
          }}
        />
      )}
    </div>
  );
}

// Annotation editor for temp images (before task creation)
function TempImageAnnotationEditor({
  tempImage,
  onSave,
  onCancel,
}: {
  tempImage: TempImage;
  onSave: (annotations: Annotation[], isAutosave: boolean) => void;
  onCancel: () => void;
}) {
  return (
    <ImageAnnotationEditor
      imageUrl={tempImage.optimized_url || tempImage.thumbnail_url || ''}
      imageId={tempImage.local_id} // Use local_id as identifier
      taskId={''} // No task yet
      initialAnnotations={tempImage.annotation_json || []}
      onSave={async (annotations, isAutosave) => {
        // For temp images, always save (autosave or manual)
        onSave(annotations, Boolean(isAutosave));
      }}
      onCancel={onCancel}
    />
  );
}
