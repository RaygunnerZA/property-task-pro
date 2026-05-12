/**
 * useCreateTaskSubmit
 *
 * Owns the full task-creation submit pipeline extracted from CreateTaskModal.tsx:
 *  1. Chip/input validation (blocking chips, property requirement, empty title)
 *  2. JIT ghost-entity materialisation (ghost-space-*, ghost-theme-*)
 *  3. Core task row via useCreateTaskMutation
 *  4. Background image + file uploads → attachment records
 *  5. Junction table writes: task_spaces, task_themes, task_teams, task_assets
 *  6. Success toast, form reset, modal close, onTaskCreated callback
 *
 * No JSX. No component state — all inputs are passed in by the modal.
 *
 * Extracted from CreateTaskModal.tsx (Tier 3 — gap-submit).
 */

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCreateTaskMutation, type TaskCreatedSource } from "@/hooks/mutations/useCreateTaskMutation";
import { cleanupTempImage } from "@/utils/image-optimization";
import type { SuggestedChip } from "@/types/chip-suggestions";
import type { TempImage } from "@/types/temp-image";
import type { TaskPriority, RepeatRule } from "@/types/database";
import type { MilestoneItem } from "./WhenSection";
import type { SubtaskInput } from "./SubtasksSection";
import type { PendingTaskFile } from "./ImageUploadSection";
import type { PendingInvitation } from "./tabs/WhoTab";
import type { CreateTaskPrefill } from "../CreateTaskModal";

export interface UseCreateTaskSubmitProps {
  // Auth
  orgId: string | null;
  orgLoading: boolean;
  // Form fields
  title: string;
  description: string;
  propertyId: string;
  selectedPropertyIds: string[];
  selectedSpaceIds: string[];
  selectedThemeIds: string[];
  selectedAssetIds: string[];
  priority: TaskPriority;
  dueDate: string;
  milestones: MilestoneItem[];
  assignedUserId: string | undefined;
  assignedTeamIds: string[];
  pendingInvitations: PendingInvitation[];
  images: TempImage[];
  taskFiles: PendingTaskFile[];
  subtasks: SubtaskInput[];
  // AI pipeline outputs
  appliedChips: Map<string, SuggestedChip>;
  aiTitleGenerated: string;
  chipSuggestedIcon: string | undefined | null;
  generateVerbLabel: (chip: SuggestedChip) => string;
  // Modal metadata
  prefill: CreateTaskPrefill | null | undefined;
  taskCreatedSource: TaskCreatedSource | undefined;
  // Callbacks
  resetForm: () => void;
  onOpenChange: (open: boolean) => void;
  onTaskCreated?: (taskId: string) => void;
}

export function useCreateTaskSubmit({
  orgId,
  orgLoading,
  title,
  description,
  propertyId,
  selectedPropertyIds,
  selectedSpaceIds,
  selectedThemeIds,
  selectedAssetIds,
  priority,
  dueDate,
  milestones,
  assignedUserId,
  assignedTeamIds,
  pendingInvitations,
  images,
  taskFiles,
  appliedChips,
  aiTitleGenerated,
  chipSuggestedIcon,
  generateVerbLabel,
  prefill,
  taskCreatedSource,
  resetForm,
  onOpenChange,
  onTaskCreated,
}: UseCreateTaskSubmitProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createTaskMutation = useCreateTaskMutation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    // ── Chip validation ──────────────────────────────────────────────────────

    const unresolvedActionChips = Array.from(appliedChips.values()).filter(
      (chip) => chip.blockingRequired && !chip.resolvedEntityId
    );
    const unresolvedInviteChips = unresolvedActionChips.filter((chip) => chip.type === "person");

    if (unresolvedActionChips.length > 0) {
      const actionLabels = unresolvedActionChips.map((chip) => generateVerbLabel(chip));
      const actionLabel = generateVerbLabel(unresolvedActionChips[0]);
      const inviteMessage =
        unresolvedInviteChips.length > 0
          ? unresolvedInviteChips.length === 1
            ? `Invite "${unresolvedInviteChips[0].label}" to assign this task, or choose an existing contact.`
            : `${unresolvedInviteChips.length} invites need resolution before submission.`
          : null;
      toast({
        title: "Resolve action items first",
        description:
          inviteMessage ||
          (unresolvedActionChips.length === 1
            ? `${actionLabel} before creating this task.`
            : `${actionLabels.length} action items need resolution: ${actionLabels.slice(0, 2).join(", ")}${actionLabels.length > 2 ? "..." : ""}`),
        variant: "destructive",
      });
      return;
    }

    const hasSpaceOrAssetChips = Array.from(appliedChips.values()).some(
      (c) => c.type === "space" || c.type === "asset"
    );
    if (hasSpaceOrAssetChips && !propertyId) {
      toast({ title: "Pick a property", description: "Choose a property when adding spaces or assets.", variant: "destructive" });
      return;
    }

    // ── Title resolution ─────────────────────────────────────────────────────

    let finalTitle = title.trim();
    if (!finalTitle) {
      if (aiTitleGenerated?.trim()) {
        finalTitle = aiTitleGenerated.trim();
      } else if (description.trim()) {
        finalTitle = description.trim().substring(0, 50);
        if (description.trim().length > 50) finalTitle += "...";
      }
    }
    if (!finalTitle.trim()) {
      toast({ title: "Add a description", description: "Enter a task title or description to continue.", variant: "destructive" });
      return;
    }

    // ── Auth guards ───────────────────────────────────────────────────────────

    if (orgLoading) {
      toast({ title: "Loading", description: "Please wait while we verify your account.", variant: "default" });
      return;
    }
    if (!orgId) {
      toast({ title: "Not signed in", description: "Log in to create tasks.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      // ── JIT ghost entity materialisation ─────────────────────────────────

      let resolvedSpaceIds = [...selectedSpaceIds];
      let resolvedThemeIds = [...selectedThemeIds];

      const ghostSpaces = selectedSpaceIds.filter((id) => id.startsWith("ghost-space-"));
      for (const ghostId of ghostSpaces) {
        const spaceName = ghostId.replace("ghost-space-", "");
        if (selectedPropertyIds.length === 0) throw new Error(`Can't create space "${spaceName}" without picking a property`);
        const { data: newSpace, error: spaceError } = await supabase
          .from("spaces")
          .insert({ org_id: orgId, property_id: selectedPropertyIds[0], name: spaceName })
          .select("id")
          .single();
        if (spaceError) throw new Error(`Couldn't create space "${spaceName}": ${spaceError.message}`);
        if (!newSpace) throw new Error(`Couldn't create space "${spaceName}": no data returned`);
        resolvedSpaceIds = resolvedSpaceIds.map((id) => (id === ghostId ? newSpace.id : id));
        toast({ title: "Created new Space", description: spaceName });
      }

      const ghostThemes = selectedThemeIds.filter((id) => id.startsWith("ghost-theme-"));
      for (const ghostId of ghostThemes) {
        const match = ghostId.match(/^ghost-theme-(.+?)-(.+)$/);
        if (!match) { console.warn(`Invalid ghost theme ID format: ${ghostId}`); continue; }
        const [, themeName, themeType] = match;
        const { data: newTheme, error: themeError } = await supabase
          .from("themes")
          .insert({ org_id: orgId, name: themeName, type: themeType as "category" | "project" | "tag" | "group" })
          .select("id")
          .single();
        if (themeError) throw new Error(`Couldn't create theme "${themeName}": ${themeError.message}`);
        if (!newTheme) throw new Error(`Couldn't create theme "${themeName}": no data returned`);
        resolvedThemeIds = resolvedThemeIds.map((id) => (id === ghostId ? newTheme.id : id));
        toast({ title: "Created new Theme", description: themeName });
      }

      // ── Core task insert ──────────────────────────────────────────────────

      const isPendingInvitation = assignedUserId?.startsWith("pending-");
      const finalAssignedUserId = assignedUserId && !isPendingInvitation ? assignedUserId : null;
      const analyticsSource = taskCreatedSource ?? (prefill ? "ai" : "manual");
      const dueDateValue = dueDate ? new Date(dueDate).toISOString() : null;

      const newTask = await createTaskMutation.mutateAsync({
        source: analyticsSource,
        insert: {
          org_id: orgId,
          title: finalTitle,
          property_id: propertyId || null,
          priority,
          due_date: dueDateValue,
          milestones: milestones.length > 0 ? milestones : [],
          description: description.trim() || null,
          assigned_user_id: finalAssignedUserId,
          status: "open",
          icon_name: chipSuggestedIcon || null,
        },
      });

      const taskId = newTask.id;

      // ── Background attachment uploads ─────────────────────────────────────

      const imagesToUpload = [...images];
      const filesToUpload = [...taskFiles];

      if ((imagesToUpload.length > 0 || filesToUpload.length > 0) && taskId && orgId) {
        const imageUploadPromises = imagesToUpload.map(async (tempImage) => {
          try {
            const imageUuid = crypto.randomUUID();
            const basePath = `org/${orgId}/tasks/${taskId}/images/${imageUuid}`;
            const thumbnailPath = `${basePath}/thumb.webp`;
            const optimizedPath = `${basePath}/optimized.webp`;

            const { error: thumbError } = await supabase.storage
              .from("task-images")
              .upload(thumbnailPath, tempImage.thumbnail_blob, { contentType: "image/webp", cacheControl: "31536000" });
            if (thumbError) throw thumbError;

            const { error: optError } = await supabase.storage
              .from("task-images")
              .upload(optimizedPath, tempImage.optimized_blob, { contentType: "image/webp", cacheControl: "31536000" });
            if (optError) throw optError;

            const { data: thumbUrl } = supabase.storage.from("task-images").getPublicUrl(thumbnailPath);
            const { data: optUrl } = supabase.storage.from("task-images").getPublicUrl(optimizedPath);

            const { data: attachment, error: attachError } = await supabase
              .from("attachments")
              .insert({
                org_id: orgId,
                parent_type: "task",
                parent_id: taskId,
                file_url: optUrl.publicUrl,
                thumbnail_url: thumbUrl.publicUrl,
                optimized_url: optUrl.publicUrl,
                file_name: tempImage.display_name,
                file_type: "image/webp",
                file_size: tempImage.optimized_blob.size,
                annotation_json: tempImage.annotation_json || [],
                upload_status: "complete",
              })
              .select()
              .single();
            if (attachError) throw attachError;

            if (tempImage.annotation_json?.length && attachment) {
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase as any).from("task_image_annotations").insert({
                  task_id: taskId,
                  image_id: attachment.id,
                  created_by: user.id,
                  annotations: tempImage.annotation_json,
                });
              }
            }

            cleanupTempImage(tempImage);

            // Phase 2: fire-and-forget post-upload AI analysis
            if (attachment?.id) {
              supabase.functions
                .invoke("ai-image-analyse", {
                  body: { attachment_id: attachment.id, file_url: optUrl.publicUrl, org_id: orgId, property_id: propertyId || null, task_id: taskId },
                })
                .then(({ error }) => { if (error) console.warn("[useCreateTaskSubmit] Post-upload analysis failed:", error); })
                .catch(() => {});
            }

            return attachment;
          } catch (err) {
            console.error("Error uploading image:", err);
            toast({ title: "Image upload failed", description: `Couldn't upload "${tempImage.display_name}". You can retry later.`, variant: "destructive" });
            return null;
          }
        });

        const fileUploadPromises = filesToUpload.map(async (pendingFile, index) => {
          try {
            const fileExt = pendingFile.display_name.split(".").pop() || "bin";
            const filePath = `org/${orgId}/tasks/${taskId}/files/${crypto.randomUUID()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from("task-images").upload(filePath, pendingFile.file, { cacheControl: "31536000" });
            if (uploadError) throw uploadError;
            const { data: fileUrl } = supabase.storage.from("task-images").getPublicUrl(filePath);
            const { error: attachmentError } = await supabase.from("attachments").insert({
              org_id: orgId, parent_type: "task", parent_id: taskId,
              file_url: fileUrl.publicUrl, file_name: pendingFile.display_name,
              file_type: pendingFile.file_type, file_size: pendingFile.file_size, upload_status: "complete",
            });
            if (attachmentError) throw attachmentError;
            return pendingFile;
          } catch (err) {
            console.error(`Error uploading file ${index}:`, err);
            toast({ title: "File upload failed", description: `Couldn't upload "${pendingFile.display_name}". You can retry later.`, variant: "destructive" });
            return null;
          }
        });

        Promise.all([...imageUploadPromises, ...fileUploadPromises]).then(() => {
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
          queryClient.invalidateQueries({ queryKey: ["tasks-briefing"] });
          queryClient.invalidateQueries({ queryKey: ["task-attachments", taskId] });
          queryClient.invalidateQueries({ queryKey: ["task-details", orgId, taskId] });
        });
      }

      // ── Junction table writes ─────────────────────────────────────────────

      if (resolvedSpaceIds.length > 0) {
        const { error } = await supabase.from("task_spaces").insert(resolvedSpaceIds.map((space_id) => ({ task_id: taskId, space_id })));
        if (error) console.error("Error linking spaces to task:", error);
      }

      if (resolvedThemeIds.length > 0) {
        const { error } = await supabase.from("task_themes").insert(resolvedThemeIds.map((theme_id) => ({ task_id: taskId, theme_id })));
        if (error) console.error("[useCreateTaskSubmit] Error linking themes to task:", error);
      }

      if (assignedTeamIds.length > 0) {
        const { error } = await supabase.from("task_teams").insert(assignedTeamIds.map((team_id) => ({ task_id: taskId, team_id })));
        if (error) console.error("[useCreateTaskSubmit] Error linking teams to task:", error);
      }

      const realAssetIds = selectedAssetIds.filter((id) => !id.startsWith("ghost-"));
      if (realAssetIds.length > 0) {
        const { error } = await supabase.from("task_assets").insert(realAssetIds.map((asset_id) => ({ task_id: taskId, asset_id })));
        if (error) console.error("[useCreateTaskSubmit] Error linking assets to task:", error);
      }

      // ── Post-create query invalidation ────────────────────────────────────

      if (imagesToUpload.length > 0 || filesToUpload.length > 0) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
          queryClient.invalidateQueries({ queryKey: ["tasks-briefing"] });
          queryClient.invalidateQueries({ queryKey: ["task-attachments", taskId] });
          queryClient.invalidateQueries({ queryKey: ["task-details", orgId, taskId] });
        }, 2000);
      } else {
        queryClient.invalidateQueries({ queryKey: ["task-attachments", taskId] });
        queryClient.invalidateQueries({ queryKey: ["task-details", orgId, taskId] });
      }

      // ── Success ───────────────────────────────────────────────────────────

      const createdEntities: string[] = [];
      if (ghostSpaces.length > 0) createdEntities.push(`${ghostSpaces.length} space${ghostSpaces.length > 1 ? "s" : ""}`);
      if (ghostThemes.length > 0) createdEntities.push(`${ghostThemes.length} theme${ghostThemes.length > 1 ? "s" : ""}`);

      toast({
        title: "Task created",
        description: createdEntities.length > 0
          ? `Task created. Created new ${createdEntities.join(" and ")}.`
          : "Your task has been added successfully.",
      });

      resetForm();
      onOpenChange(false);
      onTaskCreated?.(taskId);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Something didn't work. Try again.";
      console.error("Create task failed:", error);
      toast({ title: "Couldn't create task", description: msg, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  // The callback deps are stable refs or primitives; exhaustive-deps would be noisy here
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    orgId, orgLoading, title, description, propertyId, selectedPropertyIds,
    selectedSpaceIds, selectedThemeIds, selectedAssetIds, priority, dueDate,
    milestones, assignedUserId, assignedTeamIds, pendingInvitations,
    images, taskFiles, appliedChips, aiTitleGenerated, chipSuggestedIcon,
    generateVerbLabel, prefill, taskCreatedSource, resetForm, onOpenChange, onTaskCreated,
  ]);

  return { handleSubmit, isSubmitting };
}
