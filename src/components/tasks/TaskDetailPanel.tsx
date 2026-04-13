import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Copy, Archive, Trash2, MoreVertical, CheckSquare, Clock, Upload, Shield, AlertTriangle, CircleDot, X, ChevronLeft, ChevronRight, ChevronDown, Calendar, User } from "lucide-react";
import { useTaskDetails } from "@/hooks/use-task-details";
import { useAssetsQuery } from "@/hooks/useAssetsQuery";
import { useComplianceQuery } from "@/hooks/useComplianceQuery";
import { TaskMessaging } from "./TaskMessaging";
import { FileUploadZone } from "@/components/attachments/FileUploadZone";
import { GraphInsightPanel } from "@/components/graph/GraphInsightPanel";
import { ImageAnnotationEditor, type DetectionOverlay } from "./ImageAnnotationEditor";
import { ImageAiActions } from "./ai/ImageAiActions";
import { useImageAnnotations } from "@/hooks/useImageAnnotations";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useDataContext } from "@/contexts/DataContext";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useTaskMessages } from "@/hooks/useTaskMessages";
import { useAssistantContext } from "@/contexts/AssistantContext";
import { FillaIcon } from "@/components/filla/FillaIcon";
import { InviteUserModal } from "@/components/invite/InviteUserModal";
import { WhoSection } from "./create/WhoSection";
import type { PendingInvitation } from "./create/tabs/WhoTab";
import { WhenSection, type MilestoneItem } from "./create/WhenSection";
import { WhereSection } from "./create/WhereSection";
import { AssetSection } from "./create/AssetSection";
import { CategorySection } from "./create/CategorySection";
import { CreateTaskRow } from "./create/CreateTaskRow";
import { SemanticChip } from "@/components/chips/semantic";
import { format, isValid, parseISO } from "date-fns";
import type { RepeatRule } from "@/types/database";
import type { SuggestedChip } from "@/types/chip-suggestions";
import type { Annotation } from "@/types/image-annotations";

import { Skeleton } from "@/components/ui/skeleton";

interface TaskDetailPanelProps {
  taskId: string;
  onClose: () => void;
  variant?: "modal" | "column"; // "modal" for mobile overlay, "column" for desktop third column
}

/**
 * Task Detail Panel
 * 
 * Modal/column panel for viewing and editing task details.
 * Create Task aesthetic: image slider, description 18pt, multi-column metadata, CTA at bottom.
 * - Inline summary (title, key facts, chips), messaging, collapsible activity
 */
export function TaskDetailPanel({ taskId, onClose, variant = "modal" }: TaskDetailPanelProps) {
  const { task, loading, error, refresh: refreshTask } = useTaskDetails(taskId);
  const propertyId = (task as any)?.property_id;
  const { data: assets = [] } = useAssetsQuery(propertyId);
  const { data: complianceItems = [] } = useComplianceQuery();
  const { data: taskAssets = [] } = useQuery({
    queryKey: ["task-assets", taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data: links } = await supabase
        .from("task_assets")
        .select("asset_id")
        .eq("task_id", taskId);
      if (!links || links.length === 0) return [];
      const assetIds = links.map((l: any) => l.asset_id);
      const { data: assetRows } = await supabase
        .from("assets_view")
        .select("id, name")
        .in("id", assetIds);
      return (assetRows || []).map((a: any) => ({ id: a.id, name: a.name ?? "Unnamed" }));
    },
    enabled: !!taskId,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { members } = useOrgMembers();
  const { messages: conversationMessages } = useTaskMessages(taskId);
  const latestConversationMessage = useMemo(() => {
    if (conversationMessages.length === 0) return null;
    return conversationMessages[conversationMessages.length - 1];
  }, [conversationMessages]);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<string>("open");
  const [priority, setPriority] = useState<string>("normal");
  const [activityOpen, setActivityOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [showAnnotationEditor, setShowAnnotationEditor] = useState(false);
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [repeatRule, setRepeatRule] = useState<RepeatRule | undefined>();
  const [localPropertyId, setLocalPropertyId] = useState("");
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [selectedSpaceIds, setSelectedSpaceIds] = useState<string[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [selectedThemeIds, setSelectedThemeIds] = useState<string[]>([]);
  const [milestones, setMilestones] = useState<MilestoneItem[]>([]);
  const [isCompliance, setIsCompliance] = useState(false);
  const [complianceLevel, setComplianceLevel] = useState("");
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [invitePrefill, setInvitePrefill] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
  } | null>(null);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any | null>(null);
  const panelScrollRef = useRef<HTMLDivElement | null>(null);

  // Update local state when task data loads
  useEffect(() => {
    if (task) {
      setTitle((task as any).title || "");
      setStatus((task as any).status || "open");
      setPriority((task as any).priority || "normal");
      setSelectedUserId(task.assigned_user_id || undefined);
      const teamsArray = Array.isArray(task.teams) ? task.teams : (typeof task.teams === 'string' ? JSON.parse(task.teams) : []);
      setSelectedTeamIds(teamsArray.map((t: any) => t.id) || []);
      setDueDate((task as any)?.due_date || "");
      setLocalPropertyId((task as any)?.property_id || "");
      setSelectedPropertyIds((task as any)?.property_id ? [(task as any).property_id] : []);
      setSelectedSpaceIds((task.spaces as any[])?.map((s: any) => s.id) || []);
      setSelectedThemeIds((task.categories ?? []).map((c: any) => c.id));
      const rawMs = (task as any)?.milestones;
      setMilestones(Array.isArray(rawMs) ? rawMs : (typeof rawMs === 'string' ? JSON.parse(rawMs) : []));
      const attachmentList = Array.isArray((task as any).images) ? (task as any).images : [];
      const hasImageAttachment = attachmentList.some((attachment: any) => {
        const fileType = String(attachment?.file_type || "").toLowerCase();
        const fileName = String(attachment?.file_name || "").toLowerCase();
        return fileType.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic|heif|bmp|svg)$/.test(fileName);
      });
      setSelectedImageIndex(hasImageAttachment ? 0 : null);
    }
  }, [task]);

  // Initialize asset IDs from separate query
  useEffect(() => {
    if (taskAssets.length > 0) {
      setSelectedAssetIds(taskAssets.map(a => a.id));
    }
  }, [taskAssets]);


  // Update assigned user
  const handleUserChange = async (userId: string | undefined) => {
    if (isUpdating) return;
    setIsUpdating(true);
    
    try {
      // Update tasks table with assigned_user_id
      const { error: updateError } = await supabase
        .from("tasks")
        .update({ assigned_user_id: userId || null })
        .eq("id", taskId);

      if (updateError) throw updateError;

      setSelectedUserId(userId);
      await refreshTask();
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({
        title: "Assignee updated",
        description: userId ? "Task assigned to user" : "Assignee removed",
      });
    } catch (err: any) {
      console.error("Error updating assignee:", err);
      toast({
        title: "Couldn't update assignee",
        description: err.message || "Something didn't work. Try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Update assigned teams
  const handleTeamsChange = async (teamIds: string[]) => {
    if (isUpdating) return;
    setIsUpdating(true);

    try {
      // Get current team relationships
      const { data: currentTeams, error: fetchError } = await supabase
        .from("task_teams")
        .select("team_id")
        .eq("task_id", taskId);

      if (fetchError) throw fetchError;

      const currentTeamIds = (currentTeams || []).map(t => t.team_id);
      const toAdd = teamIds.filter(id => !currentTeamIds.includes(id));
      const toRemove = currentTeamIds.filter(id => !teamIds.includes(id));

      // Remove teams
      if (toRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from("task_teams")
          .delete()
          .eq("task_id", taskId)
          .in("team_id", toRemove);

        if (deleteError) throw deleteError;
      }

      // Add teams
      if (toAdd.length > 0) {
        const inserts = toAdd.map(teamId => ({
          task_id: taskId,
          team_id: teamId,
        }));

        const { error: insertError } = await supabase
          .from("task_teams")
          .insert(inserts);

        if (insertError) throw insertError;
      }

      setSelectedTeamIds(teamIds);
      await refreshTask();
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({
        title: "Teams updated",
        description: `Task assigned to ${teamIds.length} team${teamIds.length !== 1 ? 's' : ''}`,
      });
    } catch (err: any) {
      console.error("Error updating teams:", err);
      toast({
        title: "Couldn't update teams",
        description: err.message || "Something didn't work. Try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateTask = async () => {
    if (isUpdating) return;
    setIsUpdating(true);

    try {
      const updates: Record<string, unknown> = {
        title,
        status,
        priority,
        due_date: dueDate || null,
        milestones: milestones.length > 0 ? milestones : [],
      };

      const { error: updateError, data: updateData } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", taskId)
        .select("id");

      if (updateError) throw updateError;

      await refreshTask();

      queryClient.invalidateQueries({ queryKey: ["tasks"] });

      toast({
        title: "Task updated",
        description: "Changes saved successfully",
      });
    } catch (err: any) {
      console.error("Error updating task:", err);
      toast({
        title: "Couldn't update task",
        description: err.message || "Something didn't work. Try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Section persistence handlers for the Create Task-style summary sections
  const handlePropertyChangeSection = async (propertyIds: string[]) => {
    const newPropId = propertyIds[0] || "";
    setLocalPropertyId(newPropId);
    setSelectedPropertyIds(propertyIds);
    setSelectedSpaceIds([]);
    setSelectedAssetIds([]);
    try {
      await supabase.from("tasks").update({ property_id: newPropId || null }).eq("id", taskId);
      await supabase.from("task_spaces").delete().eq("task_id", taskId);
      await supabase.from("task_assets").delete().eq("task_id", taskId);
      queryClient.invalidateQueries({ queryKey: ["task-assets", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      refreshTask();
    } catch (err: any) {
      toast({ title: "Couldn't update property", description: err.message, variant: "destructive" });
    }
  };

  const handleSpacesChange = async (spaceIds: string[]) => {
    setSelectedSpaceIds(spaceIds);
    try {
      await supabase.from("task_spaces").delete().eq("task_id", taskId);
      if (spaceIds.length > 0) {
        await supabase.from("task_spaces").insert(spaceIds.map(id => ({ task_id: taskId, space_id: id })));
      }
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      refreshTask();
    } catch (err: any) {
      toast({ title: "Couldn't update spaces", description: err.message, variant: "destructive" });
    }
  };

  const handleDueDateChange = (date: string) => {
    setDueDate(date);
  };

  const handleAssetsChange = async (assetIds: string[]) => {
    setSelectedAssetIds(assetIds);
    try {
      await supabase.from("task_assets").delete().eq("task_id", taskId);
      const realIds = assetIds.filter(id => !id.startsWith("ghost-"));
      if (realIds.length > 0) {
        await supabase.from("task_assets").insert(realIds.map(id => ({ task_id: taskId, asset_id: id })));
      }
      queryClient.invalidateQueries({ queryKey: ["task-assets", taskId] });
      refreshTask();
    } catch (err: any) {
      toast({ title: "Couldn't update assets", description: err.message, variant: "destructive" });
    }
  };

  const handleThemesChange = async (themeIds: string[]) => {
    setSelectedThemeIds(themeIds);
    try {
      await supabase.from("task_themes").delete().eq("task_id", taskId);
      const realIds = themeIds.filter(id => !id.startsWith("ghost-"));
      if (realIds.length > 0) {
        await supabase.from("task_themes").insert(realIds.map(id => ({ task_id: taskId, theme_id: id })));
      }
      queryClient.invalidateQueries({ queryKey: ["task-categories", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      refreshTask();
    } catch (err: any) {
      toast({ title: "Couldn't update tags", description: err.message, variant: "destructive" });
    }
  };

  // Fact chips for CreateTaskRow-based priority and status sections
  const priorityFactChips: SuggestedChip[] = useMemo(() => {
    const label = ({ low: "LOW", normal: "NORMAL", high: "HIGH", urgent: "URGENT" } as Record<string, string>)[priority] || priority.toUpperCase();
    return [{ id: `priority-${priority}`, type: "priority" as const, value: priority, label, score: 1, source: "rule" as const, resolvedEntityId: priority }];
  }, [priority]);

  const statusFactChips: SuggestedChip[] = useMemo(() => {
    const label = ({ open: "OPEN", in_progress: "IN PROGRESS", completed: "DONE", archived: "ARCHIVED" } as Record<string, string>)[status] || status.toUpperCase();
    return [{ id: `status-${status}`, type: "priority" as const, value: status, label, score: 1, source: "rule" as const, resolvedEntityId: status }];
  }, [status]);

  const hasWhoFacts = Boolean(selectedUserId) || selectedTeamIds.length > 0 || pendingInvitations.length > 0;
  const hasWhereFacts = selectedPropertyIds.length > 0 || selectedSpaceIds.length > 0;
  const hasWhenFacts = Boolean(dueDate) || milestones.length > 0;
  const hasAssetFacts = selectedAssetIds.length > 0;
  const hasCategoryFacts = selectedThemeIds.length > 0;
  const hasComplianceFacts = isCompliance || Boolean(complianceLevel);

  const dueDateSummaryLabel = useMemo(() => {
    if (!dueDate) return "No due date";
    const d = dueDate.includes("T") ? parseISO(dueDate) : parseISO(`${dueDate}T12:00:00`);
    return isValid(d) ? format(d, "MMM d, yyyy") : dueDate;
  }, [dueDate]);

  const assigneeSummaryLabel = useMemo(() => {
    if (selectedUserId) {
      const m = members.find((x) => x.user_id === selectedUserId);
      return m?.display_name || m?.nickname || m?.email || "Assignee";
    }
    if (selectedTeamIds.length > 0) return "Team";
    return "Unassigned";
  }, [members, selectedUserId, selectedTeamIds]);

  const prioritySummaryLabel = useMemo(() => {
    return (
      ({ low: "Low", normal: "Normal", high: "High", urgent: "Urgent" } as Record<string, string>)[priority] ||
      priority
    );
  }, [priority]);

  /** Secondary row chips: show real values instead of generic PLACE / DATE / … */
  const whereChipLabel = useMemo(() => {
    if (!task) return "PLACE";
    const propName =
      (task as any).property?.nickname ||
      (task as any).property_name ||
      "";
    const spacesRaw = (task as any).spaces;
    const spacesArr = Array.isArray(spacesRaw) ? spacesRaw : [];
    const spaceNames = spacesArr
      .filter((s: { id?: string }) => selectedSpaceIds.length === 0 || (s.id && selectedSpaceIds.includes(s.id)))
      .map((s: { name?: string }) => s.name)
      .filter(Boolean) as string[];
    const spacePart = spaceNames.join(", ");
    if (propName && spacePart) return `${propName} · ${spacePart}`;
    if (propName) return propName;
    if (spacePart) return spacePart;
    return "PLACE";
  }, [task, selectedSpaceIds]);

  const whenChipLabel = useMemo(() => {
    if (!dueDate && milestones.length === 0) return "DATE";
    let datePart = "";
    if (dueDate) {
      const d = dueDate.includes("T") ? parseISO(dueDate) : parseISO(`${dueDate}T12:00:00`);
      datePart = isValid(d) ? format(d, "MMM d, yyyy") : dueDate;
    }
    if (milestones.length > 0) {
      const m = `${milestones.length} milestone${milestones.length === 1 ? "" : "s"}`;
      return datePart ? `${datePart} · ${m}` : m;
    }
    return datePart || "DATE";
  }, [dueDate, milestones]);

  const personChipLabel = useMemo(() => {
    if (!hasWhoFacts) return "+PERSON";
    if (selectedUserId) return assigneeSummaryLabel;
    if (selectedTeamIds.length > 0 && task) {
      const teamsRaw = (task as any).teams;
      let teamsArr: { id?: string; name?: string }[] = [];
      if (Array.isArray(teamsRaw)) teamsArr = teamsRaw;
      else if (typeof teamsRaw === "string") {
        try {
          teamsArr = JSON.parse(teamsRaw || "[]");
        } catch {
          teamsArr = [];
        }
      }
      const names = teamsArr
        .filter((t) => t.id && selectedTeamIds.includes(t.id))
        .map((t) => t.name)
        .filter(Boolean) as string[];
      if (names.length > 0) return names.join(", ");
      return assigneeSummaryLabel;
    }
    if (pendingInvitations.length > 0) return "Invited";
    return "PERSON";
  }, [hasWhoFacts, selectedUserId, assigneeSummaryLabel, selectedTeamIds, task, pendingInvitations]);

  const assetChipLabel = useMemo(() => {
    if (!hasAssetFacts) return "+ASSET";
    const names = taskAssets
      .filter((a) => selectedAssetIds.includes(a.id))
      .map((a) => a.name)
      .filter(Boolean);
    return names.length > 0 ? names.join(", ") : "ASSET";
  }, [hasAssetFacts, taskAssets, selectedAssetIds]);

  const categoryChipLabel = useMemo(() => {
    if (!hasCategoryFacts) return "+TAG";
    const cats = (task as any)?.categories;
    const arr = Array.isArray(cats) ? cats : [];
    const names = arr.map((c: { name?: string }) => c.name).filter(Boolean) as string[];
    return names.length > 0 ? names.join(", ") : "TAG";
  }, [hasCategoryFacts, task]);

  const complianceChipLabel = useMemo(() => {
    if (!hasComplianceFacts) return "+RULE";
    if (complianceLevel) return complianceLevel.toUpperCase();
    return "RULE";
  }, [hasComplianceFacts, complianceLevel]);

  const { userId } = useDataContext();
  const allAttachments = (task as any)?.images ?? [];
  const imageAttachments = useMemo(
    () =>
      (Array.isArray(allAttachments) ? allAttachments : []).filter((attachment: any) => {
        const fileType = String(attachment?.file_type || "").toLowerCase();
        const fileName = String(attachment?.file_name || "").toLowerCase();
        return fileType.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic|heif|bmp|svg)$/.test(fileName);
      }),
    [allAttachments]
  );
  const documentAttachments = useMemo(
    () =>
      (Array.isArray(allAttachments) ? allAttachments : []).filter((attachment: any) => {
        const fileType = String(attachment?.file_type || "").toLowerCase();
        return !fileType.startsWith("image/");
      }),
    [allAttachments]
  );
  useEffect(() => {
    if (imageAttachments.length === 0) {
      if (selectedImageIndex !== null) setSelectedImageIndex(null);
      return;
    }
    if (selectedImageIndex === null || selectedImageIndex >= imageAttachments.length) {
      setSelectedImageIndex(0);
    }
  }, [imageAttachments, selectedImageIndex]);
  const createdBy = (task as any)?.created_by ?? null;
  const assignedUserId = task?.assigned_user_id ?? null;
  const isAssigner = !!userId && createdBy === userId;
  const isAssignee = !!userId && assignedUserId === userId;
  // Show CTA to any authenticated user who can view the task (fallback when created_by not in view)
  const canManageTask = !!userId && (isAssigner || isAssignee || !createdBy);

  const hasEdits = useMemo(() => {
    const origMs = (task as any)?.milestones;
    const origMsJson = JSON.stringify(Array.isArray(origMs) ? origMs : []);
    return (
      title !== ((task as any)?.title || "") ||
      status !== ((task as any)?.status || "open") ||
      priority !== ((task as any)?.priority || "normal") ||
      dueDate !== ((task as any)?.due_date || "") ||
      JSON.stringify(milestones) !== origMsJson
    );
  }, [task, title, status, priority, dueDate, milestones]);

  const { openAssistant } = useAssistantContext();
  const { uploadFile, uploading: isUploadingImage } = useFileUpload({
    taskId,
    propertyId: propertyId ?? undefined,
    onUploadComplete: () => {
      refreshTask();
      queryClient.invalidateQueries({ queryKey: ["task-attachments", taskId] });
      queryClient.invalidateQueries({ queryKey: ["task-details", (task as any)?.org_id, taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setSelectedImageIndex(0);
    },
    onError: (err) => toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
  });
  const taskImageInputRef = useRef<HTMLInputElement>(null);

  const panelWrapper = (content: ReactNode, title?: string) => {
    if (variant === "column") {
      return (
        <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden rounded-[12px] shadow-none border-0 bg-background">
          {content}
        </div>
      );
    }
    return (
      <Dialog
        open={true}
        onOpenChange={(open) => {
          if (!open && showAnnotationEditor) return;
          if (!open) onClose();
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0">
          {title && (
            <DialogHeader className="sr-only">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>View and edit task details, attachments, and activity.</DialogDescription>
            </DialogHeader>
          )}
          {content}
        </DialogContent>
      </Dialog>
    );
  };

  // Loading state - single column skeleton
  if (loading) {
    return panelWrapper(
          <div className="flex flex-1 flex-col overflow-y-auto p-6 space-y-4">
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-32 w-full" />
          </div>,
      "Loading Task"
    );
  }

  // Error state - single column
  if (error || !task) {
    return panelWrapper(
          <div className="flex flex-1 flex-col overflow-y-auto p-6">
            <div className="text-center py-12">
              <p className="text-destructive mb-4">{error || "Couldn't find this task"}</p>
              <button
                onClick={onClose}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>
          </div>,
      "Task Error"
    );
  }

  // Shared panel content - Create Task aesthetic: p-4, thumbnails + Camera/Upload at top, description, multi-column, CTA bottom
  const panelContent = (
    <>
      <div ref={panelScrollRef} className="flex-1 overflow-y-auto min-h-0">
        {/* Image section — main preview (≤70% width) + vertical thumbnails + actions */}
        <div className="p-4 pb-0 space-y-3">
          {imageAttachments.length > 0 ? (
            <div className="flex gap-3 items-start w-full">
              {selectedImageIndex !== null && imageAttachments[selectedImageIndex] && (
                <div className="w-[70%] max-w-[70%] min-w-0 shrink-0">
                  <button
                    type="button"
                    className="relative w-full max-w-full rounded-[10px] overflow-hidden bg-muted shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => {
                      const selectedImage = imageAttachments[selectedImageIndex];
                      if (selectedImage?.id) {
                        setEditingImageId(selectedImage.id);
                        setShowAnnotationEditor(true);
                        return;
                      }
                      setLightboxOpen(true);
                    }}
                  >
                    <img
                      src={
                        imageAttachments[selectedImageIndex].optimized_url ||
                        imageAttachments[selectedImageIndex].file_url ||
                        imageAttachments[selectedImageIndex].thumbnail_url
                      }
                      alt={imageAttachments[selectedImageIndex].file_name || "Task image"}
                      className="w-full max-h-[min(45vh,340px)] object-contain bg-muted/40"
                      onError={(e) => {
                        const img = imageAttachments[selectedImageIndex];
                        if (img.file_url && (e.target as HTMLImageElement).src !== img.file_url) {
                          (e.target as HTMLImageElement).src = img.file_url;
                        }
                      }}
                    />
                    <TaskImageAnnotationOverlay
                      annotations={imageAttachments[selectedImageIndex].annotation_json}
                    />
                  </button>
                </div>
              )}
              <div className="flex-1 min-w-0 flex gap-2 justify-end items-stretch">
                <div className="flex flex-col gap-1.5 max-h-[min(45vh,340px)] overflow-y-auto overflow-x-hidden pr-0.5 [&::-webkit-scrollbar]:w-1.5">
                  {imageAttachments.map((image: any, index: number) => (
                    <button
                      key={image.id}
                      type="button"
                      className={cn(
                        "aspect-square w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0 bg-muted rounded-[8px] overflow-hidden cursor-pointer hover:opacity-90 transition-opacity relative border-2 shadow-e1",
                        selectedImageIndex === index ? "border-primary" : "border-transparent"
                      )}
                      onClick={() => setSelectedImageIndex(index)}
                    >
                      <img
                        src={image.thumbnail_url || image.file_url}
                        alt={image.file_name || "Task image"}
                        className="w-full h-full object-contain bg-muted/40"
                        onError={(e) => {
                          if (image.thumbnail_url && image.file_url) {
                            (e.target as HTMLImageElement).src = image.file_url;
                          }
                        }}
                      />
                    </button>
                  ))}
                </div>
                <div className="flex flex-col gap-2 shrink-0 pt-0.5">
                  <button
                    type="button"
                    onClick={() => openAssistant({ type: "task", id: taskId, name: (task as any)?.title })}
                    className="h-[35px] w-[35px] rounded-[8px] flex items-center justify-center bg-muted/50 shadow-e1 hover:shadow-e2 transition-all"
                    title="Ask FILLA"
                    aria-label="Open Assistant"
                  >
                    <FillaIcon size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => taskImageInputRef.current?.click()}
                    disabled={isUploadingImage}
                    className="h-[35px] w-[35px] rounded-[8px] flex items-center justify-center bg-muted/50 shadow-e1 hover:shadow-e2 transition-all disabled:opacity-50"
                    title="Upload image"
                    aria-label="Upload image"
                  >
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 justify-end items-end">
              <button
                type="button"
                onClick={() => openAssistant({ type: "task", id: taskId, name: (task as any)?.title })}
                className="h-[35px] w-[35px] rounded-[8px] flex items-center justify-center bg-muted/50 shadow-e1 hover:shadow-e2 transition-all"
                title="Ask FILLA"
                aria-label="Open Assistant"
              >
                <FillaIcon size={18} />
              </button>
              <button
                type="button"
                onClick={() => taskImageInputRef.current?.click()}
                disabled={isUploadingImage}
                className="h-[35px] w-[35px] rounded-[8px] flex items-center justify-center bg-muted/50 shadow-e1 hover:shadow-e2 transition-all disabled:opacity-50"
                title="Upload image"
                aria-label="Upload image"
              >
                <Upload className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
          )}
          {documentAttachments.length > 0 && (
            <div className="rounded-[10px] bg-muted/35 p-2 shadow-none">
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                Documents ({documentAttachments.length})
              </div>
              <div className="space-y-1.5">
                {documentAttachments.map((attachment: any) => (
                  <button
                    key={attachment.id}
                    type="button"
                    onClick={() => setSelectedDocument(attachment)}
                    className="w-full rounded-[8px] bg-background/70 px-3 py-2 text-left text-xs shadow-e1 hover:shadow-e2 transition-shadow"
                  >
                    <span className="block truncate font-medium text-foreground">
                      {attachment.file_name || "Document"}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {attachment.file_type || "file"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <input
            ref={taskImageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/heic,image/heif,.heic,.heif,.jpg,.jpeg,.png"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = e.target.files;
              if (files) {
                Array.from(files).forEach((f) => f.type.startsWith("image/") && uploadFile(f));
                e.target.value = "";
              }
            }}
          />
        </div>

        {/* Content — title, key facts, description, chips, messaging, activity */}
        <div className="p-4 space-y-4">
          <h2 className="text-sm font-semibold text-foreground tracking-tight line-clamp-2">
            {title.trim() || "Untitled task"}
          </h2>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveSection(activeSection === "when" ? null : "when")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm transition-shadow",
                "bg-muted/70 hover:shadow-md text-foreground"
              )}
            >
              <Calendar className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden />
              <span className="truncate max-w-[11rem]">{dueDateSummaryLabel}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection(activeSection === "who" ? null : "who")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm transition-shadow",
                "bg-muted/70 hover:shadow-md text-foreground"
              )}
            >
              <User className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden />
              <span className="truncate max-w-[11rem]">{assigneeSummaryLabel}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection(activeSection === "priority" ? null : "priority")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm transition-shadow",
                "bg-muted/70 hover:shadow-md text-foreground",
                priority === "urgent" && "text-destructive"
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
              <span>{prioritySummaryLabel}</span>
            </button>
          </div>

          <p className="text-[18px] text-foreground leading-relaxed">
            {(task as any)?.description || "No description provided"}
          </p>

          <div className="flex flex-wrap justify-end gap-2">
            <SemanticChip
              epistemic={hasWhoFacts ? "fact" : "proposal"}
              label={personChipLabel}
              truncate={hasWhoFacts}
              className={hasWhoFacts ? "max-w-[min(280px,85vw)]" : undefined}
              onPress={() => setActiveSection("who")}
            />
            <SemanticChip
              epistemic={hasWhereFacts ? "fact" : "proposal"}
              label={hasWhereFacts ? whereChipLabel : "+PLACE"}
              truncate={hasWhereFacts}
              className={hasWhereFacts ? "max-w-[min(280px,85vw)]" : undefined}
              onPress={() => setActiveSection("where")}
            />
            <SemanticChip
              epistemic={hasWhenFacts ? "fact" : "proposal"}
              label={hasWhenFacts ? whenChipLabel : "+DATE"}
              truncate={hasWhenFacts}
              className={hasWhenFacts ? "max-w-[min(280px,85vw)]" : undefined}
              onPress={() => setActiveSection("when")}
            />
            <SemanticChip
              epistemic={hasAssetFacts ? "fact" : "proposal"}
              label={hasAssetFacts ? assetChipLabel : "+ASSET"}
              truncate={hasAssetFacts}
              className={hasAssetFacts ? "max-w-[min(280px,85vw)]" : undefined}
              onPress={() => setActiveSection("what")}
            />
            <SemanticChip epistemic="fact" label={priority.toUpperCase()} truncate={false} onPress={() => setActiveSection("priority")} />
            <SemanticChip epistemic="fact" label={statusFactChips[0]?.label ?? "OPEN"} truncate={false} onPress={() => setActiveSection("status")} />
            <SemanticChip
              epistemic={hasCategoryFacts ? "fact" : "proposal"}
              label={hasCategoryFacts ? categoryChipLabel : "+TAG"}
              truncate={hasCategoryFacts}
              className={hasCategoryFacts ? "max-w-[min(280px,85vw)]" : undefined}
              onPress={() => setActiveSection("category")}
            />
            <SemanticChip
              epistemic={hasComplianceFacts ? "fact" : "proposal"}
              label={complianceChipLabel}
              truncate={hasComplianceFacts}
              className={hasComplianceFacts ? "max-w-[min(240px,85vw)]" : undefined}
              onPress={() => setActiveSection("compliance")}
            />
          </div>

          {activeSection === "who" && (
            <WhoSection
              isActive
              onActivate={() => setActiveSection("who")}
              assignedUserId={selectedUserId}
              assignedTeamIds={selectedTeamIds}
              onUserChange={(userId) => handleUserChange(userId)}
              onTeamsChange={(teamIds) => handleTeamsChange(teamIds)}
              pendingInvitations={pendingInvitations}
              onPendingInvitationsChange={setPendingInvitations}
              onInviteToOrg={(prefill) => {
                setInvitePrefill(prefill ?? null);
                setInviteModalOpen(true);
              }}
              onAddAsContractor={() => {
                setInvitePrefill(null);
                setInviteModalOpen(true);
              }}
            />
          )}

          {activeSection === "where" && (
            <WhereSection
              propertyId={localPropertyId}
              selectedPropertyIds={selectedPropertyIds}
              selectedSpaceIds={selectedSpaceIds}
              onPropertyChange={handlePropertyChangeSection}
              onSpacesChange={handleSpacesChange}
              showFactsByDefault
            />
          )}

          {activeSection === "when" && (
            <WhenSection
              isActive
              onActivate={() => setActiveSection("when")}
              onDeactivate={() => setActiveSection(null)}
              dueDate={dueDate}
              repeatRule={repeatRule}
              onDueDateChange={handleDueDateChange}
              onRepeatRuleChange={setRepeatRule}
              milestones={milestones}
              onMilestonesChange={setMilestones}
            />
          )}

          {activeSection === "what" && (
            <AssetSection
              isActive
              onActivate={() => setActiveSection("what")}
              propertyId={localPropertyId || undefined}
              spaceId={selectedSpaceIds[0]}
              selectedAssetIds={selectedAssetIds}
              onAssetsChange={handleAssetsChange}
            />
          )}

          {activeSection === "priority" && (
            <CreateTaskRow
              sectionId="priority"
              icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
              instruction="Add Priority"
              valueLabel="+Priority"
              isActive
              onActivate={() => setActiveSection("priority")}
              factChips={priorityFactChips}
              hoverChips={[
                { id: "low", label: "LOW", onPress: () => setPriority("low") },
                { id: "normal", label: "NORMAL", onPress: () => setPriority("normal") },
                { id: "high", label: "HIGH", onPress: () => setPriority("high") },
                { id: "urgent", label: "URGENT", onPress: () => setPriority("urgent") },
              ]}
            />
          )}

          {activeSection === "status" && (
            <CreateTaskRow
              sectionId="status"
              icon={<CircleDot className="h-4 w-4 text-muted-foreground" />}
              instruction="Set Status"
              valueLabel="+Status"
              isActive
              onActivate={() => setActiveSection("status")}
              factChips={statusFactChips}
              hoverChips={[
                { id: "open", label: "OPEN", onPress: () => setStatus("open") },
                { id: "in_progress", label: "IN PROGRESS", onPress: () => setStatus("in_progress") },
                { id: "completed", label: "DONE", onPress: () => setStatus("completed") },
                { id: "archived", label: "ARCHIVED", onPress: () => setStatus("archived") },
              ]}
            />
          )}

          {activeSection === "category" && (
            <CategorySection
              isActive
              onActivate={() => setActiveSection("category")}
              selectedThemeIds={selectedThemeIds}
              onThemesChange={handleThemesChange}
            />
          )}

          {activeSection === "compliance" && (
            <CreateTaskRow
              sectionId="compliance"
              icon={<Shield className="h-4 w-4 text-muted-foreground" />}
              instruction="Add Compliance Rule"
              valueLabel="+Rule"
              isActive
              onActivate={() => setActiveSection("compliance")}
              factChips={[]}
            >
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
            </CreateTaskRow>
          )}

          <Collapsible open={messagesOpen} onOpenChange={setMessagesOpen}>
            <CollapsibleTrigger
              className={cn(
                "flex w-full items-stretch gap-2 rounded-[10px] px-3 py-2.5 text-left text-sm font-medium",
                "bg-muted/40 shadow-sm hover:shadow-md transition-shadow text-foreground"
              )}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-left">
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 text-base leading-none" aria-hidden>
                      💬
                    </span>
                    <span className="truncate">Start a Conversation</span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      messagesOpen && "rotate-180"
                    )}
                    aria-hidden
                  />
                </div>
                {latestConversationMessage && (
                  <p className="line-clamp-2 pl-7 text-left text-xs font-normal leading-snug text-muted-foreground">
                    <span className="font-medium text-foreground/90">
                      {latestConversationMessage.author_name || "Someone"}
                    </span>
                    {latestConversationMessage.body?.trim() ? (
                      <>
                        <span className="text-muted-foreground/80"> · </span>
                        <span>{latestConversationMessage.body.trim()}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground/80"> · Sent an attachment</span>
                    )}
                  </p>
                )}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 data-[state=closed]:animate-out">
              <div className="flex max-h-[280px] min-h-0 h-[min(280px,42dvh)] flex-col overflow-hidden rounded-[10px] bg-muted/25 shadow-sm">
                <TaskMessaging taskId={taskId} />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={activityOpen} onOpenChange={setActivityOpen}>
            <CollapsibleTrigger
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-[10px] px-3 py-2.5 text-left text-sm font-medium",
                "bg-muted/40 shadow-sm hover:shadow-md transition-shadow text-foreground"
              )}
            >
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                View activity
              </span>
              <ChevronDown
                className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", activityOpen && "rotate-180")}
                aria-hidden
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-4 data-[state=closed]:animate-out">
              <GraphInsightPanel
                start={{ type: "task", id: taskId }}
                depth={2}
                variant="minimal"
                className="mb-1"
              />
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Upload Images</h3>
                <FileUploadZone
                  taskId={taskId}
                  propertyId={propertyId}
                  onUploadComplete={() => {
                    queryClient.invalidateQueries({ queryKey: ["task-attachments", taskId] });
                    queryClient.invalidateQueries({ queryKey: ["task-details", (task as any)?.org_id, taskId] });
                    queryClient.invalidateQueries({ queryKey: ["tasks"] });
                    refreshTask();
                    setSelectedImageIndex(0);
                  }}
                  accept="image/png,image/jpeg,image/jpg,image/heic,image/heif,.heic,.heif,.jpg,.jpeg,.png"
                />
              </div>
              {imageAttachments.length > 0 && (() => {
                const img = imageAttachments[selectedImageIndex ?? 0] as any;
                const orgId = (task as any)?.org_id;
                if (!orgId) return null;
                return (
                  <ImageAiActions
                    attachment={img}
                    assets={assets}
                    complianceItems={complianceItems.map((c: any) => ({
                      id: c.id,
                      title: c.title,
                      expiry_date: c.expiry_date,
                    }))}
                    orgId={orgId}
                    propertyId={propertyId}
                    taskId={taskId}
                    onRefresh={() => {
                      refreshTask();
                      queryClient.invalidateQueries({ queryKey: ["task-details", orgId, taskId] });
                      queryClient.invalidateQueries({ queryKey: ["assets", orgId, propertyId] });
                      queryClient.invalidateQueries({ queryKey: ["compliance", orgId] });
                    }}
                  />
                );
              })()}
              {imageAttachments.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">All Images ({imageAttachments.length})</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {imageAttachments.map((image: any) => (
                      <button
                        key={image.id}
                        type="button"
                        className="relative aspect-square rounded-lg overflow-hidden shadow-e1 group text-left"
                        onClick={() => {
                          if (!image?.id) return;
                          setEditingImageId(image.id);
                          setShowAnnotationEditor(true);
                        }}
                      >
                        <img
                          src={image.thumbnail_url || image.file_url}
                          alt={image.file_name || "Task image"}
                          className="w-full h-full object-contain bg-muted/40"
                          onError={(e) => {
                            if (image.thumbnail_url && image.file_url) {
                              (e.target as HTMLImageElement).src = image.file_url;
                            }
                          }}
                        />
                        <TaskImageAnnotationOverlay annotations={image.annotation_json} compact />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Logs
                </h3>
                <p className="text-muted-foreground text-sm">Audit logs and activity history will appear here</p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      {/* CTA panel - [Update][Mark Complete][Options] */}
      <div className="flex flex-col gap-3 pt-1 pb-4 px-4 border-0 flex-shrink-0 bg-transparent text-foreground sticky bottom-0">
        <div className="flex gap-3 items-center">
          {hasEdits && canManageTask && (
            <Button
              className="flex-1 shadow-primary-btn"
              onClick={handleUpdateTask}
              disabled={isUpdating}
            >
              {isUpdating ? "Updating..." : "Update"}
            </Button>
          )}
          {canManageTask && (
            <Button
              variant={status === "completed" ? "secondary" : "default"}
              className={cn(
                "flex-1",
                status !== "completed" && "shadow-primary-btn"
              )}
              onClick={async () => {
                if (status === "completed") return;
                if (isUpdating) return;
                setIsUpdating(true);
                const orgId = (task as any)?.org_id;
                const propId = (task as any)?.property_id ?? undefined;
                try {
                  const { error } = await supabase.from("tasks").update({ status: "completed" }).eq("id", taskId);
                  if (error) throw error;
                  setStatus("completed");
                  await refreshTask();
                  queryClient.invalidateQueries({ queryKey: ["tasks"] });
                  // Keep briefing radial correct: add or update this task as completed so "done" goes up, not "total" down.
                  // Do not invalidate/refetch tasks-briefing here or the refetch can overwrite with server data that excludes completed.
                  if (orgId) {
                    const updateBriefingCache = (key: (string | undefined)[]) => {
                      queryClient.setQueryData(key, (old: { id: string; status: string; property_id?: string }[] | undefined) => {
                        const list = Array.isArray(old) ? [...old] : [];
                        const idx = list.findIndex((t) => t.id === taskId);
                        const entry = { id: taskId, status: "completed", property_id: propId };
                        if (idx >= 0) {
                          list[idx] = { ...list[idx], ...entry };
                        } else {
                          list.push(entry);
                        }
                        return list;
                      });
                    };
                    updateBriefingCache(["tasks-briefing", orgId, null]);
                    if (propId) updateBriefingCache(["tasks-briefing", orgId, propId]);
                  }
                  toast({ title: "Task completed" });
                } catch (err: any) {
                  toast({ title: "Couldn't complete task", description: err.message, variant: "destructive" });
                } finally {
                  setIsUpdating(false);
                }
              }}
              disabled={isUpdating}
            >
              <CheckSquare className="h-4 w-4 mr-1.5" />
              {status === "completed" ? "Completed" : "Mark Complete"}
            </Button>
          )}
          {canManageTask && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="shadow-e1 gap-1.5">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={async () => {
                    if (isUpdating || !task) return;
                    setIsUpdating(true);
                    try {
                      const { data: newTask, error } = await supabase
                        .from("tasks")
                        .insert({
                          org_id: (task as any).org_id,
                          title: `${(task as any).title} (copy)`,
                          property_id: (task as any).property_id ?? null,
                          priority: (task as any).priority ?? "normal",
                          due_date: (task as any).due_date ?? null,
                          description: (task as any).description ?? null,
                          status: "open",
                        })
                        .select("id")
                        .single();
                      if (error) throw error;
                      queryClient.invalidateQueries({ queryKey: ["tasks"] });
                      toast({ title: "Task duplicated", description: "A copy has been added to your task list." });
                      onClose();
                    } catch (err: any) {
                      toast({ title: "Couldn't duplicate task", description: err.message, variant: "destructive" });
                    } finally {
                      setIsUpdating(false);
                    }
                  }}
                  disabled={isUpdating}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    if (isUpdating) return;
                    setIsUpdating(true);
                    try {
                      const { error } = await supabase
                        .from("tasks")
                        .update({ status: "archived" })
                        .eq("id", taskId);
                      if (error) throw error;
                      queryClient.invalidateQueries({ queryKey: ["tasks"] });
                      toast({ title: "Task archived" });
                      onClose();
                    } catch (err: any) {
                      toast({ title: "Couldn't archive task", description: err.message, variant: "destructive" });
                    } finally {
                      setIsUpdating(false);
                    }
                  }}
                  disabled={isUpdating}
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={isUpdating}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{(task as any)?.title ?? "this task"}" and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (isUpdating) return;
                setIsUpdating(true);
                try {
                  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
                  if (error) throw error;
                  queryClient.invalidateQueries({ queryKey: ["tasks"] });
                  toast({ title: "Task deleted" });
                  onClose();
                } catch (err: any) {
                  toast({ title: "Couldn't delete task", description: err.message, variant: "destructive" });
                } finally {
                  setIsUpdating(false);
                  setShowDeleteDialog(false);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  // Single column: Header, primary image, gallery, then tabs (all in panelContent)
  return (
    <>
    {panelWrapper(
        <div className="flex flex-1 flex-col overflow-hidden">
          {panelContent}
        </div>,
      "Task Details"
    )}
    
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
        setPendingInvitations((prev) => [
          ...prev,
          {
            id: `pending-${Date.now()}`,
            email: inv.email,
            firstName: inv.firstName,
            lastName: inv.lastName,
            displayName: `${inv.firstName} ${inv.lastName}`.trim(),
          },
        ]);
      }}
    />

    <Dialog open={Boolean(selectedDocument)} onOpenChange={(open) => !open && setSelectedDocument(null)}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2 border-b border-border/20">
          <DialogTitle className="truncate text-base">
            {selectedDocument?.file_name || "Document"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {selectedDocument?.file_type || "file"}
          </DialogDescription>
        </DialogHeader>
        <div className="h-[70vh] bg-muted/20">
          {selectedDocument && String(selectedDocument.file_type || "").toLowerCase().includes("pdf") ? (
            <iframe
              src={`${selectedDocument.file_url}#toolbar=1&navpanes=0&view=FitH`}
              title={selectedDocument.file_name || "PDF document"}
              className="w-full h-full border-0"
            />
          ) : selectedDocument ? (
            <div className="h-full flex flex-col items-center justify-center gap-3">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <a
                href={selectedDocument.file_url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary underline"
              >
                Open document in a new tab
              </a>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>

    {/* Image lightbox modal */}
    {lightboxOpen && imageAttachments.length > 0 && selectedImageIndex !== null && createPortal(
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
        onClick={() => setLightboxOpen(false)}
      >
        <button
          type="button"
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
          onClick={() => setLightboxOpen(false)}
          aria-label="Close lightbox"
        >
          <X className="h-6 w-6" />
        </button>

        {imageAttachments.length > 1 && (
          <>
            <button
              type="button"
              className="absolute left-4 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImageIndex((selectedImageIndex - 1 + imageAttachments.length) % imageAttachments.length);
              }}
              aria-label="Previous image"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              className="absolute right-4 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImageIndex((selectedImageIndex + 1) % imageAttachments.length);
              }}
              aria-label="Next image"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}

        <img
          src={imageAttachments[selectedImageIndex].file_url || imageAttachments[selectedImageIndex].optimized_url}
          alt={imageAttachments[selectedImageIndex].file_name || "Task image"}
          className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          onError={(e) => {
            const img = imageAttachments[selectedImageIndex];
            if (img.optimized_url && (e.target as HTMLImageElement).src !== img.optimized_url) {
              (e.target as HTMLImageElement).src = img.optimized_url;
            }
          }}
        />

        <div className="absolute bottom-4 text-white/70 text-sm">
          {selectedImageIndex + 1} / {imageAttachments.length}
        </div>
      </div>,
      document.body
    )}

    {/* Image Annotation Editor - Render in Portal to ensure proper z-index above Dialog */}
    {/* detectionOverlays={[]}: ai-image-analyse does not return bounding boxes (x,y,width,height).
        Overlays disabled until true bounding box support is implemented. */}
    {showAnnotationEditor && editingImageId && task && createPortal(
      <ImageAnnotationEditorWrapper
            taskId={taskId}
            imageId={editingImageId}
            imageUrl={
              task.images?.find((img: any) => img.id === editingImageId)?.file_url ||
              task.images?.find((img: any) => img.id === editingImageId)?.optimized_url ||
              task.images?.find((img: any) => img.id === editingImageId)?.thumbnail_url ||
              ""
            }
            detectionOverlays={[]}
            onClose={() => {
              setShowAnnotationEditor(false);
              setEditingImageId(null);
            }}
          />,
      document.body
    )}
    </>
  );
}

const OVERLAY_COLOR_MAP: Record<string, string> = {
  charcoal: "#1f2937",
  white: "#ffffff",
  "warning-orange": "#f59e0b",
  "danger-red": "#ef4444",
  "calm-blue": "#3b82f6",
  "success-green": "#22c55e",
};

function TaskImageAnnotationOverlay({
  annotations,
  compact = false,
}: {
  annotations?: Annotation[];
  compact?: boolean;
}) {
  if (!Array.isArray(annotations) || annotations.length === 0) return null;
  const strokeScale = compact ? 0.7 : 1;

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      {annotations.map((annotation) => {
        const color = OVERLAY_COLOR_MAP[annotation.strokeColor] || "#1f2937";
        const strokeWidth = annotation.strokeWidth === "bold" ? 0.8 : annotation.strokeWidth === "thin" ? 0.3 : 0.5;

        if (annotation.type === "pin") {
          return <circle key={annotation.annotationId} cx={annotation.x * 100} cy={annotation.y * 100} r={1.1} fill={color} />;
        }

        if (annotation.type === "arrow") {
          return (
            <g key={annotation.annotationId}>
              <line
                x1={annotation.from.x * 100}
                y1={annotation.from.y * 100}
                x2={annotation.to.x * 100}
                y2={annotation.to.y * 100}
                stroke={color}
                strokeWidth={strokeWidth * strokeScale}
                strokeLinecap="round"
              />
            </g>
          );
        }

        if (annotation.type === "rect") {
          return (
            <rect
              key={annotation.annotationId}
              x={annotation.x * 100}
              y={annotation.y * 100}
              width={annotation.width * 100}
              height={annotation.height * 100}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth * strokeScale}
            />
          );
        }

        if (annotation.type === "circle") {
          return (
            <circle
              key={annotation.annotationId}
              cx={annotation.x * 100}
              cy={annotation.y * 100}
              r={annotation.radius * 100}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth * strokeScale}
            />
          );
        }

        if (annotation.type === "text") {
          return (
            <text
              key={annotation.annotationId}
              x={annotation.x * 100}
              y={annotation.y * 100}
              fill={OVERLAY_COLOR_MAP[annotation.textColor] || color}
              fontSize={compact ? "2.2" : "3"}
            >
              {annotation.text}
            </text>
          );
        }

        if (annotation.type === "freedraw" && annotation.points.length > 1) {
          const polylinePoints = annotation.points.map((point) => `${point.x * 100},${point.y * 100}`).join(" ");
          return (
            <polyline
              key={annotation.annotationId}
              points={polylinePoints}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth * strokeScale}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        }

        return null;
      })}
    </svg>
  );
}

// Wrapper component to handle annotation hook
function ImageAnnotationEditorWrapper({
  taskId,
  imageId,
  imageUrl,
  detectionOverlays = [],
  onClose,
}: {
  taskId: string;
  imageId: string;
  imageUrl: string;
  detectionOverlays?: DetectionOverlay[];
  onClose: () => void;
}) {
  const { annotations, annotationVersions, loading, saveAnnotations } = useImageAnnotations(taskId, imageId);
  const { members } = useOrgMembers();

  // Original = no annotations when we have version history; otherwise attachment baseline
  const originalAnnotations =
    annotationVersions.length > 0 ? [] : annotations;
  const originalCreatedAt =
    annotationVersions.length > 0
      ? annotationVersions[annotationVersions.length - 1].created_at
      : new Date().toISOString();

  const originalLayer = {
    id: "original",
    createdAt: originalCreatedAt,
    userId: null as string | null,
    versionNumber: 0,
    label: "Original",
    annotations: originalAnnotations,
    userDisplayName: "Original",
    userAvatarUrl: null as string | null,
  };

  const versionSessions = annotationVersions.map((version) => {
    const member = members.find((m) => m.user_id === version.created_by);
    const displayName = member?.display_name ?? "Unknown user";
    const dateStr = new Date(version.created_at).toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });
    return {
      id: version.id,
      createdAt: version.created_at,
      userId: version.created_by,
      versionNumber: version.version_number,
      label: `Edit by ${displayName}, ${dateStr}`,
      annotations: version.annotations,
      userDisplayName: displayName,
      userAvatarUrl: member?.avatar_url ?? null,
    };
  });

  const editSessions = [originalLayer, ...versionSessions];

  if (loading) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center">
        <div className="text-white/80 text-sm">Loading annotations...</div>
      </div>
    );
  }

  return (
    <ImageAnnotationEditor
      imageUrl={imageUrl}
      imageId={imageId}
      taskId={taskId}
      initialAnnotations={annotations}
      editSessions={editSessions}
      detectionOverlays={detectionOverlays}
      onSave={async (anns, isAutosave) => {
        await saveAnnotations(anns);
        // Only close on manual save, not autosave
        if (!isAutosave) {
          onClose();
        }
      }}
      onCancel={onClose}
    />
  );
}
