import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { X, ChevronDown, ChevronUp, User, Calendar, MapPin, AlertTriangle, Shield, Box, Tag, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

// Tab Components (keeping for backward compatibility during transition)
import { type PendingInvitation } from "./create/tabs/WhoTab";
import { WhenTab } from "./create/tabs/WhenTab";
import { WhereTab } from "./create/tabs/WhereTab";
import { PriorityTab } from "./create/tabs/PriorityTab";

// New Panel Components
import { WhoPanel } from "./create/panels/WhoPanel";
import { ClarityState } from "./create/ClarityState";
import { FillaIcon } from "@/components/filla/FillaIcon";
import type { SuggestedChip } from "@/types/chip-suggestions";
// Section Components
import { SubtasksSection, type SubtaskInput } from "./create/SubtasksSection";
import { ImageUploadSection, type PendingTaskFile } from "./create/ImageUploadSection";
import { ThemesSection } from "./create/ThemesSection";
import { AssetsSection } from "./create/AssetsSection";
import { CreateTaskRow } from "./create/CreateTaskRow";
import { WhoSection } from "./create/WhoSection";
import { WhenSection, type MilestoneItem } from "./create/WhenSection";
import { WhereSection } from "./create/WhereSection";
import { AssetSection } from "./create/AssetSection";
import { CategorySection } from "./create/CategorySection";
import { InviteUserModal } from "@/components/invite/InviteUserModal";
import type { CreateTaskPayload, TaskPriority, RepeatRule } from "@/types/database";
import type { TempImage } from "@/types/temp-image";
import { cleanupTempImage } from "@/utils/image-optimization";
import { useCreateTaskMutation, type TaskCreatedSource } from "@/hooks/mutations/useCreateTaskMutation";
import { useCreateTaskForm } from "./create/useCreateTaskForm";
import type { ChecklistTemplateCategory } from "@/hooks/useChecklistTemplates";
import { useCreateTaskAIPipeline } from "./create/useCreateTaskAIPipeline";

export type { TaskCreatedSource };
export interface CreateTaskPrefill {
  title?: string;
  description?: string;
  dueDate?: string;
  propertyId?: string;
  spaceIds?: string[];
  assetIds?: string[];
  category?: string;
}

interface CreateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated?: (taskId: string) => void;
  defaultPropertyId?: string;
  /** If true, auto-select the last used property when no default/prefill is provided. */
  prefillFromLastUsedProperty?: boolean;
  defaultDueDate?: string;
  defaultSpaceIds?: string[];
  defaultAssetIds?: string[];
  prefill?: CreateTaskPrefill | null;
  /** Overrides inferred `task_created` analytics source (default: `ai` if `prefill` set, else `manual`). */
  taskCreatedSource?: TaskCreatedSource;
  variant?: "modal" | "column"; // "modal" for mobile overlay, "column" for desktop third column
  headless?: boolean; // when true with variant="column", render only content (concertina provides header)
  collapseDetails?: boolean; // keeps top composer visible while hiding lower sections/actions
}

const CHECKLIST_CATEGORY_OPTIONS: Array<{ value: ChecklistTemplateCategory; label: string }> = [
  { value: "compliance", label: "Compliance" },
  { value: "maintenance", label: "Maintenance" },
  { value: "security", label: "Security" },
  { value: "operations", label: "Operations" },
];

type ChecklistTemplateDialogMode = "save" | "edit" | "duplicate";

const CREATE_TASK_SECTIONS = [
  { id: "who", instruction: "Add Person or Team", valueLabel: "+Person", Icon: User },
  { id: "where", instruction: "Add Property or Space", valueLabel: "+Property", Icon: MapPin },
  { id: "when", instruction: "Add Due Date", valueLabel: "+Date", Icon: Calendar },
  { id: "what", instruction: "Add Asset", valueLabel: "+Asset", Icon: Box },
  { id: "priority", instruction: "Add Priority", valueLabel: "+Priority", Icon: AlertTriangle },
  { id: "category", instruction: "Add Tag", valueLabel: "+Tag", Icon: Tag },
  { id: "compliance", instruction: "Add Compliance Rule", valueLabel: "+Rule", Icon: Shield },
] as const;

export function CreateTaskModal({
  open,
  onOpenChange,
  onTaskCreated,
  defaultPropertyId,
  prefillFromLastUsedProperty = true,
  defaultDueDate,
  defaultSpaceIds,
  defaultAssetIds,
  prefill,
  taskCreatedSource,
  variant = "modal",
  headless = false,
  collapseDetails = false,
}: CreateTaskModalProps) {
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const {
    orgId,
    isLoading: orgLoading
  } = useActiveOrg();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const createTaskMutation = useCreateTaskMutation();

  // ─── Form state (extracted to useCreateTaskForm) ─────────────────────────

  const {
    orgId: formOrgId,
    members,
    refreshMembers,
    templates,
    refreshChecklistTemplates,
    spaces,
    teams,
    categories,
    activeTemplate,
    recentStorageKey,
    scheduleConflictNote,
    title, setTitle,
    description, setDescription,
    propertyId, setPropertyId,
    selectedPropertyIds, setSelectedPropertyIds,
    selectedSpaceIds, setSelectedSpaceIds,
    priority, setPriority,
    priorityTouched, setPriorityTouched,
    dueDate, setDueDate,
    repeatRule, setRepeatRule,
    milestones, setMilestones,
    assignedUserId, setAssignedUserId,
    assignedTeamIds, setAssignedTeamIds,
    pendingInvitations, setPendingInvitations,
    isCompliance, setIsCompliance,
    complianceLevel, setComplianceLevel,
    annotationRequired, setAnnotationRequired,
    templateId, setTemplateId,
    recentTemplateIds,
    templateDialogMode, setTemplateDialogMode,
    templateDraftName, setTemplateDraftName,
    templateDraftCategory, setTemplateDraftCategory,
    subtasks, setSubtasks,
    selectedThemeIds, setSelectedThemeIds,
    selectedAssetIds, setSelectedAssetIds,
    images, setImages,
    taskFiles, setTaskFiles,
    showAdvanced, setShowAdvanced,
    activeSection, setActiveSection,
    inviteModalOpen, setInviteModalOpen,
    invitePrefill, setInvitePrefill,
    pendingTemplateImport, setPendingTemplateImport,
    showArchiveTemplateDialog, setShowArchiveTemplateDialog,
    handlePropertyChange,
    makeSubtaskFromText,
    normalizeChecklistItems,
    rememberRecentTemplate,
    importTemplateItems,
    openTemplateDialog,
    submitTemplateDialog,
    archiveActiveTemplate,
    confirmArchiveTemplate,
    resetForm,
  } = useCreateTaskForm({
    open,
    defaultPropertyId,
    prefillFromLastUsedProperty,
    defaultDueDate,
    defaultSpaceIds,
    defaultAssetIds,
    prefill,
  });

  // ─── AI pipeline (extracted to useCreateTaskAIPipeline) ──────────────────

  const {
    patchImage,
    runFullIntakeAnalysis,
    aiResult,
    aiLoading,
    aiError,
    chipSuggestions,
    ghostCategories,
    chipSuggestedIcon,
    appliedChips,
    selectedChipIds,
    factChips,
    verbChips,
    unresolvedSections,
    factChipsBySection,
    suggestedChipsBySection,
    verbChipsBySection,
    clarityState,
    instructionBlock,
    setInstructionBlock,
    aiTitleGenerated,
    userEditedTitle,
    setUserEditedTitle,
    showTitleField,
    hasDescriptionDraft,
    shouldShowTitleField,
    handleChipRemove,
    handleChipSelect,
    generateVerbLabel,
  } = useCreateTaskAIPipeline({
    description,
    title,
    propertyId,
    selectedSpaceIds,
    assignedUserId,
    assignedTeamIds,
    images,
    setImages,
    orgId,
    spaces,
    members,
    teams,
    categories,
    setDueDate,
    setPriority,
    setPriorityTouched,
    setTitle,
    setActiveSection,
    setIsCompliance,
    setShowAdvanced,
    open,
    priority,
    priorityTouched,
    dueDate,
  });

  // formOrgId === orgId (both from useActiveOrg, deduplicated by React Query)
  void formOrgId;

  // Description being non-empty and not collapsed controls the expanded view
  const shouldShowDetailsArea = Boolean(description.trim()) && !collapseDetails;

  const handleSubmit = async () => {
    // SUBMISSION GUARDRAIL: Block submission if unresolved action chips exist
    // INVITE BEHAVIORAL CONTRACT: Person chips with blockingRequired && !resolvedEntityId are Invite actions
    // Invite chips are NOT normal chips - they are gated actions that require explicit resolution
    // ADD RESOLUTION RULE: Space/asset chips with blockingRequired && !resolvedEntityId are "Add" actions
    // Action chips (verb chips) represent unresolved intent that must be resolved or removed
    // Detection: chips with blockingRequired && !resolvedEntityId in appliedChips
    // These are action intents like "INVITE JAMES" or "ADD STOVE" that require user action
    // "Add" chips must resolve into real entities (spaces/assets) or be discarded - they cannot persist as metadata
    const unresolvedActionChips = Array.from(appliedChips.values()).filter(
      chip => chip.blockingRequired && !chip.resolvedEntityId
    );
    
    // INVITE BEHAVIORAL CONTRACT: Explicitly check for unresolved Invite intent (person chips)
    // Invite chips must resolve to a specific person/team or be removed - they cannot persist unresolved
    const unresolvedInviteChips = unresolvedActionChips.filter(chip => chip.type === 'person');
    
    // INVITE BEHAVIORAL CONTRACT: Submission cannot proceed with unresolved Invite intent
    if (unresolvedActionChips.length > 0) {
      // Generate explicit action labels for inline guidance
      const actionLabels = unresolvedActionChips.map(chip => generateVerbLabel(chip));
      const firstAction = unresolvedActionChips[0];
      const actionLabel = generateVerbLabel(firstAction);
      
      // Show explicit inline guidance explaining what must be resolved
      // INVITE BEHAVIORAL CONTRACT: Explicitly mention Invite actions with clear feedback
      const inviteMessage = unresolvedInviteChips.length > 0
        ? unresolvedInviteChips.length === 1
          ? `Invite "${unresolvedInviteChips[0].label}" to assign this task, or choose an existing contact.`
          : `${unresolvedInviteChips.length} invites need resolution before submission.`
        : null;
      
      toast({
        title: "Resolve action items first",
        description: inviteMessage || (unresolvedActionChips.length === 1
          ? `${actionLabel} before creating this task.`
          : `${actionLabels.length} action items need resolution: ${actionLabels.slice(0, 2).join(", ")}${actionLabels.length > 2 ? "..." : ""}`),
        variant: "destructive"
      });
      
      // INVITE BEHAVIORAL CONTRACT: Block submission - Invite chips must be resolved or removed
      // Invite intent must resolve to a specific person/team or be explicitly removed
      // Invite chips cannot persist as task metadata - they are action intent, not passive data
      // ADD RESOLUTION RULE: "Add" chips must resolve into real entities (spaces/assets) or be explicitly removed
      // "Add" chips must never be included in the submitted task payload - they are action intent, not metadata
      return;
    }
    
    // Check property requirement for spaces/assets
    const hasSpaceOrAssetChips = Array.from(appliedChips.values()).some(
      c => (c.type === 'space' || c.type === 'asset')
    );
    if (hasSpaceOrAssetChips && !propertyId) {
      toast({
        title: "Pick a property",
        description: "Choose a property when adding spaces or assets.",
        variant: "destructive"
      });
      return;
    }
    
    // Auto-generate title if empty
    let finalTitle = title.trim();
    if (!finalTitle) {
      // Try AI-generated title first, then description
      if (aiTitleGenerated && aiTitleGenerated.trim()) {
        finalTitle = aiTitleGenerated.trim();
      } else if (description && description.trim()) {
        finalTitle = description.trim().substring(0, 50);
        if (description.trim().length > 50) {
          finalTitle += "...";
        }
      }
    }
    
    if (!finalTitle || !finalTitle.trim()) {
      toast({
        title: "Add a description",
        description: "Enter a task title or description to continue.",
        variant: "destructive"
      });
      return;
    }
    
    if (orgLoading) {
      toast({
        title: "Loading",
        description: "Please wait while we verify your account.",
        variant: "default"
      });
      return;
    }
    
    if (!orgId) {
      toast({
        title: "Not signed in",
        description: "Log in to create tasks.",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    try {
      // ============================================================
      // JUST-IN-TIME GHOST CHIP CREATION
      // ============================================================
      // Scan for ghost chips and create them before saving the task
      let resolvedSpaceIds = [...selectedSpaceIds];
      let resolvedThemeIds = [...selectedThemeIds];
      const resolvedAssetIds: string[] = []; // Will be populated if assets are added later
      
      // Process Ghost Spaces
      const ghostSpaces = selectedSpaceIds.filter(id => id.startsWith('ghost-space-'));
      for (const ghostId of ghostSpaces) {
        const spaceName = ghostId.replace('ghost-space-', '');
        
        if (selectedPropertyIds.length === 0) {
          throw new Error(`Can't create space "${spaceName}" without picking a property`);
        }
        
        // Use first property for space creation
        const spacePropertyId = selectedPropertyIds[0];
        const { data: newSpace, error: spaceError } = await supabase
          .from("spaces")
          .insert({
            org_id: orgId,
            property_id: spacePropertyId,
            name: spaceName,
          })
          .select("id")
          .single();
        
        if (spaceError) {
          console.error("Error creating space:", spaceError);
          throw new Error(`Couldn't create space "${spaceName}": ${spaceError.message}`);
        }
        
        if (!newSpace) {
          throw new Error(`Couldn't create space "${spaceName}": no data returned`);
        }
        
        // Replace ghost ID with real ID
        resolvedSpaceIds = resolvedSpaceIds.map(id => id === ghostId ? newSpace.id : id);
        
        toast({
          title: "Created new Space",
          description: spaceName,
        });
      }
      
      // Process Ghost Themes
      const ghostThemes = selectedThemeIds.filter(id => id.startsWith('ghost-theme-'));
      for (const ghostId of ghostThemes) {
        // Extract name and type from ghost ID: ghost-theme-{name}-{type}
        const match = ghostId.match(/^ghost-theme-(.+?)-(.+)$/);
        if (!match) {
          console.warn(`Invalid ghost theme ID format: ${ghostId}`);
          continue;
        }
        
        const [, themeName, themeType] = match;
        
        const { data: newTheme, error: themeError } = await supabase
          .from("themes")
          .insert({
            org_id: orgId,
            name: themeName,
            type: themeType as 'category' | 'project' | 'tag' | 'group',
          })
          .select("id")
          .single();
        
        if (themeError) {
          console.error("Error creating theme:", themeError);
          throw new Error(`Couldn't create theme "${themeName}": ${themeError.message}`);
        }
        
        if (!newTheme) {
          throw new Error(`Couldn't create theme "${themeName}": no data returned`);
        }
        
        // Replace ghost ID with real ID
        resolvedThemeIds = resolvedThemeIds.map(id => id === ghostId ? newTheme.id : id);
        
        toast({
          title: "Created new Theme",
          description: themeName,
        });
      }
      
      // Process Ghost Assets (if assets are implemented)
      // For now, assets section doesn't have selectedAssetIds state, but we'll prepare for it
      // const ghostAssets = selectedAssetIds.filter(id => id.startsWith('ghost-asset-'));
      // for (const ghostId of ghostAssets) {
      //   const assetName = ghostId.replace('ghost-asset-', '');
      //   
      //   if (!propertyId) {
      //     throw new Error(`Cannot create asset "${assetName}" without a property selected`);
      //   }
      //   
      //   const { data: newAsset, error: assetError } = await supabase
      //     .from("assets")
      //     .insert({
      //       org_id: orgId,
      //       property_id: propertyId,
      //       title: assetName,
      //     })
      //     .select("id")
      //     .single();
      //   
      //   if (assetError) {
      //     console.error("Error creating asset:", assetError);
      //     throw new Error(`Failed to create asset "${assetName}": ${assetError.message}`);
      //   }
      //   
      //   if (!newAsset) {
      //     throw new Error(`Failed to create asset "${assetName}": no data returned`);
      //   }
      //   
      //   resolvedAssetIds = resolvedAssetIds.map(id => id === ghostId ? newAsset.id : id);
      //   
      //   toast({
      //     title: "Created new Asset",
      //     description: assetName,
      //   });
      // }
      
      // Priority will be normalized by the RPC function
      // Frontend uses: 'low', 'medium', 'high', 'urgent'
      // RPC will map 'medium' to 'normal' automatically
      const dbPriority = priority;
      
      // Convert dueDate (YYYY-MM-DD) to TIMESTAMPTZ
      let dueDateValue: string | null = null;
      if (dueDate) {
        // If it's just a date string, convert to full timestamp at start of day
        const dateObj = new Date(dueDate);
        dueDateValue = dateObj.toISOString();
      }
      
      // Check if assigned user is a pending invitation
      const isPendingInvitation = assignedUserId?.startsWith('pending-');
      let finalAssignedUserId: string | null = null;
      
      if (assignedUserId && !isPendingInvitation) {
        finalAssignedUserId = assignedUserId;
      }
      // If it's a pending invitation, we'll handle it after task creation
      
      // Simplified: direct insert with RLS; analytics + cache updates live in useCreateTaskMutation.
      const analyticsSource = taskCreatedSource ?? (prefill ? "ai" : "manual");
      const newTask = await createTaskMutation.mutateAsync({
        source: analyticsSource,
        insert: {
          org_id: orgId,
          title: finalTitle,
          property_id: propertyId || null,
          priority: dbPriority,
          due_date: dueDateValue,
          milestones: milestones.length > 0 ? milestones : [],
          description: description.trim() || null,
          assigned_user_id: finalAssignedUserId,
          status: "open",
          icon_name: chipSuggestedIcon || null,
        },
      });

      const taskId = newTask.id;

      // Briefing + task list invalidation handled in mutation onSuccess; keep task-detail/attachment
      // invalidations below after uploads and junction writes.
      // Use snapshots so async updates never repopulate cleared draft state.
      const imagesToUpload = [...images];
      const filesToUpload = [...taskFiles];
      if ((imagesToUpload.length > 0 || filesToUpload.length > 0) && taskId && orgId) {
        const imageUploadPromises = imagesToUpload.map(async (tempImage) => {
          try {
            const imageUuid = crypto.randomUUID();
            const basePath = `org/${orgId}/tasks/${taskId}/images/${imageUuid}`;
            
            // Upload thumbnail
            const thumbnailPath = `${basePath}/thumb.webp`;
            const { error: thumbError } = await supabase.storage
              .from("task-images")
              .upload(thumbnailPath, tempImage.thumbnail_blob, {
                contentType: 'image/webp',
                cacheControl: '31536000', // 1 year
              });

            if (thumbError) throw thumbError;

            // Upload optimized
            const optimizedPath = `${basePath}/optimized.webp`;
            const { error: optError } = await supabase.storage
              .from("task-images")
              .upload(optimizedPath, tempImage.optimized_blob, {
                contentType: 'image/webp',
                cacheControl: '31536000',
              });

            if (optError) throw optError;

            // Get public URLs
            const { data: thumbUrl } = supabase.storage
              .from("task-images")
              .getPublicUrl(thumbnailPath);
            
            const { data: optUrl } = supabase.storage
              .from("task-images")
              .getPublicUrl(optimizedPath);

            // Create attachment record with annotations only (Phase 3: no AI metadata here)
            // Phase 2 edge function ai-image-analyse writes ocr_text, document_type, expiry_date, metadata
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
                file_type: 'image/webp',
                file_size: tempImage.optimized_blob.size,
                annotation_json: tempImage.annotation_json || [],
                upload_status: 'complete',
              })
              .select()
              .single();

            if (attachError) throw attachError;

            // Create annotation record if annotations exist
            if (tempImage.annotation_json && tempImage.annotation_json.length > 0 && attachment) {
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase as any)
                  .from("task_image_annotations")
                  .insert({
                    task_id: taskId,
                    image_id: attachment.id,
                    created_by: user.id,
                    annotations: tempImage.annotation_json,
                  });
              }
            }

            // Cleanup blob URLs
            cleanupTempImage(tempImage);

            // Phase 2: Fire-and-forget post-upload AI analysis (never blocks)
            if (attachment?.id && orgId) {
              supabase.functions
                .invoke("ai-image-analyse", {
                  body: {
                    attachment_id: attachment.id,
                    file_url: optUrl.publicUrl,
                    org_id: orgId,
                    property_id: propertyId || null,
                    task_id: taskId,
                  },
                })
                .then(({ error }) => {
                  if (error) {
                    console.warn("[CreateTaskModal] Post-upload analysis failed:", error);
                  }
                })
                .catch(() => {});
            }

            return attachment;
          } catch (error: any) {
            console.error("Error uploading image:", error);

            toast({
              title: "Image upload failed",
              description: `Couldn't upload "${tempImage.display_name}". You can retry later.`,
              variant: "destructive",
            });

            return null;
          }
        });

        const fileUploadPromises = filesToUpload.map(async (pendingFile, index) => {
          try {
            const fileExt = pendingFile.display_name.split(".").pop() || "bin";
            const filePath = `org/${orgId}/tasks/${taskId}/files/${crypto.randomUUID()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
              .from("task-images")
              .upload(filePath, pendingFile.file, {
                cacheControl: "31536000",
              });

            if (uploadError) throw uploadError;

            const { data: fileUrl } = supabase.storage
              .from("task-images")
              .getPublicUrl(filePath);

            const { error: attachmentError } = await supabase
              .from("attachments")
              .insert({
                org_id: orgId,
                parent_type: "task",
                parent_id: taskId,
                file_url: fileUrl.publicUrl,
                file_name: pendingFile.display_name,
                file_type: pendingFile.file_type,
                file_size: pendingFile.file_size,
                upload_status: "complete",
              });

            if (attachmentError) throw attachmentError;
            return pendingFile;
          } catch (error: any) {
            console.error(`Error uploading file ${index}:`, error);
            toast({
              title: "File upload failed",
              description: `Couldn't upload "${pendingFile.display_name}". You can retry later.`,
              variant: "destructive",
            });
            return null;
          }
        });

        // Don't await - let uploads happen in background
        Promise.all([...imageUploadPromises, ...fileUploadPromises]).then(() => {
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
          queryClient.invalidateQueries({ queryKey: ["tasks-briefing"] });
          queryClient.invalidateQueries({ queryKey: ["task-attachments", taskId] });
          queryClient.invalidateQueries({ queryKey: ["task-details", orgId, taskId] });
        });
      }
      
      // Link spaces to task via task_spaces junction table
      if (resolvedSpaceIds.length > 0) {
        const spaceInserts = resolvedSpaceIds.map(spaceId => ({
          task_id: taskId,
          space_id: spaceId,
        }));
        
        const { error: spaceLinkError } = await supabase
          .from("task_spaces")
          .insert(spaceInserts);
        
        if (spaceLinkError) {
          console.error("Error linking spaces to task:", spaceLinkError);
          // Don't throw - task is already created, just log the error
        }
      }
      
      // Link themes to task via task_themes junction table
      if (resolvedThemeIds.length > 0) {
        const themeInserts = resolvedThemeIds.map(themeId => ({
          task_id: taskId,
          theme_id: themeId,
        }));
        
        const { error: themeLinkError } = await supabase
          .from("task_themes")
          .insert(themeInserts);
        
        if (themeLinkError) {
          console.error("[CreateTaskModal] Error linking themes to task:", themeLinkError);
        }
      }
      
      // Link teams to task via task_teams junction table
      if (assignedTeamIds.length > 0) {
        const teamInserts = assignedTeamIds.map(teamId => ({
          task_id: taskId,
          team_id: teamId,
        }));
        
        const { error: teamLinkError } = await supabase
          .from("task_teams")
          .insert(teamInserts);
        
        if (teamLinkError) {
          console.error("[CreateTaskModal] Error linking teams to task:", teamLinkError);
        }
      }

      // Link assets to task via task_assets junction table
      const realAssetIds = selectedAssetIds.filter(id => !id.startsWith('ghost-'));
      if (realAssetIds.length > 0) {
        const assetInserts = realAssetIds.map(assetId => ({
          task_id: taskId,
          asset_id: assetId,
        }));

        const { error: assetLinkError } = await supabase
          .from("task_assets")
          .insert(assetInserts);

        if (assetLinkError) {
          console.error("[CreateTaskModal] Error linking assets to task:", assetLinkError);
        }
      }
      
      // Handle pending invitations
      if (isPendingInvitation && pendingInvitations.length > 0) {
        // Find the pending invitation that matches the assigned user
        const email = assignedUserId?.replace('pending-', '');
        const pendingInv = pendingInvitations.find(inv => inv.email === email);
        
        if (pendingInv) {
          // TODO: Create invitation record and send email with magic link
          // The chip is already created and dimmed in the UI
          // When the user validates/registers or visits via magic link,
          // we'll need to update the task's assigned_user_id
        }
      }
      
      // Show final success toast
      const createdEntities = [];
      if (ghostSpaces.length > 0) createdEntities.push(`${ghostSpaces.length} space${ghostSpaces.length > 1 ? 's' : ''}`);
      if (ghostThemes.length > 0) createdEntities.push(`${ghostThemes.length} theme${ghostThemes.length > 1 ? 's' : ''}`);
      
      // Invalidate queries to refresh task lists and details
      // If images were uploaded, we already invalidated above, but invalidate again
      // after a delay to pick up thumbnails processed by the edge function
      if (imagesToUpload.length > 0 || filesToUpload.length > 0) {
        // Wait 2 seconds for edge function to process thumbnails, then invalidate again
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

      toast({
        title: "Task created",
        description: createdEntities.length > 0 
          ? `Task created. Created new ${createdEntities.join(' and ')}.`
          : "Your task has been added successfully."
      });
      resetForm();
      onOpenChange(false);
      onTaskCreated?.(taskId);
    } catch (error: any) {
      console.error("Create task failed:", error);
      toast({
        title: "Couldn't create task",
        description: error.message || "Something didn't work. Try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  const content = <div className="flex flex-col h-full max-h-[85vh]">
      {/* Header - only show for modal variant */}
      {variant !== "column" && (
        <div className="flex items-center justify-between p-4 border-b border-border/30">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            Create Task
          </h2>
          <button 
            type="button"
            onClick={() => onOpenChange(false)} 
            className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Scrollable Content - Vertical Layout */}
      <div className="flex-1 overflow-y-auto p-4 pb-0 space-y-6">
        {/* Image Upload Icons */}
        <ImageUploadSection
          images={images}
          onImagesChange={setImages}
          onPatchImage={patchImage}
          onRunFullIntakeAnalysis={runFullIntakeAnalysis}
          files={taskFiles}
          onFilesChange={setTaskFiles}
          taskId={undefined}
        />

        {/* AI-Generated Title (collapses until user starts description) */}
        <div
          className={cn(
            "rounded-none transition-all duration-300 ease-out overflow-hidden",
            shouldShowTitleField ? "!mt-2 max-h-28 opacity-100" : "!mt-3 max-h-0 opacity-0 pointer-events-none"
          )}
        >
          <div className="relative">
            <FillaIcon size={12} className="text-primary absolute left-1.5 top-1.5 pointer-events-none text-left" />
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setUserEditedTitle(true);
                setTitle(e.target.value);
                if (e.target.value.trim() === "") {
                  setUserEditedTitle(false);
                }
              }}
              className="w-full h-10 pl-[22px] pr-4 py-3 rounded-[8px] bg-input shadow-engraved focus:outline-none focus:ring-2 focus:ring-primary/30 font-sans text-sm transition-shadow"
              placeholder="Generated title…"
            />
          </div>
          {!aiLoading && aiError && !aiResult?.title && (
            <p className="pt-2 text-[10px] text-muted-foreground">
              AI title is temporarily unavailable. You can still enter one manually.
            </p>
          )}
        </div>

        {/* Description: 12px below upload when title hidden; 8px below AI title when visible */}
        <div className={cn(shouldShowTitleField ? "!mt-2" : "!mt-0")}>
          <SubtasksSection
            subtasks={subtasks}
            onSubtasksChange={setSubtasks}
            description={description}
            onDescriptionChange={setDescription}
            className="bg-transparent"
          templates={templates}
          recentTemplateIds={recentTemplateIds}
          activeTemplateName={activeTemplate?.name ?? null}
          onUseTemplate={importTemplateItems}
          onSaveAsTemplate={() => openTemplateDialog("save")}
          onEditTemplate={() => openTemplateDialog("edit")}
          onDuplicateTemplate={() => openTemplateDialog("duplicate")}
          onArchiveTemplate={archiveActiveTemplate}
        />
        </div>

        <div
          aria-hidden={!shouldShowDetailsArea}
          className={cn(
            "grid !mt-0 pt-[5px] transition-[grid-template-rows,opacity] duration-500 ease-out",
            shouldShowDetailsArea
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0 pointer-events-none"
          )}
        >
        <div className="overflow-hidden">
          {/* Vertical stacked Create Task rows (authoritative layout): Who → Where → When → Assets → Priority → Tags → Compliance */}
          <div className="space-y-0 flex flex-col mt-0">
            {CREATE_TASK_SECTIONS.map(({ id, instruction, valueLabel, Icon }) =>
              id === "who" ? (
                <WhoSection
                  key={id}
                  isActive={activeSection === id}
                  onActivate={() => setActiveSection(id)}
                  assignedUserId={assignedUserId}
                  assignedTeamIds={assignedTeamIds}
                  onUserChange={setAssignedUserId}
                  onTeamsChange={setAssignedTeamIds}
                  pendingInvitations={pendingInvitations}
                  onPendingInvitationsChange={setPendingInvitations}
                  onInviteToOrg={(prefill) => {
                    setInvitePrefill(prefill ?? null);
                    setInviteModalOpen(true);
                  }}
                  onAddAsContractor={() => { setInvitePrefill(null); setInviteModalOpen(true); }}
                  hasUnresolved={unresolvedSections.includes(id)}
                  suggestedChips={suggestedChipsBySection["who"] ?? []}
                  onSuggestionClick={handleChipSelect}
                >
                  {activeSection === id && (
                    <WhoPanel
                      assignedUserId={assignedUserId}
                      assignedTeamIds={assignedTeamIds}
                      onUserChange={setAssignedUserId}
                      onTeamsChange={setAssignedTeamIds}
                      suggestedPeople={aiResult?.people?.map(p => p.name) || []}
                      pendingInvitations={pendingInvitations}
                      onPendingInvitationsChange={setPendingInvitations}
                      instructionBlock={instructionBlock}
                      onInstructionDismiss={() => setInstructionBlock(null)}
                      onInviteToOrg={(prefill) => {
                        setInvitePrefill(prefill ?? null);
                        setInviteModalOpen(true);
                      }}
                      onAddAsContractor={() => { setInvitePrefill(null); setInviteModalOpen(true); }}
                    />
                  )}
                </WhoSection>
              ) : id === "where" ? (
                <WhereSection
                  key={id}
                  propertyId={propertyId}
                  selectedPropertyIds={selectedPropertyIds}
                  selectedSpaceIds={selectedSpaceIds}
                  onPropertyChange={handlePropertyChange}
                  onSpacesChange={setSelectedSpaceIds}
                  showFactsByDefault={!!defaultPropertyId || !!prefill?.propertyId}
                  suggestedChips={suggestedChipsBySection["where"] ?? []}
                />
              ) : id === "when" ? (
                <div key={id} className="space-y-1">
                  <WhenSection
                    isActive={activeSection === id}
                    onActivate={() => setActiveSection(id)}
                    onDeactivate={() => setActiveSection(null)}
                    dueDate={dueDate}
                    repeatRule={repeatRule}
                    onDueDateChange={setDueDate}
                    onRepeatRuleChange={setRepeatRule}
                    milestones={milestones}
                    onMilestonesChange={setMilestones}
                    hasUnresolved={unresolvedSections.includes(id)}
                    suggestedDateLabel={
                      (suggestedChipsBySection["when"] ?? []).find(c => c.type === "date")?.label?.toUpperCase()
                    }
                    onSuggestedDateAccept={() => {
                      const dateChip = (suggestedChipsBySection["when"] ?? []).find(c => c.type === "date");
                      if (dateChip) handleChipSelect(dateChip);
                    }}
                  />
                  {scheduleConflictNote && (
                    <div className="pl-8 text-[11px] font-medium text-[#EB6834]">
                      {scheduleConflictNote}
                    </div>
                  )}
                </div>
              ) : id === "what" ? (
                <AssetSection
                  key={id}
                  isActive={activeSection === id}
                  onActivate={() => setActiveSection(id)}
                  propertyId={propertyId || undefined}
                  spaceId={selectedSpaceIds[0]}
                  selectedAssetIds={selectedAssetIds}
                  onAssetsChange={setSelectedAssetIds}
                  suggestedChips={suggestedChipsBySection["what"] ?? []}
                />
              ) : id === "category" ? (
                <CategorySection
                  key={id}
                  isActive={activeSection === id}
                  onActivate={() => setActiveSection(id)}
                  selectedThemeIds={selectedThemeIds}
                  onThemesChange={setSelectedThemeIds}
                  hasUnresolved={unresolvedSections.includes(id)}
                />
              ) : (
              <CreateTaskRow
                key={id}
                sectionId={id}
                icon={<Icon className="h-4 w-4 text-muted-foreground" />}
                instruction={instruction}
                valueLabel={valueLabel}
                isActive={activeSection === id}
                onActivate={() => setActiveSection(id)}
                factChips={factChipsBySection[id] ?? []}
                suggestedChips={suggestedChipsBySection[id] ?? []}
                verbChips={verbChipsBySection[id] ?? []}
                onChipRemove={handleChipRemove}
                onSuggestionClick={handleChipSelect}
                onVerbChipClick={handleChipSelect}
                hasUnresolved={unresolvedSections.includes(id)}
                hoverChips={
                  id === "priority"
                    ? [
                        { id: "low", label: "LOW", onPress: () => { setPriorityTouched(true); setPriority("low"); } },
                        { id: "medium", label: "NORMAL", onPress: () => { setPriorityTouched(true); setPriority("medium"); } },
                        { id: "high", label: "HIGH", onPress: () => { setPriorityTouched(true); setPriority("high"); } },
                        { id: "urgent", label: "URGENT", onPress: () => { setPriorityTouched(true); setPriority("urgent"); } },
                      ]
                    : undefined
                }
              >
                {activeSection === id && id === "compliance" && (
                  <div className="flex items-center gap-2 flex-nowrap overflow-x-auto min-w-0">
                    <label className="text-[11px] font-mono uppercase text-muted-foreground">Compliance</label>
                    <Switch id="row-compliance" checked={isCompliance} onCheckedChange={setIsCompliance} />
                    {isCompliance && (
                      <Select value={complianceLevel} onValueChange={setComplianceLevel}>
                        <SelectTrigger className="h-8 w-auto min-w-[100px] text-[11px] font-mono">
                          <SelectValue placeholder="Level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </CreateTaskRow>
              )
            )}
          </div>

          {/* Advanced Options */}
          {showAdvanced && <div className="space-y-4 p-4 rounded-[8px] bg-muted/50 shadow-engraved">
              {/* Compliance Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="compliance" className="text-sm">Compliance Task</Label>
                  <p className="text-xs text-muted-foreground">Mark as regulatory requirement</p>
                </div>
                <Switch id="compliance" checked={isCompliance} onCheckedChange={setIsCompliance} />
              </div>

              {isCompliance && <div className="space-y-2">
                  <Label className="text-xs">Compliance Level</Label>
                  <Select value={complianceLevel} onValueChange={setComplianceLevel}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>}

              {/* Annotation Required */}
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="annotation" className="text-sm">Requires Photo Annotation</Label>
                  <p className="text-xs text-muted-foreground">Enforce photo markup on completion</p>
                </div>
                <Switch id="annotation" checked={annotationRequired} onCheckedChange={setAnnotationRequired} />
              </div>
            </div>}
        </div>
        </div>{/* end overflow-hidden */}
      </div>{/* end grid-rows animation */}

      {/* Footer */}
      <div
        aria-hidden={!shouldShowDetailsArea}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-500 ease-out",
          shouldShowDetailsArea
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0 pointer-events-none"
        )}
      >
      <div className="overflow-hidden">
      <div className="flex flex-col gap-3 border-t border-transparent bg-transparent backdrop-blur text-foreground px-4 pt-[6px] pb-6">
        {/* Clarity State */}
        {clarityState && (
          <ClarityState
            severity={clarityState.severity}
            message={clarityState.message}
          />
        )}
        
        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 shadow-e1" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            className="flex-1 shadow-primary-btn" 
            onClick={handleSubmit} 
            // SUBMISSION GUARDRAIL: Disable if clarity is blocking or unresolved verb chips exist
            disabled={isSubmitting || (clarityState?.severity === 'blocking') || verbChips.length > 0}
            title={clarityState?.severity === 'blocking' ? clarityState.message : undefined}
          >
            {isSubmitting ? "Creating..." : "Create Task"}
          </Button>
        </div>
      </div>{/* end content div */}
      </div>{/* end overflow-hidden */}
      </div>{/* end grid-rows animation */}
    </div>;

  // Shared invite modal renderer (must exist for every variant path).
  const renderInviteModal = () => (
    <InviteUserModal
      open={inviteModalOpen}
      onOpenChange={(open) => {
        setInviteModalOpen(open);
        if (!open) setInvitePrefill(null);
      }}
      prefillFirstName={invitePrefill?.firstName ?? ""}
      prefillLastName={invitePrefill?.lastName ?? ""}
      prefillEmail={invitePrefill?.email ?? ""}
      onInviteSent={(inv) => {
        if (inv.status === "accepted" && inv.userId) {
          setAssignedUserId(inv.userId);
          setPendingInvitations((prev) => prev.filter((p) => p.email !== inv.email));
          refreshMembers();
          return;
        }

        setPendingInvitations((prev) => [
          ...prev.filter((p) => p.email !== inv.email),
          {
            id: `pending-${inv.email}`,
            email: inv.email,
            firstName: inv.firstName,
            lastName: inv.lastName,
            displayName: `${inv.firstName} ${inv.lastName}`.trim(),
          },
        ]);
        setInvitePrefill(null);
      }}
    />
  );

  const renderTemplateDialog = () => {
    const isOpen = templateDialogMode !== null;
    const title =
      templateDialogMode === "edit"
        ? "Edit Checklist Template"
        : templateDialogMode === "duplicate"
          ? "Duplicate Checklist Template"
          : "Save Checklist Template";
    const cta =
      templateDialogMode === "edit" ? "Update Template" : "Save Template";

    return (
      <Dialog open={isOpen} onOpenChange={(openState) => !openState && setTemplateDialogMode(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Save checklist templates for quick reuse in task creation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Template name</Label>
              <input
                value={templateDraftName}
                onChange={(event) => setTemplateDraftName(event.target.value)}
                placeholder="e.g. Fire Safety Check"
                className="w-full h-9 px-3 rounded-[10px] bg-input shadow-engraved text-sm text-foreground placeholder:text-muted-foreground/60 border-0 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Category</Label>
              <Select
                value={templateDraftCategory}
                onValueChange={(value) => setTemplateDraftCategory(value as ChecklistTemplateCategory)}
              >
                <SelectTrigger className="h-9 shadow-engraved">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHECKLIST_CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setTemplateDialogMode(null)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={submitTemplateDialog}>
                {cta}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const renderAlertDialogs = () => (
    <>
      {/* Template import: replace vs append */}
      <AlertDialog open={!!pendingTemplateImport} onOpenChange={(open) => !open && setPendingTemplateImport(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace existing checklist?</AlertDialogTitle>
            <AlertDialogDescription>
              You already have checklist items. Do you want to replace them with "{pendingTemplateImport?.templateName}", or add the new items to the end?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => setPendingTemplateImport(null)}>Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              className="shadow-e1"
              onClick={() => {
                if (!pendingTemplateImport) return;
                setTemplateId(pendingTemplateImport.templateId);
                setSubtasks((prev) => [...prev, ...pendingTemplateImport.subtasks]);
                rememberRecentTemplate(pendingTemplateImport.templateId);
                toast({ title: "Checklist appended", description: `${pendingTemplateImport.subtasks.length} item${pendingTemplateImport.subtasks.length === 1 ? "" : "s"} added from "${pendingTemplateImport.templateName}".` });
                setPendingTemplateImport(null);
              }}
            >
              Append
            </Button>
            <AlertDialogAction
              onClick={() => {
                if (!pendingTemplateImport) return;
                setTemplateId(pendingTemplateImport.templateId);
                setSubtasks(pendingTemplateImport.subtasks);
                rememberRecentTemplate(pendingTemplateImport.templateId);
                toast({ title: "Checklist imported", description: `${pendingTemplateImport.subtasks.length} item${pendingTemplateImport.subtasks.length === 1 ? "" : "s"} loaded from "${pendingTemplateImport.templateName}".` });
                setPendingTemplateImport(null);
              }}
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive template confirmation */}
      <AlertDialog open={showArchiveTemplateDialog} onOpenChange={setShowArchiveTemplateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive template?</AlertDialogTitle>
            <AlertDialogDescription>
              "{activeTemplate?.name}" will be removed from the checklist picker. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmArchiveTemplate}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  // For column variant on wide screens: headless = content only (concertina provides header)
  if (variant === "column" && headless) {
    return <>
      {content}
      {renderTemplateDialog()}
      {renderInviteModal()}
      {renderAlertDialogs()}
    </>;
  }

  // For column variant with own accordion (standalone, not in concertina)
  if (variant === "column") {
    const accordionBodyId = "create-task-accordion-body";
    const isExpanded = open;

    return (
      <>
        <div className="h-auto flex flex-col bg-background rounded-[12px] shadow-[2px_4px_6px_0px_rgba(0,0,0,0.15),inset_1px_1px_2px_0px_rgba(255,255,255,1),inset_-1px_-1px_2px_0px_rgba(0,0,0,0.25)] border-0 relative overflow-hidden" style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise-filter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.522\' numOctaves=\'1\' stitchTiles=\'stitch\'%3E%3C/feTurbulence%3E%3CfeColorMatrix type=\'saturate\' values=\'0\'%3E%3C/feColorMatrix%3E%3CfeComponentTransfer%3E%3CfeFuncR type=\'linear\' slope=\'0.468\'%3E%3C/feFuncR%3E%3CfeFuncG type=\'linear\' slope=\'0.468\'%3E%3C/feFuncG%3E%3CfeFuncB type=\'linear\' slope=\'0.468\'%3E%3C/feFuncB%3E%3CfeFuncA type=\'linear\' slope=\'0.137\'%3E%3C/feFuncA%3E%3C/feComponentTransfer%3E%3CfeComponentTransfer%3E%3CfeFuncR type=\'linear\' slope=\'1.323\' intercept=\'-0.207\'/%3E%3CfeFuncG type=\'linear\' slope=\'1.323\' intercept=\'-0.207\'/%3E%3CfeFuncB type=\'linear\' slope=\'1.323\' intercept=\'-0.207\'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise-filter)\' opacity=\'0.8\'%3E%3C/rect%3E%3C/svg%3E")',
          backgroundSize: '100%'
        }}>
          {/* Section Title - Accordion Header */}
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={accordionBodyId}
            onClick={() => onOpenChange(!isExpanded)}
            className={cn(
              "px-4 pt-4 pb-4 border-b border-border/30 w-full text-left",
              "flex items-center justify-between gap-3",
              "bg-[#85BABC] transition-colors hover:bg-[#85BABC]",
              "rounded-t-[12px] shadow-[inset_-2px_-2px_3px_-2px_rgba(0,0,0,0.3),inset_2px_3px_2.5px_0px_rgba(255,255,255,0.4)]"
            )}
          >
            <h2 className="text-lg font-semibold text-white">Create Task</h2>
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-white" />
            ) : (
              <ChevronDown className="h-5 w-5 text-white" />
            )}
          </button>

          <div
            id={accordionBodyId}
            className={cn(
              "overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out",
              isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
            )}
          >
            {content}
          </div>
        </div>
        {renderTemplateDialog()}
        {renderInviteModal()}
        {renderAlertDialogs()}
      </>
    );
  }

  // Mobile: Bottom sheet drawer, Desktop: Center dialog

  if (isMobile) {
    return <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[95vh]">
          {content}
        </DrawerContent>
      </Drawer>
      {renderTemplateDialog()}
      {renderInviteModal()}
      {renderAlertDialogs()}
    </>;
  }
  return <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>Create a new task with details, assignments, and metadata</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
    {renderTemplateDialog()}
    {renderInviteModal()}
    {renderAlertDialogs()}
  </>;
}