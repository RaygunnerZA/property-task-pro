import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, MoreVertical, CheckSquare, MessageSquare, FileText, Clock, User, Users, ChevronLeft, ChevronRight, Edit, Upload, Save, SquarePen } from "lucide-react";
import { useTaskDetails } from "@/hooks/use-task-details";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useTeams } from "@/hooks/useTeams";
import { TaskMessaging } from "./TaskMessaging";
import { FileUploadZone } from "@/components/attachments/FileUploadZone";
import { ImageAnnotationEditorWrapper } from "@/components/tasks/ImageAnnotationEditorWrapper";
import type { AnnotationSavePayload } from "@/types/annotation-payload";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/chips/Chip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface TaskDetailPanelProps {
  taskId: string;
  onClose: () => void;
  variant?: "modal" | "column"; // "modal" for mobile overlay, "column" for desktop third column
}

/**
 * Task Detail Panel
 * 
 * Modal dialog for viewing and editing task details
 * - Editable title, status, priority
 * - Tabs: Summary, Messaging, Files, Logs
 * - Can be closed by clicking outside or the X button
 */
export function TaskDetailPanel({ taskId, onClose, variant = "modal" }: TaskDetailPanelProps) {
  const { task, loading, error, refresh: refreshTask } = useTaskDetails(taskId);
  const { members, loading: membersLoading } = useOrgMembers();
  const { teams, loading: teamsLoading } = useTeams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<string>("open");
  const [priority, setPriority] = useState<string>("normal");
  const [activeTab, setActiveTab] = useState("summary");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const thumbnailScrollRef = useRef<HTMLDivElement>(null);
  const [showAnnotationEditor, setShowAnnotationEditor] = useState(false);
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [annotatedPreviews, setAnnotatedPreviews] = useState<Record<string, string>>({});

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

  // Loading state - show skeleton but keep left panel structure
  if (loading) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Loading Task</DialogTitle>
            <DialogDescription>Loading task details...</DialogDescription>
          </DialogHeader>
          <div className="flex flex-1 overflow-hidden">
            {/* Left Image Panel Skeleton */}
            <div className="w-64 border-r border-border/20 bg-muted/20 flex flex-col">
              <div className="p-4 border-b border-border/20">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-24 w-full" />
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <Skeleton className="h-32 w-full mb-3" />
              </div>
            </div>
            {/* Main Content Skeleton */}
            <div className="flex-1 p-6 space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Error state - show error but keep left panel structure
  if (error || !task) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Task Error</DialogTitle>
            <DialogDescription>An error occurred while loading the task.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-1 overflow-hidden">
            {/* Left Image Panel - Empty state */}
            <div className="w-64 border-r border-border/20 bg-muted/20 flex flex-col">
              <div className="p-4 border-b border-border/20">
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Images</h3>
                <div className="text-xs text-muted-foreground">Task not loaded</div>
              </div>
            </div>
            {/* Main Content Error */}
            <div className="flex-1 p-6">
              <div className="text-center py-12">
                <p className="text-destructive mb-4">{error || "Couldn't find this task"}</p>
                <button
                  onClick={onClose}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Shared panel content - extracted to avoid duplication
  const panelContent = (
    <>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border/20 p-6 space-y-4">
        {/* Close Button & Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
            aria-label="Close panel"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleUpdateTask}
              disabled={isUpdating}
              className={cn(
                "px-4 py-2 rounded-lg font-medium text-sm transition-all",
                "bg-primary text-primary-foreground hover:bg-primary/90",
                "shadow-e1 hover:shadow-e2 active:scale-[0.98]",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "flex items-center gap-2"
              )}
            >
              <Save className="h-4 w-4" />
              {isUpdating ? "Updating..." : "Update"}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  aria-label="More options"
                >
                  <MoreVertical className="h-5 w-5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Duplicate Task</DropdownMenuItem>
                <DropdownMenuItem>Archive Task</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">Delete Task</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Editable Title */}
        <div>
          {isEditingTitle ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setIsEditingTitle(false);
                  // TODO: Save title
                }
                if (e.key === "Escape") {
                  setIsEditingTitle(false);
                  setTitle((task as any).title || "");
                }
              }}
              className={cn(
                "text-2xl font-semibold border-0 bg-transparent p-0",
                "focus-visible:ring-0 focus-visible:ring-offset-0",
                "shadow-none"
              )}
              autoFocus
            />
          ) : (
            <h1
              onClick={() => setIsEditingTitle(true)}
              className="text-2xl font-semibold text-foreground cursor-text hover:bg-muted/30 rounded px-2 py-1 -mx-2 -my-1 transition-colors"
            >
              {title || (task as any).title || "Untitled Task"}
            </h1>
          )}
        </div>

        {/* Status & Priority Chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger
              className={cn(
                "h-8 border rounded-lg font-medium text-xs",
                getStatusColor(status),
                "w-auto min-w-[120px]"
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger
              className={cn(
                "h-8 border rounded-lg font-medium text-xs",
                getPriorityColor(priority),
                "w-auto min-w-[100px]"
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {priorityOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-y-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="sticky top-0 z-10 bg-card border-b border-border/20 px-6">
            <TabsList className="w-full grid grid-cols-4 h-12 bg-transparent p-1">
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
          <div className="flex-1 overflow-hidden flex flex-col p-6">
            <TabsContent value="summary" className="mt-0 flex-1 overflow-y-auto">
              <div className="space-y-6">
                {/* Task Images - Show in Summary tab too */}
                {task.images && task.images.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">Images</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {task.images.map((image: any) => (
                        <div key={image.id} className="relative aspect-square rounded-lg overflow-hidden shadow-e1 group">
                          <img
                            src={image.thumbnail_url || image.file_url}
                            alt={image.file_name || "Task image"}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback to file_url if thumbnail fails
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

                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">Description</h3>
                  <p className="text-foreground">
                    {(task as any).description || "No description provided"}
                  </p>
                </div>
                {task.property && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">Property</h3>
                    <p className="text-foreground">
                      {task.property.nickname || task.property.address}
                    </p>
                  </div>
                )}
                {(task as any).due_date && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">Due Date</h3>
                    <p className="text-foreground">
                      {new Date((task as any).due_date).toLocaleDateString()}
                    </p>
                  </div>
                )}

                {/* Assignee Section */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-muted-foreground">Assignee</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2 min-h-[32px]">
                      {selectedUser ? (
                        <Chip
                          role="fact"
                          label={selectedUser.display_name.toUpperCase()}
                          onRemove={() => handleUserChange(undefined)}
                        />
                      ) : isUnconfirmedUser ? (
                        <Chip
                          role="fact"
                          label={(selectedUserId?.replace("pending-", "") || "Unconfirmed user").toUpperCase()}
                          onRemove={() => handleUserChange(undefined)}
                          className="opacity-50"
                        />
                      ) : (
                        <Select
                          value=""
                          onValueChange={(value) => {
                            if (value) handleUserChange(value);
                          }}
                          disabled={isUpdating || membersLoading}
                        >
                          <SelectTrigger className="h-8 w-full max-w-[200px] shadow-engraved">
                            <SelectValue placeholder="Select assignee..." />
                          </SelectTrigger>
                          <SelectContent>
                            {members.map((member) => (
                              <SelectItem key={member.user_id} value={member.user_id}>
                                {member.display_name}
                              </SelectItem>
                            ))}
                            {members.length === 0 && (
                              <SelectItem value="__no_members__" disabled>
                                No members available
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    {isUnconfirmedUser && (
                      <p className="text-xs text-muted-foreground">User unconfirmed</p>
                    )}
                  </div>
                </div>

                {/* Teams Section */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-muted-foreground">Teams</h3>
                  </div>
                  <div className="flex flex-wrap gap-2 min-h-[32px]">
                    {selectedTeamIds.length > 0 && (
                      <>
                        {selectedTeamIds.map((teamId) => {
                          const team = teams.find(t => t.id === teamId);
                          return team ? (
                            <Chip
                              key={teamId}
                              role="fact"
                              label={team.name.toUpperCase()}
                              onRemove={() => toggleTeam(teamId)}
                            />
                          ) : null;
                        })}
                      </>
                    )}
                    {teams.length > 0 && (
                      <Select
                        value=""
                        onValueChange={(value) => {
                          if (value && !selectedTeamIds.includes(value)) {
                            toggleTeam(value);
                          }
                        }}
                        disabled={isUpdating || teamsLoading}
                      >
                        <SelectTrigger className="h-8 w-full max-w-[200px] shadow-engraved">
                          <SelectValue placeholder="Add team..." />
                        </SelectTrigger>
                        <SelectContent>
                          {teams
                            .filter(team => !selectedTeamIds.includes(team.id))
                            .map((team) => (
                              <SelectItem key={team.id} value={team.id}>
                                {team.name}
                              </SelectItem>
                            ))}
                          {teams.filter(team => !selectedTeamIds.includes(team.id)).length === 0 && (
                            <SelectItem value="__all_assigned__" disabled>
                              All teams assigned
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                    {teams.length === 0 && (
                      <p className="text-xs text-muted-foreground py-2">
                        No teams available
                      </p>
                    )}
                    {selectedTeamIds.length === 0 && teams.length > 0 && (
                      <p className="text-xs text-muted-foreground py-2">
                        No teams assigned
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="messaging" className="mt-0 flex-1 flex flex-col min-h-0">
              <TaskMessaging taskId={taskId} />
            </TabsContent>

            <TabsContent value="files" className="mt-0 flex-1 overflow-y-auto">
              <div className="space-y-4 p-6">
                <p className="text-muted-foreground text-sm">
                  Images are displayed in the left panel. Use the upload zone there to add new images.
                </p>
                {/* Image Grid for larger view */}
                {task.images && task.images.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                      All Images ({task.images.length})
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {task.images.map((image: any) => (
                        <div
                          key={image.id}
                          className="relative aspect-square rounded-lg overflow-hidden shadow-e1 group"
                        >
                          <img
                            src={image.thumbnail_url || image.file_url}
                            alt={image.file_name || "Task image"}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback to file_url if thumbnail fails
                              if (image.thumbnail_url && image.file_url) {
                                (e.target as HTMLImageElement).src = image.file_url;
                              }
                            }}
                          />
                          {/* Overlay on hover */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <button className="opacity-0 group-hover:opacity-100 p-2 rounded-full bg-black/50 text-white transition-opacity">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
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
    </>
  );

  // Always render as modal dialog
  return (
    <>
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Task Details</DialogTitle>
          <DialogDescription>View and edit task details</DialogDescription>
        </DialogHeader>
        <div className="flex flex-1 overflow-hidden">
          {/* Left Column: Primary Image + Media Gallery - Always show if task exists, even if loading */}
          {(task || loading) && (
            <div className="w-80 border-r border-border/20 bg-muted/20 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Primary Image Display */}
                <div className="aspect-square w-full bg-muted rounded-lg overflow-hidden shadow-e1 relative group">
                  {loading ? (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <div className="text-sm">Loading...</div>
                    </div>
                  ) : task && task.images && task.images.length > 0 ? (
                    <>
                      <img
                        src={
                          annotatedPreviews[task.images[selectedImageIndex ?? 0]?.id] ||
                          task.images[selectedImageIndex ?? 0]?.annotated_preview_url ||
                          task.images[selectedImageIndex ?? 0]?.thumbnail_url ||
                          task.images[selectedImageIndex ?? 0]?.file_url
                        }
                        alt={task.images[selectedImageIndex ?? 0]?.file_name || "Task image"}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const image = task.images[selectedImageIndex ?? 0];
                          if (image?.thumbnail_url && image?.file_url) {
                            (e.target as HTMLImageElement).src = image.file_url;
                          }
                        }}
                      />
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          className="p-1.5 bg-black/50 rounded-[5px] hover:bg-black/70 text-white"
                          onClick={() => {
                            const image = task.images[selectedImageIndex ?? 0];
                            if (image?.id) {
                              setEditingImageId(image.id);
                              setShowAnnotationEditor(true);
                            }
                          }}
                          title="Annotate image"
                        >
                          <SquarePen className="h-3 w-3" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                      <CheckSquare className="h-16 w-16 mb-2" />
                      <span className="text-sm">No image</span>
                    </div>
                  )}
                </div>

                {/* Media Gallery Thumbnails - Only show when 2+ images exist */}
                {!loading && task && task.images && task.images.length > 1 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Media Gallery
                    </h3>
                    <div className="relative">
                      {/* Container with overflow hidden to show only 3 thumbnails */}
                      <div className="overflow-hidden" style={{ width: 'calc(3 * 6rem + 2 * 0.5rem)' }}>
                        {/* Scrollable thumbnail container */}
                        <div
                          ref={thumbnailScrollRef}
                          className="flex gap-2 overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                        >
                          {task.images.map((image: any, index: number) => (
                            <div
                              key={image.id}
                              className={cn(
                                "aspect-square w-24 h-24 flex-shrink-0 bg-muted rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity relative group border-2",
                                selectedImageIndex === index ? "border-primary" : "border-transparent"
                              )}
                              onClick={() => setSelectedImageIndex(index)}
                            >
                              <img
                                src={
                                  annotatedPreviews[image.id] ||
                                  image.annotated_preview_url ||
                                  image.thumbnail_url ||
                                  image.file_url
                                }
                                alt={image.file_name || "Task image"}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  if (image.thumbnail_url && image.file_url) {
                                    (e.target as HTMLImageElement).src = image.file_url;
                                  }
                                }}
                              />
                              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                <button
                                  className="p-1 bg-black/50 rounded-[5px] hover:bg-black/70 text-white"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (image.id) {
                                      setEditingImageId(image.id);
                                      setShowAnnotationEditor(true);
                                    }
                                  }}
                                  title="Annotate image"
                                >
                                  <SquarePen className="h-2.5 w-2.5" />
                                </button>
                                <button
                                  className="p-1 bg-black/50 rounded-[5px] hover:bg-black/70 text-white"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // TODO: Delete image
                                  }}
                                >
                                  <X className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Navigation arrows - only show if more than 3 images */}
                      {task.images.length > 3 && (
                        <>
                          <button
                            onClick={() => {
                              if (thumbnailScrollRef.current) {
                                const scrollAmount = 104; // 96px (w-24) + 8px (gap-2)
                                thumbnailScrollRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
                              }
                            }}
                            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 p-1.5 bg-background/90 backdrop-blur-sm rounded-full shadow-e1 hover:shadow-e2 transition-all z-10"
                            aria-label="Scroll left"
                          >
                            <ChevronLeft className="h-4 w-4 text-foreground" />
                          </button>
                          <button
                            onClick={() => {
                              if (thumbnailScrollRef.current) {
                                const scrollAmount = 104; // 96px (w-24) + 8px (gap-2)
                                thumbnailScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
                              }
                            }}
                            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 p-1.5 bg-background/90 backdrop-blur-sm rounded-full shadow-e1 hover:shadow-e2 transition-all z-10"
                            aria-label="Scroll right"
                          >
                            <ChevronRight className="h-4 w-4 text-foreground" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Upload Zone - Always visible */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Upload Images
                  </h3>
                  <FileUploadZone
                    taskId={taskId}
                    onUploadComplete={() => {
                      // Invalidate React Query cache to refetch attachments
                      queryClient.invalidateQueries({ queryKey: ["task-attachments", taskId] });
                      queryClient.invalidateQueries({ queryKey: ["task-details", (task as any)?.org_id, taskId] });
                      queryClient.invalidateQueries({ queryKey: ["tasks"] });
                      refreshTask();
                      // Reset to first image after upload
                      setSelectedImageIndex(0);
                    }}
                    accept="image/*"
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {panelContent}
          </div>
        </div>
      </DialogContent>
      
    </Dialog>
    
    {/* Image Annotation Editor - Render in Portal to ensure proper z-index above Dialog */}
    {showAnnotationEditor && editingImageId && task && createPortal(
      <ImageAnnotationEditorWrapper
        open={showAnnotationEditor}
        imageUrl={
          task.images?.find((img: any) => img.id === editingImageId)?.optimized_url ||
          task.images?.find((img: any) => img.id === editingImageId)?.file_url ||
          task.images?.find((img: any) => img.id === editingImageId)?.thumbnail_url ||
          ""
        }
        initialAnnotations={
          task.images?.find((img: any) => img.id === editingImageId)?.annotation_json || []
        }
        onSave={async (data: AnnotationSavePayload) => {
          if (!editingImageId) return;

          setAnnotatedPreviews((prev) => ({
            ...prev,
            [editingImageId]: data.previewDataUrl,
          }));

          try {
            const updatePayload: Record<string, any> = {
              annotation_json: data.annotations,
            };
            if (data.previewDataUrl) {
              updatePayload.annotated_preview_url = data.previewDataUrl;
            }

            const { error } = await supabase
              .from("attachments")
              .update(updatePayload)
              .eq("id", editingImageId);

            if (error) {
              console.error("Error updating image annotations:", error);
            }
          } catch (err) {
            console.error("Failed to save annotations:", err);
          } finally {
            queryClient.invalidateQueries({ queryKey: ["task-attachments", taskId] });
            queryClient.invalidateQueries({ queryKey: ["task-details", (task as any)?.org_id, taskId] });
            refreshTask();
            setShowAnnotationEditor(false);
            setEditingImageId(null);
          }
        }}
        onCancel={() => {
          setShowAnnotationEditor(false);
          setEditingImageId(null);
        }}
        onOpenChange={(open) => {
          if (!open) {
            setShowAnnotationEditor(false);
            setEditingImageId(null);
          }
        }}
      />,
      document.body
    )}
    </>
  );
}
