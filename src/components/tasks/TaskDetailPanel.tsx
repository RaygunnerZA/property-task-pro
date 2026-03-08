import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Camera, Copy, Archive, Trash2, MoreVertical, CheckSquare, MessageSquare, FileText, Clock, Upload, Shield, AlertTriangle, CircleDot, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useTaskDetails } from "@/hooks/use-task-details";
import { useAssetsQuery } from "@/hooks/useAssetsQuery";
import { useComplianceQuery } from "@/hooks/useComplianceQuery";
import { TaskMessaging } from "./TaskMessaging";
import { FileUploadZone } from "@/components/attachments/FileUploadZone";
import { GraphInsightPanel } from "@/components/graph/GraphInsightPanel";
import { ImageAnnotationEditor, type DetectionOverlay } from "./ImageAnnotationEditor";
import { ImageAiActions } from "./ai/ImageAiActions";
import { useImageAnnotations } from "@/hooks/useImageAnnotations";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useDataContext } from "@/contexts/DataContext";
import { useFileUpload } from "@/hooks/use-file-upload";
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
import type { RepeatRule } from "@/types/database";
import type { SuggestedChip } from "@/types/chip-suggestions";

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
 * - Tabs: Summary, Messaging, Files, Logs
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
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<string>("open");
  const [priority, setPriority] = useState<string>("normal");
  const [activeTab, setActiveTab] = useState("summary");
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const thumbnailScrollRef = useRef<HTMLDivElement>(null);
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
      if (task.images && task.images.length > 0) {
        setSelectedImageIndex(0);
      } else {
        setSelectedImageIndex(null);
      }
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

  const { userId } = useDataContext();
  const taskImages = (task as any)?.images ?? [];
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
        <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden rounded-[12px] shadow-[2px_4px_6px_0px_rgba(0,0,0,0.15),inset_1px_1px_2px_0px_rgba(255,255,255,1),inset_-1px_-1px_2px_0px_rgba(0,0,0,0.25)] border-0 bg-background">
          {content}
        </div>
      );
    }
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0">
          {title && (
            <DialogHeader className="sr-only">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{title}</DialogDescription>
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
      {/* Image section - thumbnails at top + Camera/Upload buttons (Create Task style) */}
      <div className="p-4 pb-0 space-y-3">
        {taskImages.length > 0 ? (
          <div className="space-y-2">
            {/* Full-width selected image preview */}
            {selectedImageIndex !== null && taskImages[selectedImageIndex] && (
              <button
                type="button"
                className="w-full rounded-[10px] overflow-hidden bg-muted shadow-e1 cursor-pointer hover:shadow-e2 transition-shadow"
                onClick={() => {
                  const selectedImage = taskImages[selectedImageIndex];
                  if (selectedImage?.id) {
                    setEditingImageId(selectedImage.id);
                    setShowAnnotationEditor(true);
                    return;
                  }
                  setLightboxOpen(true);
                }}
              >
                <img
                  src={taskImages[selectedImageIndex].optimized_url || taskImages[selectedImageIndex].file_url || taskImages[selectedImageIndex].thumbnail_url}
                  alt={taskImages[selectedImageIndex].file_name || "Task image"}
                  className="w-full max-h-[300px] object-contain bg-muted/40"
                  onError={(e) => {
                    const img = taskImages[selectedImageIndex];
                    if (img.file_url && (e.target as HTMLImageElement).src !== img.file_url) {
                      (e.target as HTMLImageElement).src = img.file_url;
                    }
                  }}
                />
              </button>
            )}
            {/* Thumbnail strip + action buttons */}
            <div className="flex gap-3 items-end">
              <div className="flex gap-2 overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden flex-1 min-w-0" ref={thumbnailScrollRef}>
                {taskImages.map((image: any, index: number) => (
                  <button
                    key={image.id}
                    type="button"
                    className={cn(
                      "aspect-square w-14 h-14 flex-shrink-0 bg-muted rounded-[8px] overflow-hidden cursor-pointer hover:opacity-80 transition-opacity relative border-2 shadow-e1",
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
              <div className="flex gap-2 items-end shrink-0">
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
                  title="Take photo"
                >
                  <Camera className="h-5 w-5 text-muted-foreground" />
                </button>
                <button
                  type="button"
                  onClick={() => taskImageInputRef.current?.click()}
                  disabled={isUploadingImage}
                  className="h-[35px] w-[35px] rounded-[8px] flex items-center justify-center bg-muted/50 shadow-e1 hover:shadow-e2 transition-all disabled:opacity-50"
                  title="Upload image"
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
              title="Take photo"
            >
              <Camera className="h-5 w-5 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={() => taskImageInputRef.current?.click()}
              disabled={isUploadingImage}
              className="h-[35px] w-[35px] rounded-[8px] flex items-center justify-center bg-muted/50 shadow-e1 hover:shadow-e2 transition-all disabled:opacity-50"
              title="Upload image"
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
          capture="environment"
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

      {/* Content - p-4 matching Create Task */}
      <div className="p-4 space-y-4 flex-1 overflow-y-auto min-h-0">
        {/* Description 18pt - replaces title */}
        <p className="text-[18px] text-foreground leading-relaxed">
          {(task as any)?.description || "No description provided"}
        </p>

        {/* Tabs - below description: Summary | Messaging | Activity */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/20 px-0 rounded-[15px]">
            <TabsList className="w-full grid grid-cols-3 h-12 bg-transparent px-[7px] py-1 gap-1 rounded-[15px] mx-0 shadow-[inset_2px_6.6px_9.5px_0px_rgba(0,0,0,0.23),inset_0px_-5.7px_9.4px_0px_rgba(255,255,255,0.62)]">
              <TabsTrigger
                value="summary"
                className={cn(
                  "rounded-[8px] data-[state=active]:bg-card",
                  "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]"
                )}
              >
                <CheckSquare className="h-4 w-4 mr-2" />
                Summary
              </TabsTrigger>
              <TabsTrigger
                value="messaging"
                className={cn(
                  "rounded-[8px] data-[state=active]:bg-card",
                  "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]"
                )}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Messaging
              </TabsTrigger>
              <TabsTrigger
                value="activity"
                className={cn(
                  "rounded-[8px] data-[state=active]:bg-card",
                  "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]"
                )}
              >
                <FileText className="h-4 w-4 mr-2" />
                Activity
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <TabsContent value="summary" className="mt-0 flex-1 overflow-y-auto">
              <div className="space-y-0 flex flex-col mt-[15px]">
                <GraphInsightPanel
                  start={{ type: "task", id: taskId }}
                  depth={2}
                  variant="minimal"
                  className="mb-3"
                />
                <WhoSection
                  isActive={activeSection === "who"}
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
                  onAddAsContractor={() => { setInvitePrefill(null); setInviteModalOpen(true); }}
                />

                <WhereSection
                  propertyId={localPropertyId}
                  selectedPropertyIds={selectedPropertyIds}
                  selectedSpaceIds={selectedSpaceIds}
                  onPropertyChange={handlePropertyChangeSection}
                  onSpacesChange={handleSpacesChange}
                  showFactsByDefault
                />

                <WhenSection
                  isActive={activeSection === "when"}
                  onActivate={() => setActiveSection("when")}
                  onDeactivate={() => setActiveSection(null)}
                  dueDate={dueDate}
                  repeatRule={repeatRule}
                  onDueDateChange={handleDueDateChange}
                  onRepeatRuleChange={setRepeatRule}
                  milestones={milestones}
                  onMilestonesChange={setMilestones}
                />

                <AssetSection
                  isActive={activeSection === "what"}
                  onActivate={() => setActiveSection("what")}
                  propertyId={localPropertyId || undefined}
                  spaceId={selectedSpaceIds[0]}
                  selectedAssetIds={selectedAssetIds}
                  onAssetsChange={handleAssetsChange}
                />

                <CreateTaskRow
                  sectionId="priority"
                  icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
                  instruction="Add Priority"
                  valueLabel="+Priority"
                  isActive={activeSection === "priority"}
                  onActivate={() => setActiveSection("priority")}
                  factChips={priorityFactChips}
                  hoverChips={[
                    { id: "low", label: "LOW", onPress: () => setPriority("low") },
                    { id: "normal", label: "NORMAL", onPress: () => setPriority("normal") },
                    { id: "high", label: "HIGH", onPress: () => setPriority("high") },
                    { id: "urgent", label: "URGENT", onPress: () => setPriority("urgent") },
                  ]}
                />

                <CreateTaskRow
                  sectionId="status"
                  icon={<CircleDot className="h-4 w-4 text-muted-foreground" />}
                  instruction="Set Status"
                  valueLabel="+Status"
                  isActive={activeSection === "status"}
                  onActivate={() => setActiveSection("status")}
                  factChips={statusFactChips}
                  hoverChips={[
                    { id: "open", label: "OPEN", onPress: () => setStatus("open") },
                    { id: "in_progress", label: "IN PROGRESS", onPress: () => setStatus("in_progress") },
                    { id: "completed", label: "DONE", onPress: () => setStatus("completed") },
                    { id: "archived", label: "ARCHIVED", onPress: () => setStatus("archived") },
                  ]}
                />

                <CategorySection
                  isActive={activeSection === "category"}
                  onActivate={() => setActiveSection("category")}
                  selectedThemeIds={selectedThemeIds}
                  onThemesChange={handleThemesChange}
                />

                <CreateTaskRow
                  sectionId="compliance"
                  icon={<Shield className="h-4 w-4 text-muted-foreground" />}
                  instruction="Add Compliance Rule"
                  valueLabel="+Rule"
                  isActive={activeSection === "compliance"}
                  onActivate={() => setActiveSection("compliance")}
                  factChips={[]}
                >
                  {activeSection === "compliance" && (
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
              </div>
            </TabsContent>

            <TabsContent value="messaging" className="mt-0 flex-1 flex flex-col min-h-0">
              <TaskMessaging taskId={taskId} />
            </TabsContent>

            <TabsContent value="activity" className="mt-0 flex-1 overflow-y-auto">
              <div className="space-y-4">
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
                {task.images && task.images.length > 0 && (() => {
                  const img = task.images[selectedImageIndex ?? 0] as any;
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
                {task.images && task.images.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3">All Images ({task.images.length})</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {task.images.map((image: any) => (
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
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* Logs section - combined with Files in Activity */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Logs
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Audit logs and activity history will appear here
                  </p>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
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
                <DropdownMenuItem>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
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

    {/* Image lightbox modal */}
    {lightboxOpen && taskImages.length > 0 && selectedImageIndex !== null && createPortal(
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

        {taskImages.length > 1 && (
          <>
            <button
              type="button"
              className="absolute left-4 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImageIndex((selectedImageIndex - 1 + taskImages.length) % taskImages.length);
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
                setSelectedImageIndex((selectedImageIndex + 1) % taskImages.length);
              }}
              aria-label="Next image"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}

        <img
          src={taskImages[selectedImageIndex].file_url || taskImages[selectedImageIndex].optimized_url}
          alt={taskImages[selectedImageIndex].file_name || "Task image"}
          className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          onError={(e) => {
            const img = taskImages[selectedImageIndex];
            if (img.optimized_url && (e.target as HTMLImageElement).src !== img.optimized_url) {
              (e.target as HTMLImageElement).src = img.optimized_url;
            }
          }}
        />

        <div className="absolute bottom-4 text-white/70 text-sm">
          {selectedImageIndex + 1} / {taskImages.length}
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
  const { annotations, loading, saveAnnotations } = useImageAnnotations(taskId, imageId);

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
