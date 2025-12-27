import { useState, useEffect } from "react";
import { X, MoreVertical, CheckSquare, MessageSquare, FileText, Clock, User, Users } from "lucide-react";
import { useTaskDetails } from "@/hooks/use-task-details";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useTeams } from "@/hooks/useTeams";
import { TaskMessaging } from "./TaskMessaging";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StandardChip } from "@/components/chips/StandardChip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface TaskDetailPanelProps {
  taskId: string;
  onClose: () => void;
}

/**
 * Task Detail Panel
 * 
 * Right-side slide-over panel for viewing and editing task details
 * - Fixed position, slides in from right
 * - Editable title, status, priority
 * - Tabs: Summary, Messaging, Files, Logs
 */
export function TaskDetailPanel({ taskId, onClose }: TaskDetailPanelProps) {
  const { task, loading, error, refresh: refreshTask } = useTaskDetails(taskId);
  const { members, loading: membersLoading } = useOrgMembers();
  const { teams, loading: teamsLoading } = useTeams();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<string>("open");
  const [priority, setPriority] = useState<string>("normal");
  const [activeTab, setActiveTab] = useState("summary");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  // Update local state when task data loads
  useEffect(() => {
    if (task) {
      setTitle(task.title || "");
      setStatus(task.status || "open");
      setPriority(task.priority || "normal");
      // Set assigned user from task (if assigned_user_id exists)
      setSelectedUserId((task as any).assigned_user_id || undefined);
      // Set selected teams from task.teams
      setSelectedTeamIds(task.teams?.map(t => t.id) || []);
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
        title: "Error",
        description: err.message || "Failed to update assignee",
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
        title: "Error",
        description: err.message || "Failed to update teams",
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

  const selectedUser = members.find(m => m.user_id === selectedUserId);

  if (loading) {
    return (
      <>
        <div
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          className={cn(
            "fixed right-0 top-0 h-full w-full md:w-[600px]",
            "bg-card shadow-2xl z-50",
            "flex flex-col",
            "transform transition-transform duration-300 ease-out",
            "translate-x-0"
          )}
        >
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </>
    );
  }

  if (error || !task) {
    return (
      <>
        <div
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          className={cn(
            "fixed right-0 top-0 h-full w-full md:w-[600px]",
            "bg-card shadow-2xl z-50",
            "flex flex-col",
            "transform transition-transform duration-300 ease-out",
            "translate-x-0"
          )}
        >
          <div className="p-6">
            <div className="text-center py-12">
              <p className="text-destructive mb-4">{error || "Task not found"}</p>
              <button
                onClick={onClose}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className="fixed inset-0 bg-black/20 z-40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Panel */}
      <div
        className={cn(
          "fixed right-0 top-0 h-full w-full md:w-[600px]",
          "bg-card shadow-2xl z-50",
          "flex flex-col",
          "transform transition-transform duration-300 ease-out",
          "translate-x-0"
        )}
      >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border/50 p-6 space-y-4">
        {/* Close Button & Overflow Menu */}
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
            aria-label="Close panel"
          >
            <X className="h-5 w-5 text-muted-foreground" />
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
                  setTitle(task.title || "");
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
              {title || task.title || "Untitled Task"}
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
          <div className="sticky top-0 z-10 bg-card border-b border-border/50 px-6">
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
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">Description</h3>
                  <p className="text-foreground">
                    {task.description || "No description provided"}
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
                {task.due_date && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">Due Date</h3>
                    <p className="text-foreground">
                      {new Date(task.due_date).toLocaleDateString()}
                    </p>
                  </div>
                )}

                {/* Assignee Section */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-muted-foreground">Assignee</h3>
                  </div>
                  <div className="flex flex-wrap gap-2 min-h-[32px]">
                    {selectedUser ? (
                      <StandardChip
                        label={selectedUser.display_name}
                        selected
                        onSelect={() => handleUserChange(undefined)}
                        onRemove={() => handleUserChange(undefined)}
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
                            <SelectItem value="" disabled>
                              No members available
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
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
                            <StandardChip
                              key={teamId}
                              label={team.name}
                              selected
                              onSelect={() => toggleTeam(teamId)}
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
                            <SelectItem value="" disabled>
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
              <div className="space-y-4">
                <p className="text-muted-foreground text-sm">
                  Files and attachments will appear here
                </p>
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
    </div>
    </>
  );
}

