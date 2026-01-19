import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, CheckSquare, Check } from 'lucide-react';
import { format } from 'date-fns';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useActiveOrg } from '@/hooks/useActiveOrg';
import { StandardPageWithBack } from '@/components/design-system/StandardPageWithBack';
import { LoadingState } from '@/components/design-system/LoadingState';
import { EmptyState } from '@/components/design-system/EmptyState';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileUploadZone } from '@/components/attachments/FileUploadZone';
import { cn } from '@/lib/utils';
import { useSubtasks } from '@/hooks/useSubtasks';
import { useTaskMessages } from '@/hooks/useTaskMessages';
import { useAuth } from '@/hooks/useAuth';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, User as UserIcon } from 'lucide-react';

type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

const getStatusColor = (status: TaskStatus) => {
  switch (status) {
    case 'completed':
      return 'bg-success text-success-foreground';
    case 'in_progress':
      return 'bg-warning text-warning-foreground';
    case 'pending':
      return 'bg-primary text-primary-foreground';
    case 'cancelled':
      return 'bg-muted text-muted-foreground';
    default:
      return 'bg-primary text-primary-foreground';
  }
};

interface TaskData {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: string;
  due_date: string | null;
  created_at: string;
  property_id: string | null;
  assigned_user_id: string | null;
}

interface PropertyData {
  id: string;
  nickname: string | null;
  address: string;
}

const TaskDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { messages, loading: messagesLoading, refresh: refreshMessages } = useTaskMessages(id);
  const { subtasks, loading: subtasksLoading } = useSubtasks(id);
  
  const [status, setStatus] = useState<TaskStatus>('pending');
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch task from tasks_view (includes property data)
  const { data: taskData, isLoading: loading, error } = useQuery({
    queryKey: ["task", orgId, id],
    queryFn: async () => {
      if (!id || !orgId) return null;
      const { data, error } = await supabase
        .from("tasks_view")
        .select("*")
        .eq("id", id)
        .eq("org_id", orgId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!orgId && !!id && !orgLoading,
    staleTime: 60000, // 1 minute
  });

  // Parse task from view (handles JSON arrays and property data)
  const task = useMemo(() => {
    if (!taskData) return null;
    return {
      ...taskData,
      spaces: typeof taskData.spaces === 'string' ? JSON.parse(taskData.spaces) : (taskData.spaces || []),
      themes: typeof taskData.themes === 'string' ? JSON.parse(taskData.themes) : (taskData.themes || []),
      teams: typeof taskData.teams === 'string' ? JSON.parse(taskData.teams) : (taskData.teams || []),
      images: typeof taskData.images === 'string' ? JSON.parse(taskData.images) : (taskData.images || []),
      assigned_user_id: taskData.assignee_user_id,
    };
  }, [taskData]);


  // Extract property data from task (tasks_view includes property_name and property_address)
  const property = useMemo(() => {
    if (!taskData || !taskData.property_id) return null;
    return {
      id: taskData.property_id,
      nickname: taskData.property_name || null,
      address: taskData.property_address || '',
    };
  }, [taskData]);

  // Initialize status from task - must be before early returns
  useEffect(() => {
    if (task) {
      setStatus((task.status as TaskStatus) || 'pending');
    }
  }, [task]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (loading || orgLoading) {
    return (
      <StandardPageWithBack
        title="Task Details"
        backTo="/tasks"
        icon={<CheckSquare className="h-6 w-6" />}
        maxWidth="md"
      >
        <LoadingState message="Loading task..." />
      </StandardPageWithBack>
    );
  }

  if (!task) {
    return (
      <StandardPageWithBack
        title="Task Details"
        backTo="/tasks"
        icon={<CheckSquare className="h-6 w-6" />}
        maxWidth="md"
      >
        <EmptyState
          icon={CheckSquare}
          title="Task not found"
          description="The task you're looking for doesn't exist"
          action={{
            label: "Go back",
            onClick: () => navigate('/tasks')
          }}
        />
      </StandardPageWithBack>
    );
  }

  const handleStatusChange = (newStatus: TaskStatus) => {
    setStatus(newStatus);
    toast({
      title: "Status updated",
      description: `Task marked as ${newStatus.replace('-', ' ')}`,
    });
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !orgId || !user || !id) {
      return;
    }

    setIsSending(true);

    try {
      // Find or create conversation for this task
      let { data: conversation, error: convError } = await supabase
        .from("conversations")
        .select("id")
        .eq("org_id", orgId)
        .eq("task_id", id)
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
            task_id: id,
            channel: "task",
            subject: `Task ${id}`,
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
  const getPriorityColor = (priority: string) => {
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

  return (
    <StandardPageWithBack
      title={task.title}
      subtitle={property ? property.nickname || property.address : undefined}
      backTo="/tasks"
      icon={<CheckSquare className="h-6 w-6" />}
      maxWidth="md"
    >
      <div className="space-y-6">
        {/* Images Section - Top (like CreateTaskModal) */}
        <div className="space-y-3">
          {/* Primary Image Row - 50% width, icons on right (matches CreateTaskModal) */}
          {task.images && task.images.length > 0 && (
            <>
              <div className="flex gap-3 items-end">
                {/* Primary Image - 50% width */}
                <div className="w-1/2 relative group aspect-square rounded-lg overflow-hidden shadow-e1">
                  <img
                    src={task.images[0]?.thumbnail_url || task.images[0]?.file_url}
                    alt={task.images[0]?.file_name || "Task image"}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const image = task.images[0];
                      if (image?.thumbnail_url && image?.file_url) {
                        (e.target as HTMLImageElement).src = image.file_url;
                      }
                    }}
                  />
                </div>
                {/* Icons placeholder (matching CreateTaskModal layout) */}
                <div className="flex gap-2 items-end">
                  <div className="h-[35px] w-[35px]"></div>
                  <div className="h-[35px] w-[35px]"></div>
                </div>
              </div>

              {/* Additional images grid - Only shows images after the first (no duplicates) */}
              {task.images.length > 1 && (
                <div className="grid grid-cols-3 gap-2">
                  {task.images.slice(1).map((image: any) => (
                    <div
                      key={image.id}
                      className="relative group aspect-square rounded-lg overflow-hidden shadow-e1"
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
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Upload Zone */}
          {!task.images || task.images.length === 0 ? (
            <div className="flex gap-2 justify-end items-end">
              <div className="h-[35px] w-[35px]"></div>
              <div className="h-[35px] w-[35px]"></div>
            </div>
          ) : null}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Upload Images
            </h3>
            <FileUploadZone
              taskId={id!}
              onUploadComplete={() => {
                queryClient.invalidateQueries({ queryKey: queryKeys.task(orgId ?? undefined, id) });
                queryClient.invalidateQueries({ queryKey: queryKeys.taskAttachments(id) });
              }}
              accept="image/*"
            />
          </div>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold leading-tight">{task.title}</h1>
        </div>

        {/* Description */}
        {task.description && (
          <div>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {task.description}
            </p>
          </div>
        )}

        {/* Checklist (Subtasks) */}
        {subtasks && subtasks.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Checklist
            </h3>
            <div className="space-y-2">
              {subtasks.map((subtask) => (
                <div
                  key={subtask.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg",
                    subtask.is_completed || subtask.completed
                      ? "bg-muted/50 text-muted-foreground line-through"
                      : "bg-background"
                  )}
                >
                  <div
                    className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center",
                      subtask.is_completed || subtask.completed
                        ? "bg-primary border-primary"
                        : "border-border"
                    )}
                  >
                    {(subtask.is_completed || subtask.completed) && (
                      <CheckSquare className="h-3 w-3 text-primary-foreground" />
                    )}
                  </div>
                  <span className="flex-1 text-sm">{subtask.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chips: Priority, Status, Deadline */}
        <div className="flex flex-wrap gap-2">
          <Badge className={getPriorityColor(task.priority || 'normal')} variant="secondary">
            {task.priority ? task.priority.toUpperCase() : 'NORMAL'}
          </Badge>
          <Badge className={getStatusColor(status)} variant="secondary">
            {status.replace('_', ' ').toUpperCase()}
          </Badge>
          {task.due_date && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(task.due_date), 'MMM d, yyyy')}
            </Badge>
          )}
        </div>

        {/* Messaging Section - FlyonUI Chat Components */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Updates
          </h3>
          
          {/* Messages List */}
          <div className="space-y-4 max-h-[500px] overflow-y-auto p-4 rounded-lg bg-base-100 border border-border/30">
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
                          <UserIcon className="h-5 w-5 text-muted-foreground" />
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
      </div>
    </StandardPageWithBack>
  );
};

export default TaskDetail;
