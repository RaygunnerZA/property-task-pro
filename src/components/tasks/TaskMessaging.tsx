import { useState, useRef, useEffect } from "react";
import { useTaskMessages } from "@/hooks/useTaskMessages";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useDataContext } from "@/contexts/DataContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Paperclip, Image as ImageIcon, X, FileText, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface TaskMessagingProps {
  taskId: string;
}

interface AttachmentPreview {
  file: File;
  preview?: string;
  id: string;
}

export function TaskMessaging({ taskId }: TaskMessagingProps) {
  const { messages, loading, error, refresh } = useTaskMessages(taskId);
  const { orgId } = useActiveOrg();
  const { user, userId } = useDataContext();
  const { toast } = useToast();
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);
  const [messageAttachments, setMessageAttachments] = useState<Map<string, any[]>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Fetch attachments for messages
  useEffect(() => {
    if (messages.length === 0) return;

    const fetchAttachments = async () => {
      const messageIds = messages.map(m => m.id);
      const { data, error: attachError } = await supabase
        .from("attachments")
        .select("*")
        .eq("parent_type", "message")
        .in("parent_id", messageIds);

      if (attachError) {
        console.error("Error fetching attachments:", attachError);
        return;
      }

      const attachmentsMap = new Map<string, any[]>();
      (data || []).forEach((attachment) => {
        const messageId = attachment.parent_id;
        if (!attachmentsMap.has(messageId)) {
          attachmentsMap.set(messageId, []);
        }
        attachmentsMap.get(messageId)!.push(attachment);
      });

      setMessageAttachments(attachmentsMap);
    };

    fetchAttachments();
  }, [messages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileSelect = (files: FileList | null, isImage: boolean) => {
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (isImage && !file.type.startsWith("image/")) {
        toast({
          title: "Invalid file type",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }

      const attachmentId = crypto.randomUUID();
      const preview: AttachmentPreview = {
        file,
        id: attachmentId,
      };

      if (isImage) {
        const reader = new FileReader();
        reader.onload = (e) => {
          preview.preview = e.target?.result as string;
          setAttachments((prev) => [...prev, preview]);
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
    if ((!messageText.trim() && attachments.length === 0) || !orgId || !userId) {
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
        // Create conversation if it doesn't exist
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

      // Get user email for author name
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const authorName = authUser?.email?.split("@")[0] || "User";

      // Insert message (even if empty, to attach files)
      const { data: message, error: insertError } = await supabase
        .from("messages")
        .insert({
          org_id: orgId,
          conversation_id: conversationId,
          author_user_id: userId,
          author_name: authorName,
          body: messageText.trim() || (attachments.length > 0 ? `Sent ${attachments.length} file${attachments.length > 1 ? 's' : ''}` : ""),
          source: "web",
          direction: "outbound",
        } as any)
        .select("id")
        .single();

      if (insertError) {
        throw insertError;
      }

      // Upload attachments
      if (attachments.length > 0 && message) {
        const uploadedAttachments = [];

        for (const attachment of attachments) {
          try {
            // Upload to storage
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

            // Get public URL
            const { data: urlData } = supabase.storage
              .from("task-images")
              .getPublicUrl(fileName);

            // Create attachment record
            const { error: attachError } = await supabase
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

            if (attachError) {
              console.error("Attachment insert error:", attachError);
            } else {
              uploadedAttachments.push(attachment.file.name);
            }
          } catch (err: any) {
            console.error("Error uploading attachment:", err);
          }
        }

        if (uploadedAttachments.length > 0) {
          toast({
            title: "Message sent",
            description: `Sent with ${uploadedAttachments.length} attachment${uploadedAttachments.length > 1 ? 's' : ''}`,
          });
        }
      }

      setMessageText("");
      setAttachments([]);
      refresh();
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (error) {
    return (
      <div className="p-4 text-center text-destructive">
        <p>Error loading messages: {error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-sm">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwnMessage = message.author_user_id === userId;
            const messageAtts = messageAttachments.get(message.id) || [];

            return (
              <div
                key={message.id}
                className={cn(
                  "rounded-lg p-3 max-w-[85%]",
                  isOwnMessage
                    ? "bg-[#8EC9CE] text-white ml-auto"
                    : "bg-[#F6F4F2] text-foreground"
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-sm font-medium">
                    {message.author_name || "Unknown User"}
                  </span>
                  <span
                    className={cn(
                      "text-xs",
                      isOwnMessage ? "text-white/70" : "text-muted-foreground"
                    )}
                  >
                    {format(new Date(message.created_at), "HH:mm")}
                  </span>
                </div>
                {message.body && (
                  <p className="text-sm whitespace-pre-wrap mb-2">{message.body}</p>
                )}
                {messageAtts.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {messageAtts.map((attachment) => {
                      const isImage = attachment.file_type?.startsWith("image/");
                      return (
                        <div
                          key={attachment.id}
                          className={cn(
                            "rounded-md overflow-hidden",
                            isOwnMessage ? "bg-white/20" : "bg-background/50"
                          )}
                        >
                          {isImage ? (
                            <a
                              href={attachment.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block"
                            >
                              <img
                                src={attachment.file_url}
                                alt={attachment.file_name || "Attachment"}
                                className="max-w-full h-auto max-h-48 object-contain"
                              />
                            </a>
                          ) : (
                            <a
                              href={attachment.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 p-2 hover:opacity-80 transition-opacity"
                            >
                              <FileText className="h-4 w-4 flex-shrink-0" />
                              <span className="text-xs truncate flex-1">
                                {attachment.file_name || "Attachment"}
                              </span>
                              <Download className="h-3 w-3 flex-shrink-0" />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Attachment Previews */}
      {attachments.length > 0 && (
        <div className="border-t border-border/50 p-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="relative rounded-md overflow-hidden border border-border"
              >
                {attachment.preview ? (
                  <div className="relative">
                    <img
                      src={attachment.preview}
                      alt={attachment.file.name}
                      className="h-20 w-20 object-cover"
                    />
                    <button
                      onClick={() => removeAttachment(attachment.id)}
                      className="absolute top-1 right-1 p-1 bg-background/80 rounded-full hover:bg-background"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-background/50">
                    <FileText className="h-4 w-4" />
                    <span className="text-xs truncate max-w-[100px]">
                      {attachment.file.name}
                    </span>
                    <button
                      onClick={() => removeAttachment(attachment.id)}
                      className="p-1 hover:bg-background rounded"
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
      <div className="border-t border-border/50 p-4">
        <div className="flex gap-2">
          <div className="flex gap-1">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files, true)}
            />
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files, false)}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => imageInputRef.current?.click()}
              className="h-8 w-8 p-0"
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-8 w-8 p-0"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
          </div>
          <Textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Press Enter to send)"
            className={cn(
              "flex-1 rounded-lg bg-background resize-none",
              "shadow-engraved border-0",
              "focus:ring-2 focus:ring-primary/30"
            )}
            rows={2}
            disabled={isSending}
          />
          <Button
            onClick={handleSend}
            disabled={(!messageText.trim() && attachments.length === 0) || isSending}
            className={cn(
              "rounded-lg text-white self-end",
              "bg-[#8EC9CE] hover:bg-[#7AB8BD]",
              "shadow-primary-btn"
            )}
            size="sm"
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
  );
}

