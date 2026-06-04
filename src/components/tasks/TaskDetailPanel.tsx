import { useState, useEffect, useRef, useMemo, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Copy, Archive, Trash2, MoreVertical, CheckSquare, Clock, Upload, Shield, AlertTriangle, CircleDot, X, ChevronLeft, ChevronRight, ChevronDown, FileText, MessageSquare } from "lucide-react";
import { useGeoCaptureOnAction } from "@/hooks/useGeoCaptureOnAction";
import { useAssetsQuery } from "@/hooks/useAssetsQuery";
import { useComplianceQuery } from "@/hooks/useComplianceQuery";
import { TaskMessaging } from "./TaskMessaging";
import { GraphInsightPanel } from "@/components/graph/GraphInsightPanel";
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
import { useDataContext } from "@/contexts/DataContext";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useOrgMembers } from "@/hooks/useOrgMembers";
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
import { format, isValid, parseISO } from "date-fns";
import type { RepeatRule } from "@/types/database";
import type { SuggestedChip } from "@/types/chip-suggestions";
import type { Annotation } from "@/types/image-annotations";

import { Skeleton } from "@/components/ui/skeleton";
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
import { TaskDetailChecklistTab } from "@/components/tasks/detail/TaskDetailChecklistTab";
import {
  DEFAULT_TASK_DETAIL_CONTEXT,
  type TaskDetailContextId,
} from "@/components/tasks/detail/taskDetailContexts";

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
 * - V2.1 contexts: Overview | Checklist | Evidence | Activity
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
  const queryClient = useQueryClient();
  const deleteTaskMutation = useDeleteTaskMutation();
  const updateTaskMutation = useUpdateTaskMutation();
  const { members } = useOrgMembers();
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<string>("open");
  const [priority, setPriority] = useState<string>("normal");
  const [activeContext, setActiveContext] = useState<TaskDetailContextId>(DEFAULT_TASK_DETAIL_CONTEXT);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [showAnnotationEditor, setShowAnnotationEditor] = useState(false);
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [taskEditOpen, setTaskEditOpen] = useState(false);
  const [openChipSlot, setOpenChipSlot] = useState<IntakeChipSlotId | null>(null);
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

  // Reset edit UI when switching tasks
  useEffect(() => {
    setTaskEditOpen(false);
    setOpenChipSlot(null);
  }, [taskId]);

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
          open: "OPEN",
          in_progress: "IN PROGRESS",
          waiting_review: "WAITING REVIEW",
          completed: "DONE",
          archived: "ARCHIVED",
        } as Record<string, string>
      )[status] || status.toUpperCase()
    );
  }, [status]);

  const statusChipTextClass = useMemo(() => {
    if (status === "open") return "text-emerald-600";
    if (status === "completed" || status === "archived") return "text-muted-foreground";
    if (status === "waiting_review") return "text-amber-700";
    return "text-teal-600";
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

  const metaLine = useMemo(() => {
    const parts: string[] = [];
    if (dueDate) {
      const d = dueDate.includes("T") ? parseISO(dueDate) : parseISO(`${dueDate}T12:00:00`);
      if (isValid(d)) parts.push(format(d, "d MMM").toUpperCase());
    }
    if (selectedUserId) {
      const m = members.find((x) => x.user_id === selectedUserId);
      const name = m?.display_name || m?.nickname || m?.email || "";
      const first = name.trim().split(/\s+/)[0];
      if (first) parts.push(first.toUpperCase());
    } else if (selectedTeamIds.length > 0) {
      const team = taskTeams.find((t) => selectedTeamIds.includes(t.id));
      if (team?.name) parts.push(team.name.toUpperCase());
    }
    const propName =
      (task as any)?.property?.nickname ||
      (task as any)?.property_name ||
      "";
    const spacesRaw = (task as any)?.spaces;
    const spacesArr = Array.isArray(spacesRaw) ? spacesRaw : [];
    const spaceNames = spacesArr
      .filter((s: { id?: string }) => selectedSpaceIds.length === 0 || (s.id && selectedSpaceIds.includes(s.id)))
      .map((s: { name?: string }) => s.name)
      .filter(Boolean) as string[];
    if (propName) {
      parts.push(
        spaceNames.length > 0
          ? `${propName.toUpperCase()}: ${spaceNames.map((n) => n.toUpperCase()).join(", ")}`
          : propName.toUpperCase()
      );
    } else if (spaceNames.length > 0) {
      parts.push(spaceNames.map((n) => n.toUpperCase()).join(", "));
    }
    return parts.join(" • ");
  }, [dueDate, members, selectedUserId, selectedTeamIds, task, taskTeams, selectedSpaceIds]);

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
    const spacesRaw = (task as any)?.spaces;
    const spacesArr = Array.isArray(spacesRaw) ? spacesRaw : [];
    spacesArr
      .filter((s: { id?: string }) => s.id && selectedSpaceIds.includes(s.id))
      .forEach((space: { id: string; name?: string }) => {
        chips.push({
          id: `where-space-${space.id}`,
          slot: "where",
          label: (space.name || "Space").toUpperCase(),
          epistemic: "fact",
          removable: true,
          onPress: () => openSlot("where"),
          onRemove: () => handleSpacesChange(selectedSpaceIds.filter((id) => id !== space.id)),
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

    const categories = Array.isArray((task as any)?.categories) ? (task as any).categories : [];
    categories
      .filter((c: { id: string }) => selectedThemeIds.includes(c.id))
      .forEach((cat: { id: string; name?: string }) => {
        chips.push({
          id: `category-${cat.id}`,
          slot: "category",
          label: (cat.name || "Tag").toUpperCase(),
          epistemic: "fact",
          removable: true,
          onPress: () => openSlot("category"),
          onRemove: () => handleThemesChange(selectedThemeIds.filter((id) => id !== cat.id)),
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
                onActivate={() => setOpenChipSlot("compliance")}
                factChips={[]}
              >
                <div className="flex items-center gap-2 flex-nowrap overflow-x-auto min-w-0">
                  <label className="text-[11px] font-mono uppercase text-muted-foreground">Compliance</label>
                  <Switch id="task-detail-compliance" checked={isCompliance} onCheckedChange={setIsCompliance} />
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
        <DialogContent
          className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0"
          aria-describedby="task-detail-panel-desc"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{title ?? "Task details"}</DialogTitle>
            <DialogDescription id="task-detail-panel-desc">
              Task detail: Overview, Checklist, Evidence, and Activity.
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

  const evidenceMediaSection = (
    <div className="space-y-4">
      <div className="space-y-3">
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
      {documentAttachments.length > 0 ? (
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
      ) : (
        <p className="text-sm text-muted-foreground">
          No files yet. Upload photos above or attach documents from the field app.
        </p>
      )}
    </div>
  );

  const overviewSection = (
    <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">
              Status:
            </span>
            <span
              className={cn(
                "inline-flex h-[28px] items-center rounded-[8px] bg-white px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-wide shadow-none",
                statusChipTextClass
              )}
            >
              {statusChipLabel}
            </span>
            {priority === "urgent" && (
              <span className="inline-flex h-[28px] items-center rounded-[8px] bg-white px-2.5 font-mono text-[11px] uppercase tracking-wide text-destructive shadow-none">
                URGENT
              </span>
            )}
          </div>

          <div className="flex items-start justify-between gap-3 min-w-0">
            {taskEditOpen ? (
              <div className="min-w-0 flex-1">
                <IntakeChipRow
                  layout="interleaved"
                  chips={taskDetailChips}
                  onOpenSlot={setOpenChipSlot}
                  openSlot={openChipSlot}
                  onCloseSlot={() => setOpenChipSlot(null)}
                  renderSlotContent={renderTaskDetailSlotContent}
                />
              </div>
            ) : metaLine ? (
              <p className="min-w-0 flex-1 font-mono text-[11px] uppercase tracking-wide text-foreground leading-snug">
                {metaLine}
              </p>
            ) : (
              <p className="min-w-0 flex-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground leading-snug">
                No date, assignee, or location
              </p>
            )}
            <button
              type="button"
              className="shrink-0 font-sans text-xs font-normal text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => {
                setTaskEditOpen((open) => {
                  const next = !open;
                  if (!next) setOpenChipSlot(null);
                  return next;
                });
              }}
            >
              {taskEditOpen ? "Done" : "Edit"}
            </button>
          </div>

          <p className="text-[18px] text-foreground leading-relaxed">
            {(task as any)?.description || "No description provided"}
          </p>
    </div>
  );

  const activitySection = (
    <div className="space-y-4">
      <div className="flex max-h-[min(360px,50dvh)] min-h-[200px] flex-col overflow-hidden rounded-[10px] bg-muted/25 shadow-sm">
        <TaskMessaging taskId={taskId} />
      </div>
      <GraphInsightPanel
        start={{ type: "task", id: taskId }}
        depth={2}
        variant="minimal"
        className="mb-1"
      />
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
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Timeline
        </h3>
        {timelineLoading ? (
          <div className="space-y-2 py-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : timelineError ? (
          <p className="text-muted-foreground text-sm">
            Couldn’t load activity.{" "}
            <button
              type="button"
              className="text-primary underline-offset-2 hover:underline"
              onClick={() => void refetchTimeline()}
            >
              Retry
            </button>
          </p>
        ) : (
          <TaskTimeline events={timelineEvents} />
        )}
      </div>
    </div>
  );

  const panelContent = (
    <>
      <TaskDetailContent
        title={taskTitle}
        activeContext={activeContext}
        onContextChange={setActiveContext}
        scrollRef={panelScrollRef}
        overview={overviewSection}
        checklist={<TaskDetailChecklistTab taskId={taskId} canEdit={canManageTask} />}
        evidence={evidenceMediaSection}
        activity={activitySection}
      />

      {/* CTA panel — primary: Mark Complete; overflow menu */}
      <div className="flex flex-col gap-1.5 pt-1 pb-4 px-4 border-0 flex-shrink-0 bg-transparent text-foreground sticky bottom-0">
        <div className="flex gap-2 items-center min-w-0 w-full">
          <Button
            variant="outline"
            className="shrink-0 shadow-e1 text-foreground"
            onClick={() => setActiveContext("activity")}
          >
            <MessageSquare className="h-4 w-4 mr-1.5 shrink-0" />
            Activity
          </Button>
          {hasEdits && canManageTask && (
            <Button variant="outline" className="shrink-0 shadow-e1 text-foreground" onClick={handleUpdateTask} disabled={isUpdating}>
              {isUpdating ? "…" : "Update"}
            </Button>
          )}
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
                  await refreshTask();
                  queryClient.invalidateQueries({ queryKey: ["tasks"] });
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
                    scanNearby: true,
                  });
                } catch (err: any) {
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
          {canManageTask && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="shrink-0 shadow-e1 text-foreground gap-1.5">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
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
