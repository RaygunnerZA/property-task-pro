import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X, MoreVertical, CheckSquare, MessageSquare, FileText, Clock, User, Users, MapPin, Calendar, ChevronLeft, ChevronRight, Save, SquarePen } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/chips/Chip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { GraphInsightPanel } from "@/components/graph/GraphInsightPanel";
import { useAssistantContext } from "@/contexts/AssistantContext";
import { FillaIcon } from "@/components/filla/FillaIcon";

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
        return "bg-primary/10 text-primary border-primary/20";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-500/10 text-red-700 border-red-500/20";
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
  const { openAssistant } = useAssistantContext();

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

  // Shared panel content - Create Task aesthetic: p-4, image slider top, description 18pt, multi-column, CTA bottom
  const panelContent = (
    <>
      {/* Image thumbnail slider at top - with Close (left), Filla AI + Options (right) */}
      <div className="relative p-4 pb-0">
        <button
          onClick={onClose}
          className="absolute top-6 left-6 z-20 p-2 rounded-lg bg-black/30 hover:bg-black/50 text-white transition-colors"
          aria-label="Close panel"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="absolute top-6 right-6 z-20 flex items-center gap-2">
          <button
            onClick={() => taskId && openAssistant({ type: "task", id: taskId, name: (task as any)?.title })}
            className="p-2 rounded-lg bg-black/30 hover:bg-black/50 text-white transition-colors"
            aria-label="Filla AI"
          >
            <FillaIcon size={20} />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="p-2 rounded-lg bg-black/30 hover:bg-black/50 text-white transition-colors"
                aria-label="Options"
              >
                <MoreVertical className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Duplicate Task</DropdownMenuItem>
              <DropdownMenuItem>Archive Task</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">Delete Task</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {task && task.images && task.images.length > 0 ? (
          <>
            <div className="aspect-video w-full bg-muted rounded-[8px] overflow-hidden shadow-e1 relative group">
              <img
                src={task.images[selectedImageIndex ?? 0]?.thumbnail_url || task.images[selectedImageIndex ?? 0]?.file_url}
                alt={task.images[selectedImageIndex ?? 0]?.file_name || "Task image"}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const image = task.images[selectedImageIndex ?? 0];
                  if (image?.thumbnail_url && image?.file_url) {
                    (e.target as HTMLImageElement).src = image.file_url;
                  }
                }}
              />
              <button
                className="absolute bottom-2 right-2 p-1.5 bg-black/50 rounded-[5px] hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => {
                  const image = task.images[selectedImageIndex ?? 0];
                  if (image?.id) {
                    setDetectionOverlays([]);
                    setEditingImageId(image.id);
                    setShowAnnotationEditor(true);
                  }
                }}
                title="Annotate image"
              >
                <SquarePen className="h-3 w-3" />
              </button>
            </div>
            {task.images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden" ref={thumbnailScrollRef}>
                {task.images.map((image: any, index: number) => {
                  const hasAi = image?.ocr_text?.trim() || (image?.metadata as any)?.detected_objects?.length;
                  const expiryStatus = getImageExpiryStatus(image);
                  return (
                    <button
                      key={image.id}
                      type="button"
                      className={cn(
                        "aspect-square w-14 h-14 flex-shrink-0 bg-muted rounded-[8px] overflow-hidden cursor-pointer hover:opacity-80 transition-opacity relative border-2 shadow-e1",
                        selectedImageIndex === index ? "border-primary" : "border-transparent",
                        hasAi && expiryStatus === "green" && "ring-1 ring-green-500/50 ring-inset",
                        hasAi && expiryStatus === "amber" && "ring-1 ring-amber-500/50 ring-inset",
                        hasAi && expiryStatus === "red" && "ring-1 ring-red-500/50 ring-inset"
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
                      {hasAi && (
                        <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[9px] text-center py-0.5 text-white font-medium">🔎</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="aspect-video w-full bg-muted rounded-[8px] overflow-hidden shadow-e1 flex items-center justify-center text-muted-foreground text-sm">
            No images
          </div>
        )}
      </div>

      {/* Content - p-4 matching Create Task */}
      <div className="p-4 space-y-6 flex-1 overflow-y-auto min-h-0">
        {/* Description 18pt - replaces title */}
        <p className="text-[18px] text-foreground leading-relaxed">
          {(task as any)?.description || "No description provided"}
        </p>

        {/* Multi-column: Property | Due Date | Assignee | Teams - Create Task icons + fact chips */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2 min-h-[32px]">
            <div className="flex-shrink-0 w-[32px] h-8 flex items-center justify-center rounded-[8px] bg-background shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]">
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </div>
            <Chip
              role="fact"
              label={(task?.property?.nickname || task?.property?.address || "—").toString().toUpperCase()}
              className="font-mono text-[11px] rounded-[8px] h-[24px] bg-white"
            />
          </div>
          <div className="flex items-center gap-2 min-h-[32px]">
            <div className="flex-shrink-0 w-[32px] h-8 flex items-center justify-center rounded-[8px] bg-background shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]">
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            <Chip
              role="fact"
              label={((task as any)?.due_date ? new Date((task as any).due_date).toLocaleDateString() : "—").toUpperCase()}
              className="font-mono text-[11px] rounded-[8px] h-[24px] bg-white"
            />
          </div>
          <div className="flex items-center gap-2 min-h-[32px]">
            <div className="flex-shrink-0 w-[32px] h-8 flex items-center justify-center rounded-[8px] bg-background shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]">
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex flex-wrap gap-1.5 items-center">
              {selectedUser ? (
                <Chip
                  role="fact"
                  label={selectedUser.display_name.toUpperCase()}
                  onRemove={() => handleUserChange(undefined)}
                  className="font-mono text-[11px] rounded-[8px] h-[24px] bg-white"
                />
              ) : isUnconfirmedUser ? (
                <Chip
                  role="fact"
                  label={(selectedUserId?.replace("pending-", "") || "Unconfirmed").toUpperCase()}
                  onRemove={() => handleUserChange(undefined)}
                  className="font-mono text-[11px] rounded-[8px] h-[24px] bg-white opacity-50"
                />
              ) : (
                <Select
                  value=""
                  onValueChange={(v) => v && handleUserChange(v)}
                  disabled={isUpdating || membersLoading}
                >
                  <SelectTrigger className="h-[24px] w-auto min-w-[100px] shadow-engraved text-[11px] font-mono rounded-[8px]">
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
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 min-h-[32px]">
            <div className="flex-shrink-0 w-[32px] h-8 flex items-center justify-center rounded-[8px] bg-background shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]">
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex flex-wrap gap-1.5 items-center">
              {selectedTeamIds.map((tid) => {
                const team = teams.find((t) => t.id === tid);
                return team ? (
                  <Chip
                    key={tid}
                    role="fact"
                    label={team.name.toUpperCase()}
                    onRemove={() => toggleTeam(tid)}
                    className="font-mono text-[11px] rounded-[8px] h-[24px] bg-white"
                  />
                ) : null;
              })}
              {teams.length > 0 && teams.some((t) => !selectedTeamIds.includes(t.id)) && (
                <Select
                  value=""
                  onValueChange={(v) => v && !selectedTeamIds.includes(v) && toggleTeam(v)}
                  disabled={isUpdating || teamsLoading}
                >
                  <SelectTrigger className="h-[24px] w-auto min-w-[80px] shadow-engraved text-[11px] font-mono rounded-[8px]">
                    <SelectValue placeholder="Add..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.filter((t) => !selectedTeamIds.includes(t.id)).map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {teams.length === 0 && selectedTeamIds.length === 0 && (
                <Chip role="fact" label="—" className="font-mono text-[11px] rounded-[8px] h-[24px] bg-white opacity-50" />
              )}
            </div>
          </div>
        </div>

        {/* Status & Priority - compact */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className={cn("h-8 border rounded-[8px] font-medium text-xs w-auto min-w-[100px]", getStatusColor(status))}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className={cn("h-8 border rounded-[8px] font-medium text-xs w-auto min-w-[90px]", getPriorityColor(priority))}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {priorityOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {autoTaskRecord && <Badge variant="secondary" className="text-xs font-normal">Auto-generated</Badge>}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/20 px-0">
            <TabsList className="w-full grid grid-cols-4 h-11 bg-transparent p-1 gap-1">
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
                value="files"
                className={cn(
                  "rounded-lg data-[state=active]:bg-card",
                  "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]"
                )}
              >
                <FileText className="h-4 w-4 mr-2" />
                Files
              </TabsTrigger>
              <TabsTrigger
                value="logs"
                className={cn(
                  "rounded-lg data-[state=active]:bg-card",
                  "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]"
                )}
              >
                <Clock className="h-4 w-4 mr-2" />
                Logs
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden flex flex-col p-4">
            <TabsContent value="summary" className="mt-0 flex-1 overflow-y-auto">
              <div className="space-y-6">
                <RelatedComplianceSection
                  items={propertyComplianceItems}
                  imageHazards={imageHazards}
                  isLoading={portfolioLoading}
                />
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

            <TabsContent value="files" className="mt-0 flex-1 overflow-y-auto">
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
              </div>
            </TabsContent>

            <TabsContent value="logs" className="mt-0 flex-1 overflow-y-auto">
              <div className="space-y-4">
                <p className="text-muted-foreground text-sm">
                  Audit logs and activity history will appear here
                </p>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Create Task-style CTA panel */}
      <div className="flex flex-col gap-3 p-4 border-t border-border/30 bg-card/80 backdrop-blur flex-shrink-0">
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 shadow-e1" onClick={onClose}>
            Close
          </Button>
          <Button
            className="flex-1 shadow-primary-btn"
            onClick={handleUpdateTask}
            disabled={isUpdating}
          >
            {isUpdating ? "Updating..." : "Update Task"}
          </Button>
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
