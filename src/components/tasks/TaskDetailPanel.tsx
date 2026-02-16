import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Camera, Copy, Archive, Trash2, MoreVertical, CheckSquare, MessageSquare, FileText, Clock, User, Users, MapPin, Calendar, Save, SquarePen, Upload, Box, Tag, Shield, AlertTriangle } from "lucide-react";
import { useTaskDetails } from "@/hooks/use-task-details";
import { useAssetsQuery } from "@/hooks/useAssetsQuery";
import { useComplianceQuery } from "@/hooks/useComplianceQuery";
import { useCompliancePortfolioQuery } from "@/hooks/useCompliancePortfolioQuery";
import { RelatedComplianceSection } from "@/components/compliance/RelatedComplianceSection";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useTeams } from "@/hooks/useTeams";
import { TaskMessaging } from "./TaskMessaging";
import { FileUploadZone } from "@/components/attachments/FileUploadZone";
import { ImageAnnotationEditor } from "./ImageAnnotationEditor";
import type { DetectionOverlay } from "./ImageAnnotationEditor";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FactChipView } from "@/components/chips/FactChipView";
import { InteractiveChipView } from "@/components/chips/InteractiveChipView";
import { InstructionField } from "./InstructionField";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { GraphInsightPanel } from "@/components/graph/GraphInsightPanel";
import { useDataContext } from "@/contexts/DataContext";
import { useFileUpload } from "@/hooks/use-file-upload";

function getImageExpiryStatus(img: { expiry_date?: string | null } | null): "green" | "amber" | "red" | null {
  const exp = img?.expiry_date;
  if (!exp) return null;
  const expDate = new Date(exp);
  const now = new Date();
  const days = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return days < 0 ? "red" : days < 60 ? "amber" : "green";
}
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
  const { members, loading: membersLoading } = useOrgMembers();
  const { teams, loading: teamsLoading } = useTeams();
  const propertyId = (task as any)?.property_id;
  const { data: assets = [] } = useAssetsQuery(propertyId);
  const { data: complianceItems = [] } = useComplianceQuery();
  const { data: portfolioCompliance = [], isLoading: portfolioLoading } = useCompliancePortfolioQuery();
  const { data: autoTaskRecord } = useQuery({
    queryKey: ["compliance_auto_tasks", taskId],
    queryFn: async () => {
      const { data } = await supabase
        .from("compliance_auto_tasks")
        .select("id, compliance_document_id, auto_task_type")
        .eq("task_id", taskId)
        .maybeSingle();
      return data;
    },
    enabled: !!taskId,
  });

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

  const propertyComplianceItems = useMemo(() => {
    if (!propertyId) return [];
    return portfolioCompliance.filter((p: any) => p.property_id === propertyId);
  }, [portfolioCompliance, propertyId]);

  const imageHazards = useMemo(() => {
    const hazards = new Set<string>();
    for (const img of (task as any)?.images ?? []) {
      const meta = (img?.metadata || {}) as Record<string, unknown>;
      const h = meta.hazards;
      if (Array.isArray(h)) h.forEach((x: string) => hazards.add(x));
      const objs = meta.detected_objects as Array<{ type?: string; label?: string }> | undefined;
      if (Array.isArray(objs)) {
        for (const o of objs) {
          const t = (o.type || o.label || "").toLowerCase();
          if (t.includes("fire")) hazards.add("fire");
          if (t.includes("electrical") || t.includes("electric")) hazards.add("electrical");
          if (t.includes("slip") || t.includes("trip")) hazards.add("slip");
          if (t.includes("water") || t.includes("leak")) hazards.add("water");
          if (t.includes("structural")) hazards.add("structural");
          if (t.includes("obstruction")) hazards.add("obstruction");
          if (t.includes("hygiene")) hazards.add("hygiene");
          if (t.includes("ventilation")) hazards.add("ventilation");
        }
      }
    }
    return Array.from(hazards);
  }, [task]);
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
  const [detectionOverlays, setDetectionOverlays] = useState<DetectionOverlay[]>([]);
  const [showPeoplePopover, setShowPeoplePopover] = useState(false);
  const [showPriorityPopover, setShowPriorityPopover] = useState(false);
  const [showStatusPopover, setShowStatusPopover] = useState(false);
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [sectionInstructions, setSectionInstructions] = useState<Record<string, string>>({
    who: "Add Person or Team",
    where: "Add Property or Space",
    when: "Add Due Date",
    what: "Add Asset",
    priority: "Add Priority",
    category: "Add Tag",
    compliance: "Add Compliance Rule",
  });

  // Update local state when task data loads
  useEffect(() => {
    if (task) {
      setTitle((task as any).title || "");
      setStatus((task as any).status || "open");
      setPriority((task as any).priority || "normal");
      // Set assigned user from task (if assigned_user_id exists)
      setSelectedUserId((task as any).assigned_user_id || undefined);
      // Set selected teams from task.teams (handle both string and array)
      const teamsArray = Array.isArray(task.teams) ? task.teams : (typeof task.teams === 'string' ? JSON.parse(task.teams) : []);
      setSelectedTeamIds(teamsArray.map((t: any) => t.id) || []);
      // Reset selected image index when task changes
      if (task.images && task.images.length > 0) {
        setSelectedImageIndex(0);
      } else {
        setSelectedImageIndex(null);
      }
    }
  }, [task]);

  const statusOptions = [
    { value: "open", label: "Open" },
    { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Done" },
    { value: "archived", label: "Archived" },
  ];

  const priorityOptions = [
    { value: "low", label: "Low" },
    { value: "normal", label: "Normal" },
    { value: "high", label: "High" },
    { value: "urgent", label: "Urgent" },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500/10 text-green-700 border-green-500/20";
      case "in_progress":
        return "bg-blue-500/10 text-blue-700 border-blue-500/20";
      case "archived":
        return "bg-gray-500/10 text-gray-700 border-gray-500/20";
      default:
        return "bg-white text-primary border-primary/20";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-white text-red-700 border-red-500/20";
      case "high":
        return "bg-orange-500/10 text-orange-700 border-orange-500/20";
      case "low":
        return "bg-gray-500/10 text-gray-700 border-gray-500/20";
      default:
        return "bg-primary/10 text-primary border-primary/20";
    }
  };

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

  const toggleTeam = (teamId: string) => {
    if (selectedTeamIds.includes(teamId)) {
      handleTeamsChange(selectedTeamIds.filter(id => id !== teamId));
    } else {
      handleTeamsChange([...selectedTeamIds, teamId]);
    }
  };

  // Update task fields (title, status, priority)
  const handleUpdateTask = async () => {
    if (isUpdating) return;
    setIsUpdating(true);

    try {
      const updates: any = {};
      
      // Only update fields that have changed
      if (title !== ((task as any)?.title || "")) {
        updates.title = title;
      }
      if (status !== ((task as any)?.status || "open")) {
        updates.status = status;
      }
      if (priority !== ((task as any)?.priority || "normal")) {
        updates.priority = priority;
      }

      // Only make API call if there are changes
      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from("tasks")
          .update(updates)
          .eq("id", taskId);

        if (updateError) throw updateError;

        await refreshTask();
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        
        toast({
          title: "Task updated",
          description: "Changes saved successfully",
        });
      }
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

  const selectedUser = members.find(m => m.user_id === selectedUserId);
  const isUnconfirmedUser = selectedUserId && selectedUserId.startsWith("pending-");
  const { userId } = useDataContext();
  const taskImages = (task as any)?.images ?? [];
  const createdBy = (task as any)?.created_by ?? null;
  const assignedUserId = (task as any)?.assigned_user_id ?? null;
  const isAssigner = !!userId && createdBy === userId;
  const isAssignee = !!userId && assignedUserId === userId;
  // Show CTA to any authenticated user who can view the task (fallback when created_by not in view)
  const canManageTask = !!userId && (isAssigner || isAssignee || !createdBy);

  const hasEdits = useMemo(() => {
    const initialStatus = (task as any)?.status || "open";
    const initialPriority = (task as any)?.priority || "normal";
    const initialUserId = (task as any)?.assigned_user_id || undefined;
    const initialTeamIds = Array.isArray((task as any)?.teams)
      ? ((task as any).teams as any[]).map((t: any) => t.id)
      : [];
    return (
      status !== initialStatus ||
      priority !== initialPriority ||
      selectedUserId !== initialUserId ||
      JSON.stringify([...selectedTeamIds].sort()) !== JSON.stringify([...initialTeamIds].sort())
    );
  }, [task, status, priority, selectedUserId, selectedTeamIds]);

  const { uploadFile, uploading: isUploadingImage } = useFileUpload({
    taskId,
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

  const paperBg = "bg-background bg-paper-texture";
  const panelWrapper = (content: ReactNode, title?: string) => {
    if (variant === "column") {
      return (
        <div className={cn("flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden rounded-[12px] shadow-e1 border border-border/20", paperBg)}>
          {content}
        </div>
      );
    }
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className={cn("max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0", paperBg)}>
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
                    className="w-full h-full object-cover"
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
        ) : (
          <div className="flex gap-2 justify-end items-end">
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
          accept="image/*"
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
            <TabsList className="w-full grid grid-cols-3 h-12 bg-transparent px-[7px] py-1 gap-1 rounded-[15px] mx-0">
              <TabsTrigger
                value="summary"
                className={cn(
                  "rounded-lg data-[state=active]:bg-card",
                  "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]"
                )}
              >
                <CheckSquare className="h-4 w-4 mr-2" />
                Summary
              </TabsTrigger>
              <TabsTrigger
                value="messaging"
                className={cn(
                  "rounded-lg data-[state=active]:bg-card",
                  "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]"
                )}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Messaging
              </TabsTrigger>
              <TabsTrigger
                value="activity"
                className={cn(
                  "rounded-lg data-[state=active]:bg-card",
                  "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]"
                )}
              >
                <FileText className="h-4 w-4 mr-2" />
                Activity
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden flex flex-col py-4 px-1">
            <TabsContent value="summary" className="mt-0 flex-1 overflow-y-auto">
              <div className="space-y-3">
                {/* People + Teams - same row, one icon, fact chips left, Add Person or Team opens popover */}
                <div
                  className="flex items-center gap-2 min-h-[24px]"
                  onMouseEnter={() => setHoveredSection("who")}
                  onMouseLeave={() => setHoveredSection(null)}
                >
                  <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex flex-wrap gap-1.5 items-center min-w-0">
                    {selectedUser ? (
                      <FactChipView
                        label={selectedUser.display_name.toUpperCase()}
                        onRemove={() => handleUserChange(undefined)}
                        className="font-mono text-[11px] rounded-[8px] h-[24px]"
                      />
                    ) : isUnconfirmedUser ? (
                      <FactChipView
                        label={(selectedUserId?.replace("pending-", "") || "Unconfirmed").toUpperCase()}
                        pending
                        onRemove={() => handleUserChange(undefined)}
                        className="font-mono text-[11px] rounded-[8px] h-[24px]"
                      />
                    ) : null}
                    {selectedTeamIds.map((tid) => {
                      const team = teams.find((t) => t.id === tid);
                      return team ? (
                        <FactChipView
                          key={tid}
                          label={team.name.toUpperCase()}
                          onRemove={() => toggleTeam(tid)}
                          className="font-mono text-[11px] rounded-[8px] h-[24px]"
                        />
                      ) : null;
                    })}
                    {(hoveredSection === "who" || showPeoplePopover) && (
                    <Popover open={showPeoplePopover} onOpenChange={setShowPeoplePopover}>
                      <PopoverTrigger asChild>
                        <div>
                          <InstructionField
                            value={sectionInstructions.who}
                            onChange={(v) => setSectionInstructions((s) => ({ ...s, who: v }))}
                            onPress={() => setShowPeoplePopover(true)}
                          />
                        </div>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-64 p-3 space-y-3">
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Person</label>
                          <Select
                            value={selectedUserId || ""}
                            onValueChange={(v) => {
                              handleUserChange(v || undefined);
                              setShowPeoplePopover(false);
                            }}
                            disabled={isUpdating || membersLoading}
                          >
                            <SelectTrigger className="h-[24px] w-full shadow-engraved text-[11px] font-mono rounded-[8px]">
                              <SelectValue placeholder="Assign..." />
                            </SelectTrigger>
                            <SelectContent>
                              {members.map((m) => (
                                <SelectItem key={m.user_id} value={m.user_id}>
                                  {m.display_name}
                                </SelectItem>
                              ))}
                              {members.length === 0 && <SelectItem value="__none__" disabled>No members</SelectItem>}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Teams</label>
                          <Select
                            value=""
                            onValueChange={(v) => {
                              if (v && !selectedTeamIds.includes(v)) toggleTeam(v);
                              setShowPeoplePopover(false);
                            }}
                            disabled={isUpdating || teamsLoading}
                          >
                            <SelectTrigger className="h-[24px] w-full shadow-engraved text-[11px] font-mono rounded-[8px]">
                              <SelectValue placeholder="Add team..." />
                            </SelectTrigger>
                            <SelectContent>
                              {teams.filter((t) => !selectedTeamIds.includes(t.id)).map((t) => (
                                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                              ))}
                              {teams.length === 0 && <SelectItem value="__none__" disabled>No teams</SelectItem>}
                            </SelectContent>
                          </Select>
                        </div>
                      </PopoverContent>
                    </Popover>
                    )}
                  </div>
                </div>

                {/* Where - property + spaces */}
                <div
                  className="flex items-center gap-2 min-h-[24px]"
                  onMouseEnter={() => setHoveredSection("where")}
                  onMouseLeave={() => setHoveredSection(null)}
                >
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex flex-wrap gap-1.5 items-center min-w-0">
                    <FactChipView
                      label={(task?.property?.nickname || task?.property?.address || "—").toString().toUpperCase()}
                      className="font-mono text-[11px] rounded-[8px] h-[24px]"
                    />
                    {task?.spaces && (task.spaces as any[]).length > 0 && (
                      <span className="text-muted-foreground text-xs">·</span>
                    )}
                    {(task?.spaces as any[])?.length > 0 ? (
                      <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                        {(task.spaces as any[]).map((s: any) => s.name || s.label).join(", ")}
                      </span>
                    ) : null}
                    {(hoveredSection === "where" || editingSection === "where") && (
                      <InstructionField
                        value={sectionInstructions.where}
                        onChange={(v) => setSectionInstructions((s) => ({ ...s, where: v }))}
                        onEditStart={() => setEditingSection("where")}
                        onEditEnd={() => setEditingSection(null)}
                      />
                    )}
                  </div>
                </div>

                {/* When */}
                <div
                  className="flex items-center gap-2 min-h-[24px]"
                  onMouseEnter={() => setHoveredSection("when")}
                  onMouseLeave={() => setHoveredSection(null)}
                >
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex flex-wrap gap-1.5 items-center min-w-0">
                    <FactChipView
                      label={((task as any)?.due_date ? new Date((task as any).due_date).toLocaleDateString() : "—").toUpperCase()}
                      className="font-mono text-[11px] rounded-[8px] h-[24px]"
                    />
                    {(hoveredSection === "when" || editingSection === "when") && (
                      <InstructionField
                        value={sectionInstructions.when}
                        onChange={(v) => setSectionInstructions((s) => ({ ...s, when: v }))}
                        onEditStart={() => setEditingSection("when")}
                        onEditEnd={() => setEditingSection(null)}
                      />
                    )}
                  </div>
                </div>

                {/* What (Assets) */}
                <div
                  className="flex items-center gap-2 min-h-[24px]"
                  onMouseEnter={() => setHoveredSection("what")}
                  onMouseLeave={() => setHoveredSection(null)}
                >
                  <Box className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex flex-wrap gap-1.5 items-center min-w-0">
                    {taskAssets.length > 0 &&
                      taskAssets.map((a) => (
                        <FactChipView
                          key={a.id}
                          label={(a.name || "—").toUpperCase()}
                          className="font-mono text-[11px] rounded-[8px] h-[24px]"
                        />
                      ))}
                    {(hoveredSection === "what" || editingSection === "what") && (
                      <InstructionField
                        value={sectionInstructions.what}
                        onChange={(v) => setSectionInstructions((s) => ({ ...s, what: v }))}
                        onEditStart={() => setEditingSection("what")}
                        onEditEnd={() => setEditingSection(null)}
                      />
                    )}
                  </div>
                </div>

                {/* Priority + Status - unified chip style */}
                <div
                  className="flex items-center gap-2 min-h-[24px]"
                  onMouseEnter={() => setHoveredSection("priority")}
                  onMouseLeave={() => setHoveredSection(null)}
                >
                  <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <Popover open={showPriorityPopover} onOpenChange={setShowPriorityPopover}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2 py-1 h-[24px] rounded-[8px]",
                          "font-mono text-[11px] uppercase tracking-wide",
                          "bg-card text-foreground shadow-e2",
                          "transition-all duration-150 cursor-pointer",
                          "hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]",
                          getPriorityColor(priority)
                        )}
                      >
                        <span>{(priorityOptions.find((o) => o.value === priority)?.label || priority).toUpperCase()}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-40 p-1">
                      {priorityOptions.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => {
                            setPriority(o.value);
                            setShowPriorityPopover(false);
                          }}
                          className={cn(
                            "w-full text-left px-2 py-1.5 rounded-[5px] text-[11px] font-mono uppercase",
                            "hover:bg-muted/50 transition-colors",
                            priority === o.value && "bg-muted/50"
                          )}
                        >
                          {o.label}
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                  <Popover open={showStatusPopover} onOpenChange={setShowStatusPopover}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2 py-1 h-[24px] rounded-[8px]",
                          "font-mono text-[11px] uppercase tracking-wide",
                          "bg-card text-foreground shadow-e2",
                          "transition-all duration-150 cursor-pointer",
                          "hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]",
                          getStatusColor(status)
                        )}
                      >
                        <span>{(statusOptions.find((o) => o.value === status)?.label || status).toUpperCase()}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-40 p-1">
                      {statusOptions.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => {
                            setStatus(o.value);
                            setShowStatusPopover(false);
                          }}
                          className={cn(
                            "w-full text-left px-2 py-1.5 rounded-[5px] text-[11px] font-mono uppercase",
                            "hover:bg-muted/50 transition-colors",
                            status === o.value && "bg-muted/50"
                          )}
                        >
                          {o.label}
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                  {autoTaskRecord && <Badge variant="secondary" className="text-[10px] h-[24px] font-normal rounded-[8px]">Auto-generated</Badge>}
                    {(hoveredSection === "priority" || showPriorityPopover || showStatusPopover || editingSection === "priority") && (
                      <InstructionField
                        value={sectionInstructions.priority}
                        onChange={(v) => setSectionInstructions((s) => ({ ...s, priority: v }))}
                        onEditStart={() => setEditingSection("priority")}
                        onEditEnd={() => setEditingSection(null)}
                      />
                    )}
                  </div>
                </div>

                {/* Tags */}
                <div
                  className="flex items-center gap-2 min-h-[24px]"
                  onMouseEnter={() => setHoveredSection("category")}
                  onMouseLeave={() => setHoveredSection(null)}
                >
                  <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex flex-wrap gap-1.5 items-center min-w-0">
                    {(task?.categories ?? []).length > 0 &&
                      (task?.categories ?? []).map((c: any) => (
                        <FactChipView
                          key={c.id}
                          label={(c.name || c.label || "—").toString().toUpperCase()}
                          className="font-mono text-[11px] rounded-[8px] h-[24px]"
                        />
                      ))}
                    {(hoveredSection === "category" || editingSection === "category") && (
                      <InstructionField
                        value={sectionInstructions.category}
                        onChange={(v) => setSectionInstructions((s) => ({ ...s, category: v }))}
                        onEditStart={() => setEditingSection("category")}
                        onEditEnd={() => setEditingSection(null)}
                      />
                    )}
                  </div>
                </div>

                {/* Compliance */}
                <div
                  className="flex items-center gap-2 min-h-[24px]"
                  onMouseEnter={() => setHoveredSection("compliance")}
                  onMouseLeave={() => setHoveredSection(null)}
                >
                  <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex flex-wrap gap-1.5 items-center min-w-0">
                    {portfolioLoading ? (
                      <span className="text-xs text-muted-foreground">Loading...</span>
                    ) : propertyComplianceItems.length > 0 || imageHazards.length > 0 ? (
                      <RelatedComplianceSection
                        items={propertyComplianceItems}
                        imageHazards={imageHazards}
                        isLoading={false}
                        hideHeader
                      />
                    ) : null}
                    {(hoveredSection === "compliance" || editingSection === "compliance") && (
                      <InstructionField
                        value={sectionInstructions.compliance}
                        onChange={(v) => setSectionInstructions((s) => ({ ...s, compliance: v }))}
                        onEditStart={() => setEditingSection("compliance")}
                        onEditEnd={() => setEditingSection(null)}
                      />
                    )}
                  </div>
                </div>

                {taskId && (
                  <GraphInsightPanel
                    start={{ type: "task", id: taskId }}
                    depth={2}
                    variant="minimal"
                  />
                )}
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
                    onUploadComplete={() => {
                      queryClient.invalidateQueries({ queryKey: ["task-attachments", taskId] });
                      queryClient.invalidateQueries({ queryKey: ["task-details", (task as any)?.org_id, taskId] });
                      queryClient.invalidateQueries({ queryKey: ["tasks"] });
                      refreshTask();
                      setSelectedImageIndex(0);
                    }}
                    accept="image/*"
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
                      onShowOverlays={() => {
                        const meta = (img?.metadata || {}) as Record<string, unknown>;
                        const detected = (meta.detected_objects as Array<{ type?: string; label?: string; confidence?: number; x?: number; y?: number; width?: number; height?: number }>) || [];
                        const overlays: DetectionOverlay[] = detected.map((obj, i) => ({
                          type: obj.type || "object",
                          label: obj.label || obj.type || "Detected",
                          x: obj.x ?? 0.1,
                          y: obj.y ?? 0.1 + i * 0.2,
                          width: obj.width ?? 0.3,
                          height: obj.height ?? 0.15,
                          confidence: obj.confidence,
                        }));
                        setDetectionOverlays(overlays);
                        setEditingImageId(img.id);
                        setShowAnnotationEditor(true);
                      }}
                    />
                  );
                })()}
                {task.images && task.images.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3">All Images ({task.images.length})</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {task.images.map((image: any) => (
                        <div key={image.id} className="relative aspect-square rounded-lg overflow-hidden shadow-e1 group">
                          <img
                            src={image.thumbnail_url || image.file_url}
                            alt={image.file_name || "Task image"}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              if (image.thumbnail_url && image.file_url) {
                                (e.target as HTMLImageElement).src = image.file_url;
                              }
                            }}
                          />
                        </div>
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

      {/* CTA panel - paper bg, [Options][Update Task][Mark Complete] - sticky at bottom */}
      <div className="flex flex-col gap-3 p-4 border-t border-border/30 flex-shrink-0 bg-background bg-paper-texture sticky bottom-0">
        <div className="flex gap-2 items-center flex-wrap">
          {canManageTask && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="shadow-e1 h-9 gap-1.5">
                  <MoreVertical className="h-4 w-4 sm:mr-0" />
                  <span className="hidden sm:inline">Options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
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
          {hasEdits && canManageTask && (
            <Button
              size="sm"
              className="shadow-primary-btn h-9 flex-1 min-w-0"
              onClick={handleUpdateTask}
              disabled={isUpdating}
            >
              {isUpdating ? "Updating..." : "Update Task"}
            </Button>
          )}
          {canManageTask && (
            <Button
              size="sm"
              variant={status === "completed" ? "secondary" : "default"}
              className={cn(
                "h-9 flex-1 min-w-0",
                status !== "completed" && "shadow-primary-btn"
              )}
              onClick={async () => {
                if (status === "completed") return;
                if (isUpdating) return;
                setIsUpdating(true);
                try {
                  const { error } = await supabase.from("tasks").update({ status: "completed" }).eq("id", taskId);
                  if (error) throw error;
                  setStatus("completed");
                  await refreshTask();
                  queryClient.invalidateQueries({ queryKey: ["tasks"] });
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
    
    {/* Image Annotation Editor - Render in Portal to ensure proper z-index above Dialog */}
    {showAnnotationEditor && editingImageId && task && createPortal(
      <ImageAnnotationEditorWrapper
        taskId={taskId}
        imageId={editingImageId}
        imageUrl={
          task.images?.find((img: any) => img.id === editingImageId)?.thumbnail_url ||
          task.images?.find((img: any) => img.id === editingImageId)?.file_url ||
          ""
        }
        detectionOverlays={detectionOverlays}
        onClose={() => {
          setShowAnnotationEditor(false);
          setEditingImageId(null);
          setDetectionOverlays([]);
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
  const { annotations, saveAnnotations } = useImageAnnotations(taskId, imageId);

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
