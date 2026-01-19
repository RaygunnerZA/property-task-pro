import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, MoreVertical, CheckSquare, MessageSquare, FileText, Clock, User, Users, ChevronLeft, ChevronRight, Edit, Upload, Save, SquarePen, Calendar, Check, Loader2, Send, MessageCircle, ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { useTaskDetails } from "@/hooks/use-task-details";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useTeams } from "@/hooks/useTeams";
import { useSubtasks } from "@/hooks/useSubtasks";
import { useTaskMessages } from "@/hooks/useTaskMessages";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { FillaIcon } from "@/components/filla/FillaIcon";

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
  const { subtasks, loading: subtasksLoading } = useSubtasks(taskId);
  const { messages, loading: messagesLoading, refresh: refreshMessages } = useTaskMessages(taskId);
  const { orgId } = useActiveOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
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
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [viewingImageIndex, setViewingImageIndex] = useState(0);
  const [hiddenAnnotationIds, setHiddenAnnotationIds] = useState<Set<string>>(new Set());
  const [taskDetailsExpanded, setTaskDetailsExpanded] = useState(false);

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

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !orgId || !user || !taskId) {
      return;
    }

    setIsSending(true);

    try {
      // Find or create conversation for this task
      let { data: conversation, error: convError } = await supabase
        .from("conversations")
        .select("id")
        .eq("org_id", orgId)
        .eq("task_id", taskId)
        .maybeSingle();

      if (convError && convError.code !== "PGRST116") {
        throw convError;
      }

      let conversationId: string;

      if (!conversation) {
        const { data: newConv, error: createError } = await supabase
          .from("conversations")
          .insert({
            org_id: orgId,
            task_id: taskId,
            channel: "task",
            subject: `Task ${taskId}`,
          } as any)
          .select("id")
          .single();

        if (createError) {
          throw createError;
        }
        conversationId = newConv.id;
      } else {
        conversationId = conversation.id;
      }

      const { data: { user: authUser } } = await supabase.auth.getUser();
      const authorName = authUser?.email?.split("@")[0] || "User";

      const { error: insertError } = await supabase
        .from("messages")
        .insert({
          org_id: orgId,
          conversation_id: conversationId,
          author_user_id: user.id,
          author_name: authorName,
          body: messageText.trim(),
          source: "web",
          direction: "outbound",
        } as any);

      if (insertError) {
        throw insertError;
      }

      setMessageText("");
      refreshMessages();
    } catch (err: any) {
      console.error("Error sending message:", err);
      toast({
        title: "Failed to send message",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Get priority badge color
  const getPriorityBadgeColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent':
      case 'high':
        return 'bg-destructive text-destructive-foreground';
      case 'medium':
      case 'normal':
        return 'bg-warning text-warning-foreground';
      case 'low':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const selectedUser = members.find(m => m.user_id === selectedUserId);
  const isUnconfirmedUser = selectedUserId && selectedUserId.startsWith("pending-");

  // Loading state - show skeleton but keep left panel structure
  if (loading) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col p-0">
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
        <DialogContent className="max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col p-0">
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
      {/* Mobile Close Button - Top Right */}
      {isMobile && (
        <div className="sticky top-0 z-20 flex justify-end p-4 bg-background/95 backdrop-blur-sm border-b border-border/20">
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
            aria-label="Close panel"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
          </div>
      )}

      {/* Summary Content */}
      <div className={cn(
        "flex-1 overflow-y-auto",
        variant === "column" ? "p-4" : "p-6"
      )}>
        <div className={cn(
          "space-y-6",
          variant === "column" && "space-y-4"
        )}>
          {/* Chips at Top: Status, Assigned To, Priority, Due Date */}
          <div className="flex flex-wrap gap-2">
            <Badge className={getStatusColor(status)} variant="secondary">
              {status.replace('_', ' ').toUpperCase()}
            </Badge>
            {selectedUserId && (
              <Badge variant="outline" className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {members.find(m => m.id === selectedUserId)?.name || 'Unassigned'}
              </Badge>
            )}
            <Badge className={getPriorityBadgeColor(priority)} variant="secondary">
              {priority ? priority.toUpperCase() : 'NORMAL'}
            </Badge>
            {(task as any).due_date && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date((task as any).due_date), 'MMM d, yyyy')}
              </Badge>
            )}
          </div>

          {/* Task Title */}
          <div>
            <h1 className="text-lg font-bold leading-tight">{title || (task as any).title || "Untitled Task"}</h1>
          </div>

          {/* Images Section - Two Column Layout */}
          <div className="flex gap-4">
            {/* Left: Primary Thumbnail - 50% width */}
            <div className="w-1/2 relative group aspect-square rounded-lg overflow-hidden shadow-e1 cursor-pointer" onClick={() => {
              if (task.images && task.images.length > 0) {
                setViewingImageIndex(selectedImageIndex !== null ? selectedImageIndex : 0);
                setShowImageViewer(true);
              }
            }}>
              {task.images && task.images.length > 0 ? (
                <>
                  {(() => {
                    const primaryIndex = selectedImageIndex !== null ? selectedImageIndex : 0;
                    const primaryImage = task.images[primaryIndex];
                    const hasAnnotations = primaryImage?.annotation_json && Array.isArray(primaryImage.annotation_json) && primaryImage.annotation_json.length > 0;
                    return (
                      <>
                        <img
                          src={primaryImage?.thumbnail_url || primaryImage?.file_url}
                          alt={primaryImage?.file_name || "Task image"}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            if (primaryImage?.thumbnail_url && primaryImage?.file_url) {
                              (e.target as HTMLImageElement).src = primaryImage.file_url;
                            }
                          }}
                        />
                        {/* Speech bubble icon if annotations exist */}
                        {hasAnnotations && (
                          <div className="absolute top-2 right-2 p-1.5 bg-primary text-primary-foreground rounded-full shadow-lg">
                            <MessageCircle className="h-4 w-4" />
                          </div>
                        )}
                        {/* Next arrow on right */}
                        {task.images.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const nextIndex = (primaryIndex + 1) % task.images.length;
                              setSelectedImageIndex(nextIndex);
                            }}
                            className="absolute right-2 bottom-2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Next image"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        )}
                      </>
                    );
                  })()}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
                  <div className="text-center">
                    <Upload className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No image</p>
                  </div>
                </div>
              )}
            </div>

                  {/* Right: Thumbnail Carousel + Upload */}
                  <div className="w-32 space-y-3 flex flex-col">
                    {/* Thumbnail Carousel */}
                    {task.images && task.images.length > 1 && (
                      <div className="flex-1 space-y-2 overflow-y-auto">
                        {task.images.map((image: any, index: number) => {
                          const primaryIndex = selectedImageIndex !== null ? selectedImageIndex : 0;
                          // Don't show the primary image in the carousel
                          if (index === primaryIndex) return null;
                          
                          return (
                            <div
                              key={image.id}
              className={cn(
                                "relative group aspect-square rounded-lg overflow-hidden shadow-e1 cursor-pointer hover:opacity-80 transition-opacity",
                                index === selectedImageIndex && "ring-2 ring-primary"
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
                            {/* Annotation button */}
                            {image.id && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (image.id) {
                                    setEditingImageId(image.id);
                                    setShowAnnotationEditor(true);
                                  }
                                }}
                                className="absolute bottom-0.5 right-0.5 p-1 bg-black/50 hover:bg-black/70 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Annotate image"
                              >
                                <SquarePen className="h-2.5 w-2.5" />
                              </button>
                            )}
                        </div>
                        );
                        })}
                  </div>
                )}

                    {/* Upload Zone - Below carousel */}
                    <div className="space-y-2">
                      <FileUploadZone
                        taskId={taskId}
                        onUploadComplete={() => {
                          queryClient.invalidateQueries({ queryKey: ["task-details", taskId] });
                          queryClient.invalidateQueries({ queryKey: ["task-attachments", taskId] });
                          refreshTask();
                        }}
                        accept="image/*"
                        className="!space-y-0 [&>div]:p-3 [&>div]:min-h-0 [&>div>div>div]:hidden [&>div>div>div]:text-xs [&>div>div>p]:text-xs"
                      />
                </div>
                  </div>
                </div>

          {/* AI Summary Block */}
          <div className={cn(
            "rounded-lg bg-muted/30 border border-border/20",
            variant === "column" ? "p-3" : "p-4"
          )}>
            <div className="flex items-start gap-3">
              <FillaIcon size={16} className="mt-0.5 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                {priority === 'urgent' && (
                  <p className="text-xs text-destructive font-medium mt-0">⚠️ Urgent task - requires immediate attention</p>
                )}
                {(task as any).due_date && (() => {
                  const dueDate = new Date((task as any).due_date);
                  const today = new Date();
                  const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  if (daysUntilDue < 0) {
                    return <p className="text-sm text-destructive font-medium">⚠️ Deadline passed {Math.abs(daysUntilDue)} day(s) ago</p>;
                  } else if (daysUntilDue <= 1) {
                    return <p className="text-sm text-orange-600 font-medium">⚠️ Deadline approaching - due {daysUntilDue === 0 ? 'today' : 'tomorrow'}</p>;
                  } else if (daysUntilDue <= 3) {
                    return <p className="text-sm text-warning font-medium">⚠️ Deadline in {daysUntilDue} days</p>;
                  }
                  return null;
                })()}
                <p className="text-xs text-muted-foreground mt-[3px]" style={{ fontSize: '10px' }}>AI analysis: Monitor progress closely</p>
              </div>
            </div>
          </div>

          {/* Expandable Task Details */}
          <div className="space-y-3">
            <button
              onClick={() => setTaskDetailsExpanded(!taskDetailsExpanded)}
              className="flex items-center justify-between w-full text-left"
            >
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Task Details
              </h3>
              {taskDetailsExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {taskDetailsExpanded && (
              <div className="space-y-4 pl-4 border-l-2 border-border/30">
                {/* Description */}
                {(task as any).description && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Description</h4>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {(task as any).description}
                    </p>
                  </div>
                )}
                {/* Subtasks */}
                {subtasks && subtasks.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Subtasks</h4>
                    <div className="space-y-2">
                      {subtasks.map((subtask) => (
                        <div
                          key={subtask.id}
                          className={cn(
                            "flex items-center gap-3 p-2 rounded-lg",
                            subtask.is_completed || subtask.completed
                              ? "bg-muted/50 text-muted-foreground line-through"
                              : "bg-background"
                          )}
                        >
                          <div
                            className={cn(
                              "w-4 h-4 rounded border-2 flex items-center justify-center",
                              subtask.is_completed || subtask.completed
                                ? "bg-primary border-primary"
                                : "border-border"
                            )}
                          >
                            {(subtask.is_completed || subtask.completed) && (
                              <CheckSquare className="h-2.5 w-2.5 text-primary-foreground" />
                            )}
                          </div>
                          <span className="flex-1 text-sm">{subtask.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Location */}
                {(task as any).property_name && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Location</h4>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span>{task.property_name || task.property_address}</span>
                      {(task as any).spaces && Array.isArray((task as any).spaces) && (task as any).spaces.length > 0 && (
                        <span className="text-muted-foreground">→ {(task as any).spaces.map((s: any) => s.name || s.title).join(', ')}</span>
                      )}
                    </div>
                  </div>
                )}
                {/* Tags/Groups */}
                {((task as any).themes && Array.isArray((task as any).themes) && (task as any).themes.length > 0) || 
                 ((task as any).teams && Array.isArray((task as any).teams) && (task as any).teams.length > 0) && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Tags / Groups</h4>
                    <div className="flex flex-wrap gap-2">
                      {(task as any).themes && Array.isArray((task as any).themes) && (task as any).themes.map((theme: any) => (
                        <Badge key={theme.id || theme} variant="outline" className="text-xs">
                          {theme.name || theme.title || theme}
                        </Badge>
                      ))}
                      {(task as any).teams && Array.isArray((task as any).teams) && (task as any).teams.map((team: any) => (
                        <Badge key={team.id || team} variant="secondary" className="text-xs">
                          {team.name || team.title || team}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Perforation Line */}
          <div className={cn(
            "relative",
            variant === "column" ? "py-3 -mx-4" : "py-4"
          )}>
            <div className="w-full border-t border-dashed border-border/50" style={{
              backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 10px, currentColor 10px, currentColor 12px)',
              backgroundSize: '12px 1px'
            }}></div>
          </div>

          {/* Activity Section (renamed from Updates) */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Activity
            </h3>
                  
                  {/* Messages List */}
                  <div className={cn(
                    "space-y-4 max-h-[500px] overflow-y-auto rounded-lg bg-base-100 border border-border/30",
                    variant === "column" ? "p-3" : "p-4"
                  )}>
                    {messagesLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        No updates yet. Start the conversation!
                      </div>
                    ) : (
                      messages.map((message) => {
                        const isSender = message.author_user_id === user?.id;
                        return (
                          <div
                            key={message.id}
                            className={cn(
                              "chat",
                              isSender ? "chat-sender" : "chat-receiver"
                            )}
                          >
                            {!isSender && (
                              <div className="chat-avatar avatar">
                                <div className="size-10 rounded-full bg-muted flex items-center justify-center">
                                  <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                )}
                            <div className="chat-header text-base-content">
                              {message.author_name || "Unknown"}
                              <time className="text-base-content/50">
                                {format(new Date(message.created_at), "HH:mm")}
                              </time>
              </div>
                            <div className="chat-bubble">
                              {message.body}
              </div>
                            <div className="chat-footer text-base-content/50">
                              {isSender ? (
                                <div className="flex items-center gap-1">
                                  Seen
                                  <Check className="h-3 w-3 text-success" />
          </div>
                              ) : (
                                <div>Delivered</div>
                              )}
                    </div>
                          </div>
                        );
                      })
                  )}
                    <div ref={messagesEndRef} />
                </div>

                  {/* Message Input */}
                  <div className="flex gap-2">
                    <Textarea
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type your message... (Press Enter to send)"
                              className={cn(
                        "flex-1 rounded-xl bg-input resize-none input-neomorphic",
                        "border-0 focus:ring-2 focus:ring-primary/30"
                      )}
                      rows={2}
                      disabled={isSending}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!messageText.trim() || isSending}
                      className={cn(
                        "rounded-xl text-white self-end btn-accent-vibrant",
                        "border-0"
                      )}
                    >
                      {isSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Action Panel */}
                <div className="space-y-3 pt-4 border-t border-border/30">
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        // Focus message input or scroll to it
                        document.querySelector('textarea[placeholder*="Type your message"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        (document.querySelector('textarea[placeholder*="Type your message"]') as HTMLTextAreaElement)?.focus();
                      }}
                      variant="outline"
                      className="flex-1"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Add Message
                    </Button>
                    <Button
                      onClick={() => {
                        // TODO: Open reassign dialog
                        toast({ title: "Reassign", description: "Reassign functionality coming soon" });
                      }}
                      variant="outline"
                      className="flex-1"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Reassign
                    </Button>
                    <Button
                      onClick={async () => {
                        if (status === 'completed') {
                          toast({ title: "Already completed", description: "This task is already marked as complete" });
                          return;
                        }
                        setIsUpdating(true);
                        try {
                          const { error } = await supabase
                            .from("tasks")
                            .update({ status: "completed" })
                            .eq("id", taskId);
                          if (error) throw error;
                          setStatus("completed");
                          refreshTask();
                          toast({ title: "Task completed", description: "Task has been marked as complete" });
                        } catch (err: any) {
                          toast({ title: "Error", description: err.message || "Failed to mark task as complete", variant: "destructive" });
                        } finally {
                          setIsUpdating(false);
                        }
                      }}
                      disabled={isUpdating || status === 'completed'}
                      className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <CheckSquare className="h-4 w-4 mr-2" />
                      Mark Complete
                    </Button>
                  </div>
                </div>
              </div>
            </div>
    </>
  );

  // For column variant on wide screens, render inline (not Dialog)
  if (variant === "column" && !isMobile && typeof window !== "undefined" && window.innerWidth >= 350) {
    return (
      <>
        <div className="h-auto flex flex-col bg-background rounded-lg shadow-[2px_4px_6px_0px_rgba(0,0,0,0.15),-2px_-2px_4px_0px_rgba(255,255,255,0.5),inset_1px_1px_2px_0px_rgba(255,255,255,0.6),inset_-1px_-1px_2px_0px_rgba(0,0,0,0.1)] border border-border/20 relative overflow-hidden" style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise-filter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.522\' numOctaves=\'1\' stitchTiles=\'stitch\'%3E%3C/feTurbulence%3E%3CfeColorMatrix type=\'saturate\' values=\'0\'%3E%3C/feColorMatrix%3E%3CfeComponentTransfer%3E%3CfeFuncR type=\'linear\' slope=\'0.468\'%3E%3C/feFuncR%3E%3CfeFuncG type=\'linear\' slope=\'0.468\'%3E%3C/feFuncG%3E%3CfeFuncB type=\'linear\' slope=\'0.468\'%3E%3C/feFuncB%3E%3CfeFuncA type=\'linear\' slope=\'0.137\'%3E%3C/feFuncA%3E%3C/feComponentTransfer%3E%3CfeComponentTransfer%3E%3CfeFuncR type=\'linear\' slope=\'1.323\' intercept=\'-0.207\'/%3E%3CfeFuncG type=\'linear\' slope=\'1.323\' intercept=\'-0.207\'/%3E%3CfeFuncB type=\'linear\' slope=\'1.323\' intercept=\'-0.207\'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise-filter)\' opacity=\'0.8\'%3E%3C/rect%3E%3C/svg%3E")',
          backgroundSize: '100%'
        }}>
          {/* Section Title */}
          <div className="px-4 pt-4 pb-2 border-b border-border/30">
            <h2 className="text-lg font-semibold text-foreground">Task Details</h2>
          </div>
          <div className="relative z-10">
            {panelContent}
          </div>
        </div>
        
        {/* Image Viewer Modal */}
        {showImageViewer && task && task.images && task.images.length > 0 && createPortal(
          <Dialog open={showImageViewer} onOpenChange={setShowImageViewer}>
            <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden">
              <div className="relative w-full h-full flex items-center justify-center bg-black/95">
                {(() => {
                  const currentImage = task.images[viewingImageIndex];
                  const hasAnnotations = currentImage?.annotation_json && Array.isArray(currentImage.annotation_json) && currentImage.annotation_json.length > 0;
                  return (
                    <>
                      <img
                        src={currentImage?.optimized_url || currentImage?.file_url || currentImage?.thumbnail_url}
                        alt={currentImage?.file_name || "Task image"}
                        className="max-w-full max-h-[90vh] object-contain"
                      />
                      {/* Navigation Arrows */}
                      {task.images.length > 1 && (
                        <>
                          <button
                            onClick={() => setViewingImageIndex((viewingImageIndex - 1 + task.images.length) % task.images.length)}
                            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-opacity"
                          >
                            <ChevronLeft className="h-6 w-6" />
                          </button>
                          <button
                            onClick={() => setViewingImageIndex((viewingImageIndex + 1) % task.images.length)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-opacity"
                          >
                            <ChevronRight className="h-6 w-6" />
                          </button>
                        </>
                      )}
                      {/* Close button */}
                      <button
                        onClick={() => setShowImageViewer(false)}
                        className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white"
                      >
                        <X className="h-5 w-5" />
                      </button>
                      {/* Annotate button */}
                      {currentImage?.id && (
                        <button
                          onClick={() => {
                            setShowImageViewer(false);
                            setEditingImageId(currentImage.id);
                            setShowAnnotationEditor(true);
                          }}
                          className="absolute bottom-4 right-4 p-3 bg-primary hover:bg-primary/90 rounded-full text-white"
                        >
                          <SquarePen className="h-5 w-5" />
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            </DialogContent>
          </Dialog>,
          document.body
        )}

        {/* Image Annotation Editor - Portal */}
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

  // Modal variant or when column would be too narrow
  return (
    <>
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className={cn(
        "max-h-[90vh] overflow-hidden flex flex-col p-0",
        isMobile ? "max-w-full w-full h-full rounded-none m-0" : "max-w-[500px]"
      )}>
        <DialogHeader className="sr-only">
          <DialogTitle>Task Details</DialogTitle>
          <DialogDescription>View and edit task details</DialogDescription>
        </DialogHeader>
            {panelContent}
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
