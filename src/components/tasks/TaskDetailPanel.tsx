import { useState, useEffect, useRef, useMemo, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Copy, Archive, Trash2, MoreVertical, CheckSquare, Clock, Shield, AlertTriangle, CircleDot, X, ChevronLeft, ChevronRight, FileText, Upload, Pencil } from "lucide-react";
import { useGeoCaptureOnAction } from "@/hooks/useGeoCaptureOnAction";
import { GEO_EVIDENCE_CONSENT_LINE } from "@/lib/location/geoCaptureCopy";
import { useAssetsQuery } from "@/hooks/useAssetsQuery";
import { useComplianceQuery } from "@/hooks/useComplianceQuery";
import { TaskMessaging } from "./TaskMessaging";
import { markTaskCommentSeen } from "@/lib/taskCommentSeen";
import { ImageAnnotationEditor, type DetectionOverlay } from "./ImageAnnotationEditor";
import { ImageAiActions } from "./ai/ImageAiActions";
import { useImageAnnotations } from "@/hooks/useImageAnnotations";
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
import { columnShellClass, dialogContentWideClass } from "@/lib/layoutClasses";
import { useDataContext } from "@/contexts/DataContext";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useSpaces } from "@/hooks/useSpaces";
import { useCategories } from "@/hooks/useCategories";
import { InviteUserModal } from "@/components/invite/InviteUserModal";
import { WhoSection } from "./create/WhoSection";
import type { PendingInvitation } from "./create/tabs/WhoTab";
import { WhenSection, type MilestoneItem } from "./create/WhenSection";
import { WhereSection } from "./create/WhereSection";
import { AssetSection } from "./create/AssetSection";
import { CategorySection } from "./create/CategorySection";
import { CreateTaskRow } from "./create/CreateTaskRow";
import { differenceInCalendarDays, format, isToday, isValid, isYesterday, parseISO } from "date-fns";
import { getTaskDueUrgency } from "@/lib/taskDueUrgency";
import type { RepeatRule } from "@/types/database";
import type { SuggestedChip } from "@/types/chip-suggestions";
import type { Annotation } from "@/types/image-annotations";

import { Skeleton } from "@/components/ui/skeleton";
import { useTaskDetails } from "@/hooks/use-task-details";
import { useTaskTimeline } from "@/hooks/useTaskTimeline";
import { TaskTimeline } from "./TaskTimeline";
import { useDeleteTaskMutation } from "@/hooks/mutations/useDeleteTaskMutation";
import { useUpdateTaskMutation } from "@/hooks/mutations/useUpdateTaskMutation";
import {
  IntakeChipRow,
  type IntakeChipRowChip,
  type IntakeChipSlotId,
  type IntakeSlotPanelRows,
} from "@/components/intake/IntakeChipRow";
import { TaskDetailContent } from "@/components/tasks/detail/TaskDetailContent";
import { TaskDetailHeroMeta } from "@/components/tasks/detail/TaskDetailHeroMeta";
import {
  TaskDetailChecklistTab,
  TaskDetailChecklistActions,
} from "@/components/tasks/detail/TaskDetailChecklistTab";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import {
  clearTaskCompletionMotion,
  playTaskCompletionMotion,
} from "@/lib/taskCompletionMotion";
import {
  resolveTaskAssignerUser,
  resolveTaskAssigneeUsers,
} from "@/lib/userDisplayHelpers";
import { isTaskSpaceIllustrationUrl } from "@/lib/taskIllustration";

interface TaskDetailPanelProps {
  taskId: string;
  onClose: () => void;
  variant?: "modal" | "column"; // "modal" for mobile overlay, "column" for desktop third column
}

/**
 * Task Detail Panel
 *
 * Continuous task page: Overview (hero evidence + metadata + description) →
 * Checklist → Activity. Constitutional contexts from @Docs/05_Task_Engine.md §5.6
 * with evidence folded into the hero.
 */
export function TaskDetailPanel({ taskId, onClose, variant = "modal" }: TaskDetailPanelProps) {
  const { task, loading, error, refresh: refreshTask } = useTaskDetails(taskId);
  const { capture: captureGeo } = useGeoCaptureOnAction();
  const {
    data: timelineEvents,
    isLoading: timelineLoading,
    error: timelineError,
    refetch: refetchTimeline,
  } = useTaskTimeline(taskId);
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
  const { data: orgProperties = [] } = usePropertiesQuery();
  const { role: orgRole } = useActiveOrg();
  const canManageTemplates = orgRole === "owner" || orgRole === "manager";
  const queryClient = useQueryClient();
  const deleteTaskMutation = useDeleteTaskMutation();
  const updateTaskMutation = useUpdateTaskMutation();
  const { members } = useOrgMembers();
  const [title, setTitle] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [status, setStatus] = useState<string>("open");
  const [priority, setPriority] = useState<string>("normal");
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [showAnnotationEditor, setShowAnnotationEditor] = useState(false);
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [taskEditOpen, setTaskEditOpen] = useState(false);
  const [openChipSlot, setOpenChipSlot] = useState<IntakeChipSlotId | null>(null);
  const [evidenceSlideIndex, setEvidenceSlideIndex] = useState(0);
  const [focusComposeKey] = useState(0);
  const [dueDate, setDueDate] = useState("");
  const [repeatRule, setRepeatRule] = useState<RepeatRule | undefined>();
  const [localPropertyId, setLocalPropertyId] = useState("");
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [selectedSpaceIds, setSelectedSpaceIds] = useState<string[]>([]);
  const { spaces: propertySpaces = [] } = useSpaces(localPropertyId || propertyId || undefined);
  const { categories: orgCategories } = useCategories();
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
  const prevHydratedTaskIdRef = useRef<string | null>(null);
  const prevAssetTaskIdRef = useRef<string | null>(null);

  // Reset edit UI when switching tasks
  useEffect(() => {
    setTaskEditOpen(false);
    setOpenChipSlot(null);
  }, [taskId]);

  // Opening detail clears the “new comment” bubble on task cards
  useEffect(() => {
    if (!taskId) return;
    markTaskCommentSeen(taskId);
  }, [taskId]);

  // Update scalar local state when task data loads
  useEffect(() => {
    if (task) {
      setTitle((task as any).title || "");
      setDescriptionDraft(String((task as any).description ?? ""));
      setStatus((task as any).status || "open");
      setPriority((task as any).priority || "normal");
      setSelectedUserId(task.assigned_user_id || undefined);
      const teamsArray = Array.isArray(task.teams) ? task.teams : (typeof task.teams === 'string' ? JSON.parse(task.teams) : []);
      setSelectedTeamIds(teamsArray.map((t: any) => t.id) || []);
      setDueDate((task as any)?.due_date || (task as any)?.due_at || "");
      setLocalPropertyId((task as any)?.property_id || "");
      setSelectedPropertyIds((task as any)?.property_id ? [(task as any).property_id] : []);
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

  // Collection ids: replace when switching tasks; merge on refresh (preserve optimistic edits)
  useEffect(() => {
    if (!task) return;
    const fromTaskSpaces = (task.spaces as any[])?.map((s: any) => s.id).filter(Boolean) || [];
    const fromTaskThemes = (task.categories ?? []).map((c: any) => c.id).filter(Boolean);

    if (prevHydratedTaskIdRef.current !== taskId) {
      prevHydratedTaskIdRef.current = taskId;
      setSelectedSpaceIds(fromTaskSpaces);
      setSelectedThemeIds(fromTaskThemes);
      return;
    }

    setSelectedSpaceIds((prev) => {
      if (prev.length === 0) return fromTaskSpaces;
      const merged = new Set([...prev, ...fromTaskSpaces]);
      const next = [...merged];
      return next.length === prev.length && prev.every((id) => merged.has(id)) ? prev : next;
    });

    setSelectedThemeIds((prev) => {
      if (prev.length === 0) return fromTaskThemes;
      const merged = new Set([...prev, ...fromTaskThemes]);
      const next = [...merged];
      return next.length === prev.length && prev.every((id) => merged.has(id)) ? prev : next;
    });
  }, [task, taskId]);

  // Initialize asset IDs from separate query (replace on task switch; merge on refetch)
  useEffect(() => {
    if (prevAssetTaskIdRef.current !== taskId) {
      prevAssetTaskIdRef.current = taskId;
      setSelectedAssetIds(taskAssets.map((a) => a.id));
      return;
    }
    if (taskAssets.length === 0) return;
    const fromQuery = taskAssets.map((a) => a.id);
    setSelectedAssetIds((prev) => {
      if (prev.length === 0) return fromQuery;
      const merged = new Set([...prev, ...fromQuery]);
      const next = [...merged];
      return next.length === prev.length && prev.every((id) => merged.has(id)) ? prev : next;
    });
  }, [taskId, taskAssets]);


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

  const handleUpdateTask = () => {
    if (isUpdating) return;
    setIsUpdating(true);
    const orgId = (task as any)?.org_id;
    const propId = (task as any)?.property_id ?? null;
    updateTaskMutation.mutate(
      {
        taskId,
        orgId: orgId ?? "",
        propertyId: propId,
        updates: {
          title,
          description: descriptionDraft.trim() || null,
          status: status as any,
          priority: priority as any,
          due_date: dueDate || null,
          milestones: milestones.length > 0 ? milestones : [],
        },
      },
      {
        onSuccess: async () => {
          await refreshTask();
          toast({ title: "Task updated", description: "Changes saved successfully" });
        },
        onError: (err) => {
          toast({
            title: "Couldn't update task",
            description: (err as Error).message || "Something didn't work. Try again.",
            variant: "destructive",
          });
        },
        onSettled: () => setIsUpdating(false),
      }
    );
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
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
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
    const label = (
      {
        open: "OPEN",
        in_progress: "IN PROGRESS",
        waiting_review: "WAITING REVIEW",
        completed: "DONE",
        archived: "ARCHIVED",
      } as Record<string, string>
    )[status] || status.toUpperCase();
    return [{ id: `status-${status}`, type: "priority" as const, value: status, label, score: 1, source: "rule" as const, resolvedEntityId: status }];
  }, [status]);

  const statusChipLabel = useMemo(() => {
    return (
      (
        {
          open: "Open",
          in_progress: "In progress",
          waiting_review: "Waiting review",
          completed: "Done",
          archived: "Archived",
        } as Record<string, string>
      )[status] || status
    ).toUpperCase();
  }, [status]);

  const dueUrgencyChip = useMemo(() => {
    const urgency = getTaskDueUrgency({ due_date: dueDate || null, status });
    if (urgency === "overdue") return "overdue" as const;
    if (urgency === "due_soon") return "nearly_due" as const;
    return null;
  }, [dueDate, status]);

  const dueChipLabel = useMemo(() => {
    if (!dueDate) return null;
    const d = dueDate.includes("T") ? parseISO(dueDate) : parseISO(`${dueDate}T12:00:00`);
    if (!isValid(d)) return null;
    const hasTime = dueDate.includes("T");
    return hasTime ? format(d, "EEE d MMM · HH:mm") : format(d, "EEE d MMM");
  }, [dueDate]);

  const statusChipTextClass = useMemo(() => {
    if (status === "open") return "text-success-foreground";
    if (status === "completed" || status === "archived") return "text-muted-foreground";
    if (status === "waiting_review") return "text-warning-foreground";
    return "text-primary-deep";
  }, [status]);

  const taskTeams = useMemo(() => {
    const raw = (task as any)?.teams;
    if (Array.isArray(raw)) return raw as { id: string; name?: string }[];
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw) as { id: string; name?: string }[];
      } catch {
        return [];
      }
    }
    return [];
  }, [task]);

  const resolveSpaceLabel = useCallback(
    (spaceId: string) => {
      const spacesRaw = (task as any)?.spaces;
      const spacesArr = Array.isArray(spacesRaw) ? spacesRaw : [];
      const fromTask = spacesArr.find((s: { id?: string }) => s.id === spaceId);
      if (fromTask?.name) return fromTask.name as string;
      const fromQuery = propertySpaces.find((s) => s.id === spaceId);
      return fromQuery?.name || "Space";
    },
    [task, propertySpaces]
  );

  const statusTone = useMemo(() => {
    if (status === "open") return "open" as const;
    if (status === "in_progress") return "progress" as const;
    if (status === "waiting_review") return "review" as const;
    if (status === "completed" || status === "archived") return "done" as const;
    return "other" as const;
  }, [status]);

  const formatDueChipLabel = useCallback((dateStr: string) => {
    const d = dateStr.includes("T") ? parseISO(dateStr) : parseISO(`${dateStr}T12:00:00`);
    return isValid(d) ? format(d, "EEE d MMM").toUpperCase() : dateStr.toUpperCase();
  }, []);

  const taskDetailChips: IntakeChipRowChip[] = useMemo(() => {
    const chips: IntakeChipRowChip[] = [];
    const openSlot = (slot: IntakeChipSlotId) => {
      setOpenChipSlot((prev) => (prev === slot ? null : slot));
    };

    if (selectedUserId) {
      const m = members.find((x) => x.user_id === selectedUserId);
      const label = (m?.display_name || m?.nickname || m?.email || "Assignee").toUpperCase();
      chips.push({
        id: `who-${selectedUserId}`,
        slot: "who",
        label,
        epistemic: "fact",
        removable: true,
        onPress: () => openSlot("who"),
        onRemove: () => handleUserChange(undefined),
      });
    }

    selectedTeamIds.forEach((teamId) => {
      const team = taskTeams.find((t) => t.id === teamId);
      chips.push({
        id: `who-team-${teamId}`,
        slot: "who",
        label: (team?.name || "Team").toUpperCase(),
        epistemic: "fact",
        removable: true,
        onPress: () => openSlot("who"),
        onRemove: () => handleTeamsChange(selectedTeamIds.filter((id) => id !== teamId)),
      });
    });

    const propName =
      (task as any)?.property?.nickname || (task as any)?.property_name || "";
    selectedSpaceIds.forEach((spaceId) => {
      chips.push({
        id: `where-space-${spaceId}`,
        slot: "where",
        label: resolveSpaceLabel(spaceId).toUpperCase(),
        epistemic: "fact",
        removable: true,
        onPress: () => openSlot("where"),
        onRemove: () => handleSpacesChange(selectedSpaceIds.filter((id) => id !== spaceId)),
      });
    });

    if (dueDate) {
      chips.push({
        id: `when-${dueDate}`,
        slot: "when",
        label: formatDueChipLabel(dueDate),
        epistemic: "fact",
        removable: true,
        onPress: () => openSlot("when"),
        onRemove: () => handleDueDateChange(""),
      });
    }

    milestones.forEach((milestone) => {
      chips.push({
        id: `when-milestone-${milestone.id}`,
        slot: "when",
        label: `${milestone.name} ${milestone.date ? formatDueChipLabel(milestone.date) : ""}`.trim().toUpperCase(),
        epistemic: "fact",
        removable: true,
        onPress: () => openSlot("when"),
        onRemove: () => setMilestones((prev) => prev.filter((m) => m.id !== milestone.id)),
      });
    });

    taskAssets
      .filter((a) => selectedAssetIds.includes(a.id))
      .forEach((asset) => {
        chips.push({
          id: `asset-${asset.id}`,
          slot: "asset",
          label: (asset.name || "Asset").toUpperCase(),
          epistemic: "fact",
          removable: true,
          onPress: () => openSlot("asset"),
          onRemove: () => handleAssetsChange(selectedAssetIds.filter((id) => id !== asset.id)),
        });
      });

    if (priority === "urgent" || priority === "high") {
      chips.push({
        id: `priority-${priority}`,
        slot: "priority",
        label: priority.toUpperCase(),
        epistemic: "fact",
        removable: true,
        onPress: () => openSlot("priority"),
        onRemove: () => setPriority("normal"),
      });
    }

    const taskCategories = Array.isArray((task as any)?.categories) ? (task as any).categories : [];
    selectedThemeIds.forEach((themeId) => {
      if (themeId.startsWith("ghost-theme-")) {
        const ghostMatch = themeId.match(/^ghost-theme-(.+?)-category$/);
        const ghostName = ghostMatch?.[1]?.replace(/-/g, " ");
        chips.push({
          id: `category-${themeId}`,
          slot: "category",
          label: (ghostName || "Tag").toUpperCase(),
          epistemic: "fact",
          removable: true,
          onPress: () => openSlot("category"),
          onRemove: () => handleThemesChange(selectedThemeIds.filter((id) => id !== themeId)),
        });
        return;
      }
      const fromTask = taskCategories.find((c: { id: string }) => c.id === themeId);
      const fromOrg = orgCategories.find((c) => c.id === themeId);
      const label = fromTask?.name || fromOrg?.name;
      if (!label) return;
      chips.push({
        id: `category-${themeId}`,
        slot: "category",
        label: label.toUpperCase(),
        epistemic: "fact",
        removable: true,
        onPress: () => openSlot("category"),
        onRemove: () => handleThemesChange(selectedThemeIds.filter((id) => id !== themeId)),
      });
    });

    if (propName && chips.length > 0) {
      chips.unshift({
        id: `where-property-${(task as any)?.property_id || "property"}`,
        slot: "where",
        label: propName.toUpperCase(),
        epistemic: "fact",
        removable: false,
        onPress: () => openSlot("where"),
      });
    }

    return chips;
  }, [
    members,
    selectedUserId,
    selectedTeamIds,
    taskTeams,
    task,
    selectedSpaceIds,
    dueDate,
    milestones,
    taskAssets,
    selectedAssetIds,
    priority,
    selectedThemeIds,
    formatDueChipLabel,
    handleUserChange,
    handleTeamsChange,
    handleSpacesChange,
    handleDueDateChange,
    handleAssetsChange,
    handleThemesChange,
    resolveSpaceLabel,
    orgCategories,
  ]);

  const renderTaskDetailSlotContent = useCallback(
    (slot: IntakeChipSlotId, onClose: () => void): IntakeSlotPanelRows => {
      const row3 = null;
      switch (slot) {
        case "who":
          return {
            row2: (
              <WhoSection
                isActive
                embedded
                onActivate={() => setOpenChipSlot("who")}
                assignedUserId={selectedUserId}
                assignedTeamIds={selectedTeamIds}
                onUserChange={(userId) => {
                  void handleUserChange(userId);
                  onClose();
                }}
                onTeamsChange={(teamIds) => {
                  void handleTeamsChange(teamIds);
                }}
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
            ),
            row3,
          };
        case "where":
          return {
            row2: (
              <WhereSection
                isActive
                embedded
                propertyId={localPropertyId}
                selectedPropertyIds={selectedPropertyIds}
                selectedSpaceIds={selectedSpaceIds}
                onPropertyChange={handlePropertyChangeSection}
                onSpacesChange={handleSpacesChange}
                showFactsByDefault
              />
            ),
            row3,
          };
        case "when":
          return {
            row2: (
              <WhenSection
                isActive
                embedded
                onActivate={() => setOpenChipSlot("when")}
                onDeactivate={onClose}
                dueDate={dueDate}
                repeatRule={repeatRule}
                onDueDateChange={handleDueDateChange}
                onRepeatRuleChange={setRepeatRule}
                milestones={milestones}
                onMilestonesChange={setMilestones}
              />
            ),
            row3,
          };
        case "asset":
          return {
            row2: (
              <AssetSection
                isActive
                embedded
                onActivate={() => setOpenChipSlot("asset")}
                propertyId={localPropertyId || undefined}
                spaceId={selectedSpaceIds[0]}
                selectedAssetIds={selectedAssetIds}
                onAssetsChange={handleAssetsChange}
              />
            ),
            row3,
          };
        case "priority":
          return {
            row2: (
              <CreateTaskRow
                sectionId="priority"
                icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
                instruction="Add Priority"
                valueLabel="+Priority"
                isActive
                embedded
                onActivate={() => setOpenChipSlot("priority")}
                factChips={priorityFactChips}
                hoverChips={[
                  { id: "low", label: "LOW", onPress: () => setPriority("low") },
                  { id: "normal", label: "NORMAL", onPress: () => setPriority("normal") },
                  { id: "high", label: "HIGH", onPress: () => setPriority("high") },
                  { id: "urgent", label: "URGENT", onPress: () => setPriority("urgent") },
                ]}
              />
            ),
            row3,
          };
        case "status":
          return {
            row2: (
              <CreateTaskRow
                sectionId="status"
                icon={<CircleDot className="h-4 w-4 text-muted-foreground" />}
                instruction="Set Status"
                valueLabel="+Status"
                isActive
                embedded
                onActivate={() => setOpenChipSlot("status")}
                factChips={statusFactChips}
                hoverChips={[
                  { id: "open", label: "OPEN", onPress: () => setStatus("open") },
                  { id: "in_progress", label: "IN PROGRESS", onPress: () => setStatus("in_progress") },
                  { id: "waiting_review", label: "WAITING REVIEW", onPress: () => setStatus("waiting_review") },
                  { id: "completed", label: "DONE", onPress: () => setStatus("completed") },
                  { id: "archived", label: "ARCHIVED", onPress: () => setStatus("archived") },
                ]}
              />
            ),
            row3,
          };
        case "category":
          return {
            row2: (
              <CategorySection
                isActive
                embedded
                onActivate={() => setOpenChipSlot("category")}
                selectedThemeIds={selectedThemeIds}
                onThemesChange={handleThemesChange}
              />
            ),
            row3,
          };
        case "compliance":
          return {
            row2: (
              <CreateTaskRow
                sectionId="compliance"
                icon={<Shield className="h-4 w-4 text-muted-foreground" />}
                instruction="Add Compliance Rule"
                valueLabel="+Rule"
                isActive
                embedded
                onActivate={() => setOpenChipSlot("compliance")}
                factChips={[]}
              >
                <div className="flex items-center gap-2 flex-nowrap overflow-x-auto min-w-0">
                  <label className="text-caption font-mono uppercase text-muted-foreground">Compliance</label>
                  <Switch id="task-detail-compliance" checked={isCompliance} onCheckedChange={setIsCompliance} />
                  {isCompliance && (
                    <Select value={complianceLevel} onValueChange={setComplianceLevel}>
                      <SelectTrigger className="h-8 w-auto min-w-[100px] text-caption font-mono">
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
            ),
            row3,
          };
        default:
          return { row2: null, row3 };
      }
    },
    [
      selectedUserId,
      selectedTeamIds,
      pendingInvitations,
      localPropertyId,
      selectedPropertyIds,
      selectedSpaceIds,
      dueDate,
      repeatRule,
      milestones,
      selectedAssetIds,
      priorityFactChips,
      statusFactChips,
      selectedThemeIds,
      isCompliance,
      complianceLevel,
      handleUserChange,
      handleTeamsChange,
      handlePropertyChangeSection,
      handleSpacesChange,
      handleDueDateChange,
      handleAssetsChange,
      handleThemesChange,
    ]
  );

  /** Secondary row chips: show real values instead of generic PLACE / DATE / … */
  const { userId, user } = useDataContext();
  const allAttachments = (task as any)?.images ?? [];
  const imageAttachments = useMemo(
    () =>
      (Array.isArray(allAttachments) ? allAttachments : []).filter((attachment: any) => {
        const src = attachment?.file_url || attachment?.thumbnail_url || "";
        // Ignore space mini-card art stored on tasks.image_url — not a real upload
        if (isTaskSpaceIllustrationUrl(src)) return false;
        const fileType = String(attachment?.file_type || "").toLowerCase();
        const fileName = String(attachment?.file_name || "").toLowerCase();
        // image_url fallback from tasks_view may omit mime / file_name
        if (!fileType && !fileName && src) return true;
        return (
          fileType.startsWith("image/") ||
          /\.(png|jpe?g|webp|gif|heic|heif|bmp|svg)$/.test(fileName)
        );
      }),
    [allAttachments]
  );
  const assignerUser = useMemo(
    () =>
      resolveTaskAssignerUser(task as any, members, user, {
        hideWhenSameAsAssignee: false,
      }),
    [task, members, user]
  );
  const assigneeUser = useMemo(
    () => resolveTaskAssigneeUsers(task as any, members, "#8EC9CE", user)[0] ?? null,
    [task, members, user]
  );

  const propertyChip = useMemo(() => {
    const propId = (task as any)?.property_id as string | undefined;
    if (!propId) return null;
    const fromOrg = orgProperties.find((p: any) => p.id === propId);
    return {
      id: propId,
      iconName: fromOrg?.icon_name ?? null,
      iconColorHex: fromOrg?.icon_color_hex ?? "#8EC9CE",
    };
  }, [task, orgProperties]);

  const propertyLabelForHero = useMemo(() => {
    // Hide property when the org only has one — space carries the useful place signal.
    if (orgProperties.length <= 1) return null;
    return (
      (task as any)?.property?.nickname ||
      (task as any)?.property_name ||
      orgProperties.find((p: any) => p.id === (task as any)?.property_id)?.nickname ||
      orgProperties.find((p: any) => p.id === (task as any)?.property_id)?.address ||
      null
    );
  }, [task, orgProperties]);

  const spaceLabelForHero = useMemo(() => {
    const spaceNames = selectedSpaceIds
      .map((id) => resolveSpaceLabel(id))
      .filter((name) => name && name !== "Space");
    if (spaceNames.length === 0) return null;
    return spaceNames.join(" · ");
  }, [selectedSpaceIds, resolveSpaceLabel]);

  const createdContextLine = useMemo(() => {
    const raw = (task as any)?.created_at as string | undefined;
    if (!raw) {
      return assignerUser?.name ? `Created by ${assignerUser.name}` : null;
    }
    const d = parseISO(raw);
    if (!isValid(d)) {
      return assignerUser?.name ? `Created by ${assignerUser.name}` : null;
    }
    const timePart = isToday(d)
      ? `Today ${format(d, "HH:mm")}`
      : isYesterday(d)
        ? `Yesterday ${format(d, "HH:mm")}`
        : format(d, "d MMM · HH:mm");
    const who = assignerUser?.name;
    return who ? `Created by ${who} · ${timePart}` : timePart;
  }, [task, assignerUser]);

  const { data: checklistItemCount = 0 } = useQuery({
    queryKey: ["task-subtask-count", taskId],
    enabled: Boolean(taskId),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("subtasks")
        .select("id", { count: "exact", head: true })
        .eq("task_id", taskId);
      if (error) return 0;
      return count ?? 0;
    },
  });

  const { data: commentCount = 0 } = useQuery({
    queryKey: ["task-comment-count", taskId],
    enabled: Boolean(taskId),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("task_id", taskId);
      if (error) return 0;
      return count ?? 0;
    },
  });

  const assetLabels = useMemo(
    () =>
      taskAssets
        .filter((a) => selectedAssetIds.includes(a.id))
        .map((a) => (a.name || "Asset").toUpperCase()),
    [taskAssets, selectedAssetIds]
  );

  const tagLabels = useMemo(() => {
    const cats = (task as any)?.categories;
    const fromTask = Array.isArray(cats) ? cats : [];
    const ids = selectedThemeIds.length > 0 ? selectedThemeIds : fromTask.map((c: any) => c.id);
    return ids
      .map((id: string) => {
        const fromTaskCat = fromTask.find((c: any) => c.id === id);
        if (fromTaskCat?.name) return String(fromTaskCat.name).toUpperCase();
        const fromOrg = orgCategories.find((c) => c.id === id);
        return (fromOrg?.name || "Tag").toUpperCase();
      })
      .filter(Boolean);
  }, [task, selectedThemeIds, orgCategories]);

  const complianceLabel = useMemo(() => {
    if (!isCompliance) return null;
    return (complianceLevel || "Compliance rule").toUpperCase();
  }, [isCompliance, complianceLevel]);

  const priorityChipLabel = useMemo(() => {
    if (priority === "urgent") return "URGENT";
    if (priority === "high") return "HIGH";
    return null;
  }, [priority]);

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

  const evidenceItems = useMemo(() => {
    const extraImages = imageAttachments.slice(1);
    return [...extraImages, ...documentAttachments];
  }, [imageAttachments, documentAttachments]);

  useEffect(() => {
    if (evidenceItems.length === 0) {
      setEvidenceSlideIndex(0);
      return;
    }
    if (evidenceSlideIndex >= evidenceItems.length) {
      setEvidenceSlideIndex(0);
    }
  }, [evidenceItems, evidenceSlideIndex]);

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
      descriptionDraft !== String((task as any)?.description ?? "") ||
      status !== ((task as any)?.status || "open") ||
      priority !== ((task as any)?.priority || "normal") ||
      dueDate !== ((task as any)?.due_date || (task as any)?.due_at || "") ||
      JSON.stringify(milestones) !== origMsJson
    );
  }, [task, title, descriptionDraft, status, priority, dueDate, milestones]);

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
        <div className={cn(columnShellClass, "overflow-hidden rounded-xl shadow-none border-0 bg-background")}>
          {content}
        </div>
      );
    }
    return (
      <Dialog
        open={true}
        // Annotation / lightbox are portaled to document.body. Keep the task dialog
        // non-modal while they are open so Radix does not swallow their pointer events.
        modal={!showAnnotationEditor && !lightboxOpen}
        onOpenChange={(open) => {
          if (!open && showAnnotationEditor) return;
          if (!open && lightboxOpen) {
            setLightboxOpen(false);
            return;
          }
          if (!open) onClose();
        }}
      >
        <DialogContent
          className="max-h-[90vh] overflow-hidden flex flex-col p-0 min-w-0"
          aria-describedby="task-detail-panel-desc"
          onPointerDownOutside={(event) => {
            if (showAnnotationEditor || lightboxOpen) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (showAnnotationEditor || lightboxOpen) event.preventDefault();
          }}
          onFocusOutside={(event) => {
            if (showAnnotationEditor || lightboxOpen) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (showAnnotationEditor || lightboxOpen) event.preventDefault();
          }}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{title ?? "Task details"}</DialogTitle>
            <DialogDescription id="task-detail-panel-desc">
            Task detail: description, checklist, evidence, and timeline.
            </DialogDescription>
          </DialogHeader>
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

  const taskTitle = String((task as any)?.title ?? "Task");
  const taskDescription = String((task as any)?.description ?? "").trim();
  const titleMatchesDescription =
    Boolean(taskDescription) &&
    taskDescription.toLowerCase() === taskTitle.trim().toLowerCase();

  const descriptionSection = (
    <div className="space-y-3">
      {taskEditOpen ? (
        <>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            className="w-full h-10 rounded-lg bg-input px-3 text-sm font-medium shadow-engraved border-0 outline-none focus:ring-2 focus:ring-primary/30"
          />
          <textarea
            value={descriptionDraft}
            onChange={(e) => setDescriptionDraft(e.target.value)}
            placeholder="What needs doing?"
            rows={3}
            className="w-full rounded-lg bg-input px-3 py-2 text-sm shadow-engraved border-0 outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
          <IntakeChipRow
            layout="interleaved"
            chips={taskDetailChips}
            onOpenSlot={setOpenChipSlot}
            openSlot={openChipSlot}
            onCloseSlot={() => setOpenChipSlot(null)}
            renderSlotContent={renderTaskDetailSlotContent}
          />
        </>
      ) : !titleMatchesDescription && taskDescription ? (
        <p className="text-base leading-relaxed text-foreground">{taskDescription}</p>
      ) : null}
    </div>
  );

  const hideDescriptionSection =
    !taskEditOpen && (titleMatchesDescription || !taskDescription);

  const hasTimelineActivity = !timelineLoading && !timelineError && (timelineEvents?.length ?? 0) > 0;

  const activitySection = (
    <div id="task-detail-comment" className="space-y-5">
      {timelineLoading ? (
        <div className="space-y-2 py-1">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ) : timelineError ? (
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t load activity.{" "}
          <button
            type="button"
            className="text-primary underline-offset-2 hover:underline"
            onClick={() => void refetchTimeline()}
          >
            Retry
          </button>
        </p>
      ) : hasTimelineActivity ? (
        <TaskTimeline events={timelineEvents} variant="activity" />
      ) : null}
      <TaskMessaging
        taskId={taskId}
        variant="activity"
        focusComposeKey={focusComposeKey}
      />
    </div>
  );

  const panelContent = (
    <>
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
      <TaskDetailContent
        title={taskTitle}
        showTitle={false}
        scrollRef={panelScrollRef}
        descriptionHeading={false}
        hideDescription={hideDescriptionSection}
        hero={
          <TaskDetailHeroMeta
            title={taskTitle}
            images={imageAttachments
              .map((image: any, index: number) => ({
                id: String(image.id || `img-${index}`),
                src: image.thumbnail_url || image.optimized_url || image.file_url || "",
                heroSrc: image.optimized_url || image.file_url || image.thumbnail_url || "",
                alt: image.file_name || `Task image ${index + 1}`,
              }))
              .filter((image) => Boolean(image.src))}
            selectedIndex={selectedImageIndex}
            onSelectImage={setSelectedImageIndex}
            onOpenImage={(index) => {
              setSelectedImageIndex(index);
              const selectedImage = imageAttachments[index] as any;
              if (selectedImage?.id) {
                setEditingImageId(selectedImage.id);
                setShowAnnotationEditor(true);
                return;
              }
              setLightboxOpen(true);
            }}
            statusLabel={statusChipLabel}
            statusTone={statusTone}
            priorityUrgent={priority === "urgent"}
            urgencyChip={dueUrgencyChip}
            tagLabels={tagLabels}
            dueLabel={dueChipLabel}
            locationLabel={spaceLabelForHero || propertyLabelForHero}
            contextLine={createdContextLine}
            counts={{
              photos: imageAttachments.length,
              checklist: checklistItemCount,
              comments: commentCount,
            }}
            assigner={assignerUser}
            assignee={assigneeUser}
          />
        }
        description={descriptionSection}
        sections={[
          {
            id: "checklist",
            title: null,
            elevated: true,
            content: (
              <TaskDetailChecklistTab
                taskId={taskId}
                canEdit={canManageTask}
                canManageTemplates={canManageTemplates}
                editMode={taskEditOpen}
              />
            ),
            hidden: false,
          },
          {
            id: "activity",
            title: "Activity",
            content: activitySection,
            hidden: false,
          },
        ]}
      />

      <div className="flex flex-col gap-1.5 pt-2 pb-4 px-4 border-0 flex-shrink-0 bg-background/95 backdrop-blur-sm text-foreground sticky bottom-0 z-10">
        <div className="flex gap-2 items-center min-w-0 w-full">
          {canManageTask && taskEditOpen ? (
            <Button
              type="button"
              variant="outline"
              className="shrink-0 shadow-e1"
              onClick={handleUpdateTask}
              disabled={isUpdating || !hasEdits}
              title={hasEdits ? "Save changes" : "No changes to save"}
            >
              {isUpdating ? "…" : "Update"}
            </Button>
          ) : null}
          {canManageTask && (
            <Button
              variant={status === "completed" ? "secondary" : "default"}
              className={cn(
                "min-w-0 flex-1 shrink",
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
                  captureGeo("task_complete", {
                    taskId,
                    propertyId: propId,
                  });
                  onClose();
                  await playTaskCompletionMotion(taskId);
                  await queryClient.invalidateQueries({ queryKey: ["tasks"] });
                  clearTaskCompletionMotion(taskId);
                  queryClient.invalidateQueries({ queryKey: ["task-audit-log", orgId, taskId] });
                  if (orgId && propId) {
                    queryClient.invalidateQueries({
                      queryKey: ["property-timeline", orgId, propId],
                    });
                    queryClient.invalidateQueries({
                      queryKey: ["property-vendors", orgId, propId],
                    });
                    queryClient.invalidateQueries({
                      queryKey: ["property-drift", orgId, propId],
                    });
                  }
                } catch (err: any) {
                  clearTaskCompletionMotion(taskId);
                  toast({ title: "Couldn't complete task", description: err.message, variant: "destructive" });
                } finally {
                  setIsUpdating(false);
                }
              }}
              disabled={isUpdating}
            >
              <CheckSquare className="h-4 w-4 mr-1.5 shrink-0" />
              {status === "completed" ? "Completed" : "Mark Complete"}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="h-10 shrink-0 gap-1.5 px-3 shadow-e1 text-foreground"
            onClick={() => taskImageInputRef.current?.click()}
            disabled={isUploadingImage}
            aria-label={isUploadingImage ? "Uploading evidence" : "Upload evidence"}
            title={isUploadingImage ? "Uploading…" : "Upload evidence"}
          >
            <Upload className={cn("h-4 w-4", isUploadingImage && "animate-pulse")} />
            <span className="text-sm">
              {isUploadingImage ? "Uploading…" : "Upload Evidence"}
            </span>
          </Button>
          {canManageTask && (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="shrink-0 shadow-e1 text-foreground gap-1.5" aria-label="More">
                  <MoreVertical className="h-4 w-4" />
                  <span className="hidden sm:inline text-sm">More</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[120]">
                <DropdownMenuItem
                  onSelect={() => {
                    setTaskEditOpen(true);
                    requestAnimationFrame(() => {
                      panelScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                    });
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                {taskEditOpen ? (
                  <DropdownMenuItem
                    onSelect={() => {
                      setTaskEditOpen(false);
                      setOpenChipSlot(null);
                    }}
                  >
                    Done editing
                  </DropdownMenuItem>
                ) : null}
                {hasEdits ? (
                  <DropdownMenuItem
                    onSelect={() => handleUpdateTask()}
                    disabled={isUpdating}
                  >
                    Save changes
                  </DropdownMenuItem>
                ) : null}
                <TaskDetailChecklistActions
                  taskId={taskId}
                  canEdit={canManageTask}
                  canManageTemplates={canManageTemplates}
                  hasItems
                  menuOnly
                />
                <DropdownMenuItem
                  onClick={async () => {
                    if (isUpdating || !task) return;
                    setIsUpdating(true);
                    try {
                      const { error } = await supabase
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
        {canManageTask && status !== "completed" ? (
          <p className="text-caption leading-snug text-muted-foreground px-0.5">
            {GEO_EVIDENCE_CONSENT_LINE}
          </p>
        ) : null}
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
              onClick={() => {
                if (isUpdating) return;
                setIsUpdating(true);
                const orgId = (task as any)?.org_id;
                const propId = (task as any)?.property_id ?? null;
                deleteTaskMutation.mutate(
                  { taskId, orgId, propertyId: propId },
                  {
                    onSuccess: () => {
                      toast({ title: "Task deleted" });
                      onClose();
                    },
                    onError: (err) => {
                      toast({ title: "Couldn't delete task", description: (err as Error).message, variant: "destructive" });
                    },
                    onSettled: () => {
                      setIsUpdating(false);
                      setShowDeleteDialog(false);
                    },
                  }
                );
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  // Single-scroll detail body + sticky task actions
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
      <DialogContent className={cn(dialogContentWideClass, "max-h-[90vh] p-0 overflow-hidden")}>
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
        className="fixed inset-0 z-[9999] flex flex-col bg-black/90"
        role="dialog"
        aria-modal="true"
        aria-label="Image preview"
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
            <p className="truncate text-sm font-medium text-white">Evidence</p>
            <p className="truncate text-xs text-white/55">
              {selectedImageIndex + 1} / {imageAttachments.length} · Esc to close
            </p>
          </div>
          {imageAttachments[selectedImageIndex]?.id ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                const img = imageAttachments[selectedImageIndex];
                if (!img?.id) return;
                setLightboxOpen(false);
                setEditingImageId(img.id);
                setShowAnnotationEditor(true);
              }}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Annotate
            </Button>
          ) : null}
        </header>

        <div
          className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3 sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLightboxOpen(false);
          }}
        >
          {imageAttachments.length > 1 && (
            <>
              <button
                type="button"
                className="absolute left-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60 sm:left-4"
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
                className="absolute right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60 sm:right-4"
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
            className="max-h-full max-w-full rounded-md object-contain shadow-lg"
            onClick={(e) => e.stopPropagation()}
            onError={(e) => {
              const img = imageAttachments[selectedImageIndex];
              if (img.optimized_url && (e.target as HTMLImageElement).src !== img.optimized_url) {
                (e.target as HTMLImageElement).src = img.optimized_url;
              }
            }}
          />
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
      <div className="fixed inset-0 z-[10000] flex flex-col bg-black/90 pointer-events-auto">
        <header className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <p className="text-sm text-white/80">Loading annotations…</p>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </div>
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
      onSave={async (anns) => {
        await saveAnnotations(anns);
      }}
      onCancel={onClose}
    />
  );
}
