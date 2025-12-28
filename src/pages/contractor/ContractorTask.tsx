import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LoadingState } from "@/components/design-system/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { CheckSquare, MessageSquare, FileText } from "lucide-react";
import { ContractorTaskMessaging } from "@/components/tasks/ContractorTaskMessaging";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
}

/**
 * Contractor Task View Page
 * 
 * Restricted view for contractors to view and upload evidence for a task
 * - MUST NOT use useActiveOrg
 * - Uses contractor_token from localStorage to authenticate
 * - Shows simplified task view (Title, Description, Upload Evidence)
 * - No Sidebar, No Navigation
 */
export default function ContractorTask() {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ContractorTask.tsx:29',message:'ContractorTask component rendering',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  const params = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const taskId = params.id as string;
  
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contractorToken, setContractorToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("messaging");

  useEffect(() => {
    const fetchTask = async () => {
      // Get token from localStorage
      const token = localStorage.getItem("contractor_token");
      
      if (!token) {
        setError("No access token found. Please use the magic link to access this task.");
        setLoading(false);
        return;
      }

      setContractorToken(token);

      // Verify the token matches the task
      const storedTaskId = localStorage.getItem("contractor_task_id");
      if (storedTaskId !== taskId) {
        setError("Token does not match this task.");
        setLoading(false);
        return;
      }

      try {
        // First, verify the token exists and get task_id
        const { data: tokenData, error: tokenError } = await supabase
          .from("contractor_tokens")
          .select("task_id")
          .eq("token", token)
          .eq("task_id", taskId)
          .single();

        if (tokenError || !tokenData) {
          setError("Invalid or expired token");
          setLoading(false);
          return;
        }

        // Fetch the task using RPC function that validates the token server-side
        const { data: taskData, error: taskError } = await supabase
          .rpc("get_task_with_contractor_token", {
            p_task_id: taskId,
            p_token: token,
          })
          .single();

        if (taskError) {
          console.error("Error fetching task:", taskError);
          setError("Unable to access task. The token may be invalid or expired.");
          setLoading(false);
          return;
        }

        if (!taskData) {
          setError("Task not found");
          setLoading(false);
          return;
        }

        setTask(taskData as Task);
      } catch (err: any) {
        console.error("Error fetching task:", err);
        setError(err.message || "Failed to load task");
      } finally {
        setLoading(false);
      }
    };

    if (taskId) {
      fetchTask();
    }
  }, [taskId]);

  // Fetch attachments for the task
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);

  useEffect(() => {
    const fetchAttachments = async () => {
      if (!task || !contractorToken) return;

      setLoadingAttachments(true);
      try {
        const { data: taskData } = await supabase
          .rpc("get_task_with_contractor_token", {
            p_task_id: taskId,
            p_token: contractorToken,
          })
          .single();

        if (!taskData) return;

        const orgId = (taskData as any).org_id;

        // Fetch attachments linked to this task
        const { data, error } = await supabase
          .from("attachments")
          .select("*")
          .eq("parent_type", "task")
          .eq("parent_id", taskId)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching attachments:", error);
        } else {
          setAttachments(data || []);
        }
      } catch (err) {
        console.error("Error fetching attachments:", err);
      } finally {
        setLoadingAttachments(false);
      }
    };

    if (task && contractorToken) {
      fetchAttachments();
    }
  }, [task, contractorToken, taskId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingState message="Loading task..." />
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <EmptyState
          title={error || "Task not found"}
          subtitle={error || "The task you're looking for doesn't exist"}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Simplified Header - No Navigation */}
      <div className="border-b border-border bg-card shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <CheckSquare className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold text-foreground">Task Details</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Task Title */}
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-2">{task.title}</h2>
            {task.due_date && (
              <p className="text-sm text-muted-foreground">
                Due: {new Date(task.due_date).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Description */}
          {task.description && (
            <div className="bg-card rounded-lg p-6 shadow-e1">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Description
              </h3>
              <p className="text-foreground whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          {/* Tabs: Messaging and Attachments */}
          <div className="bg-card rounded-lg shadow-e1 overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <div className="border-b border-border px-6">
                <TabsList className="w-full grid grid-cols-2 h-12 bg-transparent p-1">
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
                    value="attachments"
                    className={cn(
                      "rounded-lg data-[state=active]:bg-card",
                      "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]"
                    )}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Attachments
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="messaging" className="mt-0 flex-1 flex flex-col min-h-[500px]">
                {contractorToken && (
                  <ContractorTaskMessaging taskId={taskId} contractorToken={contractorToken} />
                )}
              </TabsContent>

              <TabsContent value="attachments" className="mt-0 flex-1 overflow-y-auto p-6">
                {loadingAttachments ? (
                  <div className="flex items-center justify-center py-8">
                    <LoadingState message="Loading attachments..." />
                  </div>
                ) : attachments.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    No attachments yet. Files submitted through messaging will appear here.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border"
                      >
                        <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {att.file_name || "Attachment"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(att.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <a
                          href={att.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline text-sm"
                        >
                          Download
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}

