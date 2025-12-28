import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Paperclip, Image as ImageIcon, X, FileText, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface ContractorTaskMessagingProps {
  taskId: string;
  contractorToken: string;
}

interface AttachmentPreview {
  file: File;
  preview?: string;
  id: string;
}

interface Message {
  id: string;
  body: string;
  author_name: string | null;
  created_at: string;
}

/**
 * Contractor Task Messaging Component
 * 
 * Allows contractors to send messages and upload files (costing, plans, documents)
 * Does NOT use useActiveOrg - uses contractor token for authentication
 */
export function ContractorTaskMessaging({ taskId, contractorToken }: ContractorTaskMessagingProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);
  const [messageAttachments, setMessageAttachments] = useState<Map<string, any[]>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Fetch messages using RPC or direct query with token validation
  const fetchMessages = async () => {
    if (!taskId || !contractorToken) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // First, find conversation for this task
      // We'll need an RPC function to get conversation with contractor token
      // For now, let's try to get the org_id from the task first
      const { data: taskData } = await supabase
        .rpc("get_task_with_contractor_token", {
          p_task_id: taskId,
          p_token: contractorToken,
        })
        .single();

      if (!taskData) {
        throw new Error("Task not found");
      }

      const orgId = (taskData as any).org_id;

      // Find or create conversation
      let { data: conversation, error: convError } = await supabase
        .from("conversations")
        .select("id")
        .eq("org_id", orgId)
        .eq("task_id", taskId)
        .maybeSingle();

      if (convError && convError.code !== "PGRST116") {
        throw convError;
      }

      let conversationId: string | null = null;

      if (!conversation) {
        // Create conversation if it doesn't exist
        const { data: newConv, error: createError } = await supabase
          .from("conversations")
          .insert({
            org_id: orgId,
            task_id: taskId,
            channel: "contractor",
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

      // Fetch messages
      const { data, error: err } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (err) {
        throw err;
      }

      setMessages((data as Message[]) ?? []);

      // Fetch attachments for messages
      if (data && data.length > 0) {
        const messageIds = data.map((m: any) => m.id);
        const { data: attachData } = await supabase
          .from("attachments")
          .select("*")
          .eq("parent_type", "message")
          .in("parent_id", messageIds);

        if (attachData) {
          const attachmentsMap = new Map<string, any[]>();
          attachData.forEach((attachment) => {
            const messageId = attachment.parent_id;
            if (!attachmentsMap.has(messageId)) {
              attachmentsMap.set(messageId, []);
            }
            attachmentsMap.get(messageId)!.push(attachment);
          });
          setMessageAttachments(attachmentsMap);
        }
      }
    } catch (err: any) {
      console.error("Error fetching messages:", err);
      setError(err.message || "Failed to load messages");
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [taskId, contractorToken]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileSelect = (files: FileList | null, isImage: boolean) => {
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const id = crypto.randomUUID();
      const preview: AttachmentPreview = {
        file,
        id,
      };

      if (isImage && file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setAttachments((prev) => {
            const existing = prev.find((a) => a.id === id);
            if (existing) {
              return prev.map((a) => (a.id === id ? { ...a, preview: reader.result as string } : a));
            }
            return [...prev, { ...preview, preview: reader.result as string }];
          });
        };
        reader.readAsDataURL(file);
      } else {
        setAttachments((prev) => [...prev, preview]);
      }
    });
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSend = async () => {
    if ((!messageText.trim() && attachments.length === 0) || !taskId || !contractorToken) {
      return;
    }

    setIsSending(true);

    try {
      // Get task data to get org_id
      const { data: taskData } = await supabase
        .rpc("get_task_with_contractor_token", {
          p_task_id: taskId,
          p_token: contractorToken,
        })
        .single();

      if (!taskData) {
        throw new Error("Task not found");
      }

      const orgId = (taskData as any).org_id;

      // Find or create conversation
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
            channel: "contractor",
            subject: `Task ${taskId}`,
          } as any)
          .select("id")
          .single();

        if (createError) throw createError;
        conversationId = newConv.id;
      } else {
        conversationId = conversation.id;
      }

      // Create message
      const { data: message, error: insertError } = await supabase
        .from("messages")
        .insert({
          org_id: orgId,
          conversation_id: conversationId,
          author_name: "Contractor",
          body: messageText.trim() || "(File attached)",
          source: "web",
          direction: "inbound",
        } as any)
        .select("id")
        .single();

      if (insertError) {
        throw insertError;
      }

      // Upload attachments
      if (attachments.length > 0 && message) {
        for (const attachment of attachments) {
          try {
            const fileExt = attachment.file.name.split(".").pop();
            const fileName = `org/${orgId}/messages/${message.id}/${crypto.randomUUID()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
              .from("task-images")
              .upload(fileName, attachment.file, {
                cacheControl: "3600",
                upsert: false,
              });

            if (uploadError) {
              console.error("Upload error:", uploadError);
              continue;
            }

            const { data: urlData } = supabase.storage
              .from("task-images")
              .getPublicUrl(fileName);

            await supabase
              .from("attachments")
              .insert({
                org_id: orgId,
                file_url: urlData.publicUrl,
                file_name: attachment.file.name,
                file_type: attachment.file.type,
                file_size: attachment.file.size,
                parent_type: "message",
                parent_id: message.id,
              } as any);
          } catch (err: any) {
            console.error("Error uploading attachment:", err);
          }
        }
      }

      setMessageText("");
      setAttachments([]);
      await fetchMessages();
      toast({
        title: "Message sent",
        description: attachments.length > 0 ? `Sent with ${attachments.length} file${attachments.length > 1 ? 's' : ''}` : "Message sent successfully",
      });
    } catch (err: any) {
      console.error("Error sending message:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            No messages yet. Start the conversation by sending a message.
          </div>
        ) : (
          messages.map((message) => {
            const messageAtts = messageAttachments.get(message.id) || [];
            return (
              <div key={message.id} className="space-y-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 bg-card rounded-lg p-3 shadow-e1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-foreground">
                        {message.author_name || "Unknown"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(message.created_at), "MMM d, h:mm a")}
                      </span>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{message.body}</p>
                    
                    {/* Attachments */}
                    {messageAtts.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {messageAtts.map((att) => (
                          <div key={att.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                            {att.file_type?.startsWith("image/") ? (
                              <ImageIcon className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <FileText className="h-4 w-4 text-muted-foreground" />
                            )}
                            <a
                              href={att.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex-1"
                            >
                              {att.file_name || "Attachment"}
                            </a>
                            <Download className="h-3 w-3 text-muted-foreground" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Attachment Previews */}
      {attachments.length > 0 && (
        <div className="px-4 py-2 border-t border-border">
          <div className="flex flex-wrap gap-2">
            {attachments.map((att) => (
              <div key={att.id} className="relative group">
                {att.preview ? (
                  <div className="relative w-20 h-20 rounded overflow-hidden border border-border">
                    <img src={att.preview} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeAttachment(att.id)}
                      className="absolute top-1 right-1 p-1 bg-background/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded border border-border">
                    <FileText className="h-4 w-4" />
                    <span className="text-xs truncate max-w-[100px]">{att.file.name}</span>
                    <button
                      onClick={() => removeAttachment(att.id)}
                      className="p-1 hover:bg-muted rounded"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-border p-4 space-y-2">
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files, false)}
          />
          <input
            ref={imageInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files, true)}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => imageInputRef.current?.click()}
            className="shrink-0"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
          <Textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Type a message or attach files (costing, plans, documents)..."
            className="flex-1 min-h-[60px] resize-none shadow-engraved"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            onClick={handleSend}
            disabled={isSending || (!messageText.trim() && attachments.length === 0)}
            className="shrink-0"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          You can submit files such as costing, plans, or other documents. All messages and attachments are logged.
        </p>
      </div>
    </div>
  );
}

