/**
 * IntakeModal — Universal intake composer for task / compliance / document.
 * Single entry point: upload → understand → act. AI suggestions inline; never overwrites user text.
 * Reuses existing task/compliance creation underneath.
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useImageAnalysis } from "@/hooks/useImageAnalysis";
import { useIntakeAnalysis, type WorkflowHint } from "@/hooks/useIntakeAnalysis";
import { useChipSuggestions } from "@/hooks/useChipSuggestions";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useAIExtract } from "@/hooks/useAIExtract";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { FillaIcon } from "@/components/filla/FillaIcon";
import { ImageUploadSection, type PendingTaskFile } from "@/components/tasks/create/ImageUploadSection";
import { IntakeChipRow, type IntakeChipRowValues, type IntakeChipSlotId } from "@/components/intake/IntakeChipRow";
import { SubtaskList, type SubtaskData } from "@/components/tasks/subtasks";
import type { TempImage } from "@/types/temp-image";
import { cleanupTempImage } from "@/utils/image-optimization";
import { format, addDays, startOfDay } from "date-fns";

const INTAKE_COMPLIANCE_TYPES = [
  "Fire Certificate",
  "Gas Safety Certificate",
  "Electrical Certificate",
  "EICR",
  "PAT Test",
  "Other",
];

const PAPER_TEXTURE_STYLE: React.CSSProperties = {
  backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise-filter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.522\' numOctaves=\'1\' stitchTiles=\'stitch\'%3E%3C/feTurbulence%3E%3CfeColorMatrix type=\'saturate\' values=\'0\'%3E%3C/feColorMatrix%3E%3CfeComponentTransfer%3E%3CfeFuncR type=\'linear\' slope=\'0.468\'%3E%3C/feFuncR%3E%3CfeFuncG type=\'linear\' slope=\'0.468\'%3E%3C/feFuncG%3E%3CfeFuncB type=\'linear\' slope=\'0.468\'%3E%3C/feFuncB%3E%3CfeFuncA type=\'linear\' slope=\'0.137\'%3E%3C/feFuncA%3E%3C/feComponentTransfer%3E%3CfeComponentTransfer%3E%3CfeFuncR type=\'linear\' slope=\'1.323\' intercept=\'-0.207\'/%3E%3CfeFuncG type=\'linear\' slope=\'1.323\' intercept=\'-0.207\'/%3E%3CfeFuncB type=\'linear\' slope=\'1.323\' intercept=\'-0.207\'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise-filter)\' opacity=\'0.8\'%3E%3C/rect%3E%3C/svg%3E")',
  backgroundSize: "100%",
};

export interface IntakeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated?: (taskId: string) => void;
  defaultPropertyId?: string;
  variant?: "modal" | "column";
  headless?: boolean;
}

interface UploadedAttachment {
  id: string;
  fileUrl: string;
  fileName: string;
  isImage: boolean;
}

export function IntakeModal({
  open,
  onOpenChange,
  onTaskCreated,
  defaultPropertyId,
  variant = "modal",
  headless = false,
}: IntakeModalProps) {
  const { toast } = useToast();
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<TempImage[]>([]);
  const [taskFiles, setTaskFiles] = useState<PendingTaskFile[]>([]);
  const [userChoseWorkflow, setUserChoseWorkflow] = useState<WorkflowHint | null>(null);
  const [intakeComplianceType, setIntakeComplianceType] = useState("");
  const [intakeComplianceExpiry, setIntakeComplianceExpiry] = useState("");
  const [createReminderFromCompliance, setCreateReminderFromCompliance] = useState(false);
  const [openChipSlot, setOpenChipSlot] = useState<IntakeChipSlotId | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userEditedTitle, setUserEditedTitle] = useState(false);
  const [showTitleField, setShowTitleField] = useState(false);
  const [aiTitleGenerated, setAiTitleGenerated] = useState("");

  const { result: aiResult, loading: aiLoading } = useAIExtract(description);

  useEffect(() => {
    if (!aiResult?.title?.trim() || userEditedTitle) return;
    const raw = aiResult.title.trim();
    if (raw.length < 3) return;
    const processed = raw.charAt(0).toUpperCase() + raw.slice(1).replace(/[.!]+$/, "");
    setAiTitleGenerated(processed);
    if (!title.trim()) setTitle(processed);
    setShowTitleField(true);
  }, [aiResult?.title, userEditedTitle, title]);

  useEffect(() => {
    if (!description.trim()) {
      setShowTitleField(false);
      setUserEditedTitle(false);
      setTitle("");
      setAiTitleGenerated("");
    } else if (aiTitleGenerated && !userEditedTitle && !title.trim()) {
      setTitle(aiTitleGenerated);
      setShowTitleField(true);
    } else if (title.trim() && !showTitleField) {
      setShowTitleField(true);
    }
  }, [description, userEditedTitle, aiTitleGenerated, title, showTitleField]);

  const hasDescriptionDraft = Boolean(description.trim());
  const shouldShowTitleField = hasDescriptionDraft && (showTitleField || aiLoading || Boolean(title.trim()));

  // Chip row state (simplified: labels only for display; full IDs for submit)
  const [dueDate, setDueDate] = useState("");
  const [propertyId, setPropertyId] = useState(defaultPropertyId || "");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [priorityDefined, setPriorityDefined] = useState(false);
  const [assignedUserId, setAssignedUserId] = useState<string | undefined>();
  const [subtasks, setSubtasks] = useState<SubtaskData[]>([]);

  const handleAnalysisComplete = useCallback((localId: string, result: import("@/types/temp-image").ImageAnalysisResult) => {
    setImages((prev) =>
      prev.map((img) =>
        img.local_id === localId ? { ...img, rawAnalysis: result, aiOcrText: result.ocr_text, detectedLabels: result.detected_labels || [] } : img
      )
    );
  }, []);

  const { imageOcrText, detectedLabels } = useImageAnalysis({
    images,
    propertyId: propertyId || undefined,
    orgId: orgId ?? "",
    onAnalysisComplete: handleAnalysisComplete,
  });

  const detectedObjects = useMemo(
    () =>
      images.flatMap((img) =>
        (img.rawAnalysis?.detected_objects || []).map((o) => ({
          type: o.type,
          label: o.label,
          confidence: o.confidence,
          serial_number: o.serial_number,
          expiry_date: o.expiry_date,
        }))
      ),
    [images]
  );

  const { chips: chipSuggestions } = useChipSuggestions(
    {
      description,
      propertyId: propertyId || undefined,
      imageOcrText,
      detectedLabels,
      detectedObjects,
      selectedPersonId: assignedUserId,
    },
    { minDescriptionLength: 3 }
  );

  const { members } = useOrgMembers();

  useEffect(() => {
    const priorityChip = chipSuggestions.find((c) => c.type === "priority");
    if (!priorityChip?.label || priorityDefined) return;
    const raw = priorityChip.label.toLowerCase();
    if (raw.includes("urgent")) {
      setPriority("urgent");
      setPriorityDefined(true);
    } else if (raw.includes("high")) {
      setPriority("high");
      setPriorityDefined(true);
    } else if (raw.includes("low")) {
      setPriority("low");
      setPriorityDefined(true);
    } else if (raw.includes("normal") || raw.includes("medium")) {
      setPriority("medium");
      setPriorityDefined(true);
    }
  }, [chipSuggestions, priorityDefined]);

  // Auto-apply extracted date and person when we have resolved chips and field is still empty (so we don't overwrite user edits)
  useEffect(() => {
    const dateChip = chipSuggestions.find((c) => c.type === "date" && c.resolvedEntityId);
    if (!dueDate && dateChip?.resolvedEntityId && typeof dateChip.resolvedEntityId === "string") {
      const v = dateChip.resolvedEntityId;
      if (/^\d{4}-\d{2}-\d{2}/.test(v)) setDueDate(v.split("T")[0] || v);
    }
    const personChip = chipSuggestions.find((c) => (c.type === "person" || c.type === "team") && c.resolvedEntityId);
    if (!assignedUserId && personChip?.resolvedEntityId && typeof personChip.resolvedEntityId === "string") {
      setAssignedUserId(personChip.resolvedEntityId);
    }
  }, [chipSuggestions, dueDate, assignedUserId]);

  const analysis = useIntakeAnalysis({
    images,
    fileCount: taskFiles.length,
    composedText: description,
    userHasComposed: description.trim().length > 15,
  });

  const effectiveWorkflow: WorkflowHint =
    userChoseWorkflow ??
    (hasDescriptionDraft ? "task" : analysis.workflow_confidence >= 0.65 ? analysis.workflow_hint : "uncertain");
  const primaryIsTask = effectiveWorkflow === "task" || effectiveWorkflow === "uncertain";
  const primaryIsCompliance = effectiveWorkflow === "compliance";
  const primaryIsDocument = effectiveWorkflow === "document";

  useEffect(() => {
    if (primaryIsCompliance && analysis.document_type_hint && !intakeComplianceType) setIntakeComplianceType(analysis.document_type_hint);
    if (primaryIsCompliance && analysis.expiry_date_hint && !intakeComplianceExpiry) setIntakeComplianceExpiry(analysis.expiry_date_hint);
  }, [primaryIsCompliance, analysis.document_type_hint, analysis.expiry_date_hint, intakeComplianceType, intakeComplianceExpiry]);

  const chipValues: IntakeChipRowValues = useMemo(() => {
    const whenLabel = dueDate
      ? (() => {
          const d = dueDate.split("T")[0];
          const dateObj = d ? new Date(d + "T00:00:00") : new Date();
          const today = startOfDay(new Date());
          if (dateObj.getTime() === today.getTime()) return "Today";
          if (dateObj.getTime() === addDays(today, 1).getTime()) return "Tomorrow";
          return format(dateObj, "EEE d MMM");
        })()
      : (chipSuggestions.find((c) => c.type === "date")?.label ?? undefined);
    const priorityLabel = priorityDefined
      ? { low: "Low", medium: "Normal", high: "High", urgent: "Urgent" }[priority]
      : undefined;
    const whoLabel = assignedUserId
      ? (members?.find((m) => m.user_id === assignedUserId)?.display_name ?? "Assignee")
      : (chipSuggestions.find((c) => c.type === "person" || c.type === "team")?.label ?? undefined);
    const whereLabel = propertyId ? "Property" : (chipSuggestions.find((c) => c.type === "space")?.label ?? undefined);
    const assetLabel = chipSuggestions.find((c) => c.type === "asset")?.label;
    return {
      who: whoLabel ?? undefined,
      where: whereLabel ?? undefined,
      when: whenLabel ?? undefined,
      asset: assetLabel ?? undefined,
      priority: priorityLabel ?? undefined,
      category: chipSuggestions.find((c) => c.type === "category" || c.type === "theme")?.label ?? undefined,
      compliance: undefined,
    };
  }, [dueDate, propertyId, priority, priorityDefined, assignedUserId, chipSuggestions, members]);

  const renderSlotContent = useCallback(
    (slot: IntakeChipSlotId, onClose: () => void) => {
      if (slot === "when") {
        const today = startOfDay(new Date());
        const quick = [
          { label: "Today", date: format(today, "yyyy-MM-dd") },
          { label: "Tomorrow", date: format(addDays(today, 1), "yyyy-MM-dd") },
          { label: "+7D", date: format(addDays(today, 7), "yyyy-MM-dd") },
          { label: "+14D", date: format(addDays(today, 14), "yyyy-MM-dd") },
        ];
        return (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Due date</p>
            <div className="flex flex-wrap gap-1.5">
              {quick.map(({ label, date }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setDueDate(date);
                    onClose();
                  }}
                  className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-muted/60 hover:bg-muted"
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full mt-1 h-8 rounded border border-input bg-input px-2 text-xs"
            />
          </div>
        );
      }
      if (slot === "priority") {
        return (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Priority</p>
            {(["low", "medium", "high", "urgent"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setPriority(p);
                  setPriorityDefined(true);
                  onClose();
                }}
                className={cn(
                  "w-full text-left px-2 py-1.5 rounded text-xs",
                  priority === p ? "bg-primary/20 text-foreground" : "hover:bg-muted/60"
                )}
              >
                {p === "medium" ? "Normal" : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        );
      }
      return (
        <p className="text-xs text-muted-foreground py-1">
          {slot} — use full Create Task for full options.
        </p>
      );
    },
    [dueDate, priority]
  );

  const uploadIntakeAttachments = useCallback(
    async (params: {
      parentType: string;
      parentId: string;
      mode: "task" | "compliance" | "document";
      taskId?: string;
      complianceDocumentId?: string;
    }): Promise<UploadedAttachment[]> => {
      if (!orgId) return [];
      const { parentType, parentId, mode, taskId, complianceDocumentId } = params;
      const uploaded: UploadedAttachment[] = [];

      for (const tempImage of images) {
        try {
          const imageUuid = crypto.randomUUID();
          const basePath = `org/${orgId}/${parentType}/${parentId}/images/${imageUuid}`;
          const thumbnailPath = `${basePath}/thumb.webp`;
          const optimizedPath = `${basePath}/optimized.webp`;

          const { error: thumbError } = await supabase.storage
            .from("task-images")
            .upload(thumbnailPath, tempImage.thumbnail_blob, {
              contentType: tempImage.thumbnail_blob.type || "image/webp",
              cacheControl: "31536000",
            });
          if (thumbError) throw thumbError;

          const { error: optError } = await supabase.storage
            .from("task-images")
            .upload(optimizedPath, tempImage.optimized_blob, {
              contentType: tempImage.optimized_blob.type || "image/webp",
              cacheControl: "31536000",
            });
          if (optError) throw optError;

          const { data: thumbUrl } = supabase.storage.from("task-images").getPublicUrl(thumbnailPath);
          const { data: optUrl } = supabase.storage.from("task-images").getPublicUrl(optimizedPath);

          const { data: attachment, error: attachError } = await supabase
            .from("attachments")
            .insert({
              org_id: orgId,
              parent_type: parentType,
              parent_id: parentId,
              file_url: optUrl.publicUrl,
              thumbnail_url: thumbUrl.publicUrl,
              optimized_url: optUrl.publicUrl,
              file_name: tempImage.display_name,
              file_type: tempImage.optimized_blob.type || "image/webp",
              file_size: tempImage.optimized_blob.size,
              annotation_json: tempImage.annotation_json || [],
              upload_status: "complete",
            })
            .select("id,file_url,file_name")
            .single();

          if (attachError || !attachment?.id) throw attachError ?? new Error("Attachment insert failed");

          uploaded.push({
            id: attachment.id,
            fileUrl: attachment.file_url,
            fileName: attachment.file_name || tempImage.display_name,
            isImage: true,
          });

          if (mode === "task") {
            void supabase.functions.invoke("ai-image-analyse", {
              body: {
                attachment_id: attachment.id,
                file_url: attachment.file_url,
                org_id: orgId,
                property_id: propertyId || null,
                task_id: taskId || null,
              },
            });
          } else {
            void supabase.functions.invoke("ai-doc-analyse", {
              body: {
                attachment_id: attachment.id,
                file_url: attachment.file_url,
                file_name: attachment.file_name || tempImage.display_name,
                org_id: orgId,
                property_id: propertyId || null,
                compliance_document_id: complianceDocumentId || null,
              },
            });
          }
        } catch (error) {
          console.error("[IntakeModal] image upload failed:", error);
          toast({
            title: "Image upload failed",
            description: `Couldn't upload "${tempImage.display_name}".`,
            variant: "destructive",
          });
        }
      }

      for (const pendingFile of taskFiles) {
        try {
          const ext = pendingFile.display_name.split(".").pop() || "bin";
          const filePath = `org/${orgId}/${parentType}/${parentId}/files/${crypto.randomUUID()}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("task-images")
            .upload(filePath, pendingFile.file, {
              cacheControl: "31536000",
            });
          if (uploadError) throw uploadError;

          const { data: fileUrl } = supabase.storage.from("task-images").getPublicUrl(filePath);
          const { data: attachment, error: attachmentError } = await supabase
            .from("attachments")
            .insert({
              org_id: orgId,
              parent_type: parentType,
              parent_id: parentId,
              file_url: fileUrl.publicUrl,
              file_name: pendingFile.display_name,
              file_type: pendingFile.file_type,
              file_size: pendingFile.file_size,
              upload_status: "complete",
            })
            .select("id,file_url,file_name")
            .single();
          if (attachmentError || !attachment?.id) throw attachmentError ?? new Error("Attachment insert failed");

          uploaded.push({
            id: attachment.id,
            fileUrl: attachment.file_url,
            fileName: attachment.file_name || pendingFile.display_name,
            isImage: false,
          });

          if (mode !== "task") {
            void supabase.functions.invoke("ai-doc-analyse", {
              body: {
                attachment_id: attachment.id,
                file_url: attachment.file_url,
                file_name: attachment.file_name || pendingFile.display_name,
                org_id: orgId,
                property_id: propertyId || null,
                compliance_document_id: complianceDocumentId || null,
              },
            });
          }
        } catch (error) {
          console.error("[IntakeModal] file upload failed:", error);
          toast({
            title: "File upload failed",
            description: `Couldn't upload "${pendingFile.display_name}".`,
            variant: "destructive",
          });
        }
      }

      return uploaded;
    },
    [images, taskFiles, orgId, propertyId, toast]
  );

  const handleSubmit = async () => {
    if (!orgId) {
      toast({ title: "Not signed in", variant: "destructive" });
      return;
    }

    if (primaryIsCompliance) {
      const complianceTitle = title.trim() || description.trim().slice(0, 80) || "Compliance document";
      setIsSubmitting(true);
      try {
        const { data, error } = await supabase.functions.invoke("ai-actions-create-compliance", {
          body: {
            org_id: orgId,
            property_id: propertyId || null,
            title: complianceTitle,
            compliance_type: intakeComplianceType.trim() || null,
            expiry_date: intakeComplianceExpiry.trim() || null,
            attachment_id: null,
          },
        });
        if (error) throw error;
        if (!data?.id) throw new Error("No compliance record returned");

        const uploaded = await uploadIntakeAttachments({
          parentType: "compliance",
          parentId: data.id,
          mode: "compliance",
          complianceDocumentId: data.id,
        });

        if (uploaded.length > 0) {
          const links = uploaded.map((a) => ({
            attachment_id: a.id,
            compliance_document_id: data.id,
            org_id: orgId,
          }));
          const { error: linkError } = await supabase.from("attachment_compliance").insert(links);
          if (linkError) throw linkError;
        }

        queryClient.invalidateQueries({ queryKey: ["compliance"] });
        queryClient.invalidateQueries({ queryKey: ["compliance_recommendations"] });
        queryClient.invalidateQueries({ queryKey: ["property_documents"] });
        toast({ title: "Added to Compliance" });
        onOpenChange(false);
        resetForm();
      } catch (err: unknown) {
        toast({
          title: "Could not add to Compliance",
          description: err instanceof Error ? err.message : "Something went wrong",
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (primaryIsDocument) {
      if (!propertyId) {
        toast({
          title: "Select a location",
          description: "Choose a property before saving documents.",
          variant: "destructive",
        });
        return;
      }
      setIsSubmitting(true);
      try {
        await uploadIntakeAttachments({
          parentType: "property",
          parentId: propertyId,
          mode: "document",
        });
        queryClient.invalidateQueries({ queryKey: ["property_documents"] });
        toast({ title: "Document saved" });
        onOpenChange(false);
        resetForm();
      } catch (err: unknown) {
        toast({
          title: "Could not save document",
          description: err instanceof Error ? err.message : "Something went wrong",
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const finalTitle = title.trim() || aiTitleGenerated.trim() || description.trim().slice(0, 50) || "New task";
    if (!finalTitle) {
      toast({ title: "Add a title or note", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      let dueDateValue: string | null = null;
      if (dueDate) dueDateValue = new Date(dueDate).toISOString();

      const { data: newTask, error } = await supabase
        .from("tasks")
        .insert({
          org_id: orgId,
          title: finalTitle,
          description: description.trim() || null,
          property_id: propertyId || null,
          due_date: dueDateValue,
          priority: priority === "medium" ? "normal" : priority,
          assigned_user_id: assignedUserId || null,
          status: "open",
        })
        .select("id")
        .single();

      if (error) throw error;
      if (!newTask?.id) throw new Error("No task id returned");

      const normalizedSubtasks = subtasks
        .map((step, index) => ({
          task_id: newTask.id,
          org_id: orgId,
          title: step.title.trim(),
          is_yes_no: Boolean(step.is_yes_no),
          requires_signature: Boolean(step.requires_signature),
          order_index: index,
          is_completed: false,
          completed: false,
        }))
        .filter((step) => step.title.length > 0);

      if (normalizedSubtasks.length > 0) {
        const { error: subtaskError } = await supabase.from("subtasks").insert(normalizedSubtasks);
        if (subtaskError) throw subtaskError;
      }

      await uploadIntakeAttachments({
        parentType: "task",
        parentId: newTask.id,
        mode: "task",
        taskId: newTask.id,
      });

      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks-briefing"] });
      queryClient.invalidateQueries({ queryKey: ["task-attachments", newTask.id] });
      toast({ title: "Task created" });
      onTaskCreated?.(newTask.id);
      onOpenChange(false);
      resetForm();
    } catch (err: unknown) {
      toast({
        title: "Could not create task",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = useCallback(() => {
    setTitle("");
    setDescription("");
    setUserEditedTitle(false);
    setShowTitleField(false);
    setAiTitleGenerated("");
    setImages((prev) => {
      prev.forEach(cleanupTempImage);
      return [];
    });
    setTaskFiles([]);
    setUserChoseWorkflow(null);
    setIntakeComplianceType("");
    setIntakeComplianceExpiry("");
    setCreateReminderFromCompliance(false);
    setOpenChipSlot(null);
    setDueDate("");
    setPropertyId(defaultPropertyId || "");
    setPriority("medium");
    setPriorityDefined(false);
    setAssignedUserId(undefined);
    setSubtasks([]);
  }, [defaultPropertyId]);

  useEffect(() => {
    if (!open) resetForm();
  }, [open, resetForm]);

  const primaryLabel = primaryIsCompliance
    ? "Add to Compliance"
    : primaryIsDocument
      ? "Save Document"
      : "Create Task";
  const secondaryLabel =
    primaryIsCompliance
      ? "Create task instead"
      : primaryIsDocument
        ? "Create task instead"
        : "Add to Compliance instead";

  const content = (
    <>
      {variant !== "column" && (
        <DialogHeader className="px-4 pt-4 pb-2 border-b border-border/30">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">Add item</DialogTitle>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          {/* 1. Upload */}
          <ImageUploadSection
            images={images}
            onImagesChange={setImages}
            files={taskFiles}
            onFilesChange={setTaskFiles}
            taskId={undefined}
          />

          {/* 2. Composer: title (hidden until description; AI-generated) + main text */}
          <div className="space-y-2">
            {shouldShowTitleField && (
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setUserEditedTitle(true);
                  setTitle(e.target.value);
                  if (!e.target.value.trim()) setUserEditedTitle(false);
                }}
                placeholder="Generated title…"
                className="w-full h-9 px-3 rounded-lg bg-input shadow-engraved text-sm border-0 focus:ring-2 focus:ring-primary/30"
              />
            )}
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What needs doing? Or add a note…"
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-input shadow-engraved text-sm border-0 focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          {/* 3. Inline AI suggestion layer (compact; never overwrites composer) */}
          {(analysis.workflow_confidence >= 0.5 || chipSuggestions.length > 0) && (
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm">
                <FillaIcon size={14} className="shrink-0 text-primary" />
                <span>
                  {analysis.workflow_hint === "compliance" && "This looks like a compliance document."}
                  {analysis.workflow_hint === "task" && "Suggesting a task."}
                  {analysis.workflow_hint === "document" && "This could be saved as a document."}
                  {analysis.workflow_hint === "uncertain" && chipSuggestions.length > 0 && "Suggesting a task."}
                  {analysis.workflow_hint === "uncertain" && chipSuggestions.length === 0 && "Add a note or upload to get suggestions."}
                  {chipSuggestions.length > 0 && (analysis.workflow_hint === "task" || analysis.workflow_hint === "uncertain") && (
                    <span className="text-muted-foreground">
                      {" "}
                      Picked up: {chipSuggestions.slice(0, 6).map((c) => c.label).join(", ")}
                    </span>
                  )}
                </span>
              </div>
              {analysis.expiry_date_hint && primaryIsCompliance && (
                <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  Possible expiry: {analysis.expiry_date_hint}
                </div>
              )}
            </div>
          )}

          {/* 4. Compliance inline fields when path is compliance */}
          {primaryIsCompliance && (
            <div className="rounded-lg bg-muted/40 p-3 space-y-2 border border-border/50 shadow-e1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Compliance</p>
              <div className="grid gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Document type</Label>
                  <select
                    value={intakeComplianceType}
                    onChange={(e) => setIntakeComplianceType(e.target.value)}
                    className="mt-1 w-full h-9 rounded-lg border border-input bg-input px-2 text-sm"
                  >
                    <option value="">Select</option>
                    {INTAKE_COMPLIANCE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Expiry / renewal</Label>
                  <input
                    type="date"
                    value={intakeComplianceExpiry}
                    onChange={(e) => setIntakeComplianceExpiry(e.target.value)}
                    className="mt-1 w-full h-9 rounded-lg border border-input bg-input px-2 text-sm"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createReminderFromCompliance}
                    onChange={(e) => setCreateReminderFromCompliance(e.target.checked)}
                    className="rounded border-input"
                  />
                  Create reminder task
                </label>
              </div>
            </div>
          )}

          {/* 5. Context chip row (compact horizontal) */}
          <IntakeChipRow
            values={chipValues}
            onOpenSlot={setOpenChipSlot}
            openSlot={openChipSlot}
            onCloseSlot={() => setOpenChipSlot(null)}
            renderSlotContent={renderSlotContent}
          />

          {/* 6. Task steps/checklist (hidden until user starts describing work) */}
          {hasDescriptionDraft && (
            <div className="rounded-lg bg-muted/35 p-3 border border-border/50 shadow-e1 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Checklist</p>
                <button
                  type="button"
                  onClick={() =>
                    setSubtasks((prev) => [
                      ...prev,
                      {
                        id: crypto.randomUUID(),
                        title: "",
                        is_yes_no: false,
                        requires_signature: false,
                        step_type: "check",
                      },
                    ])
                  }
                  className="text-xs text-primary hover:underline"
                >
                  + Add step
                </button>
              </div>
              {subtasks.length === 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    setSubtasks([
                      {
                        id: crypto.randomUUID(),
                        title: "",
                        is_yes_no: false,
                        requires_signature: false,
                        step_type: "check",
                      },
                    ])
                  }
                  className="w-full rounded-md border border-dashed border-border/60 bg-background/40 px-3 py-2 text-left text-sm text-muted-foreground hover:bg-background/60 transition-colors"
                >
                  Add first checklist step
                </button>
              ) : (
                <SubtaskList subtasks={subtasks} isCreator={true} onSubtasksChange={setSubtasks} />
              )}
            </div>
          )}
      </div>

      {/* 7. Footer: one adaptive primary + secondary override */}
      <div className="px-4 py-3 border-t border-border/30 space-y-2">
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 shadow-e1" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button className="flex-1 shadow-primary-btn" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : primaryLabel}
          </Button>
        </div>
        {analysis.workflow_confidence >= 0.5 && (
          <div className="text-center">
            <button
              type="button"
              onClick={() =>
                setUserChoseWorkflow(
                  primaryIsCompliance ? "task" : primaryIsDocument ? "task" : "compliance"
                )
              }
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              {secondaryLabel}
            </button>
          </div>
        )}
      </div>
    </>
  );

  if (variant === "column" && headless) {
    return (
      <div
        className={cn(
          "flex flex-col h-full min-h-0 p-0 gap-0 rounded-xl border-0",
          "shadow-[3px_5px_8px_rgba(174,174,178,0.25),-3px_-3px_6px_rgba(255,255,255,0.7)]"
        )}
        style={{
          ...PAPER_TEXTURE_STYLE,
          backgroundColor: "hsl(var(--background))",
        }}
      >
        {content}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-lg max-h-[90vh] flex flex-col p-0 gap-0",
          "rounded-xl border-0 shadow-[3px_5px_8px_rgba(174,174,178,0.25),-3px_-3px_6px_rgba(255,255,255,0.7)]"
        )}
        style={{
          ...PAPER_TEXTURE_STYLE,
          backgroundColor: "hsl(var(--background))",
        }}
      >
        {content}
      </DialogContent>
    </Dialog>
  );
}
