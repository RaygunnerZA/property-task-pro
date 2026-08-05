import { useState, useRef, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTaskMessages } from "@/hooks/useTaskMessages";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useDataContext } from "@/contexts/DataContext";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Upload, Image as ImageIcon, X, FileText, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { toErrorMessage } from "@/lib/error";
import { format } from "date-fns";
import { UserAvatar, TASK_CARD_META_CHIP_SIZE } from "@/components/tasks/UserAvatar";
import {
  memberAccentColor,
  userAvatarUrl,
  userDisplayName,
} from "@/lib/userDisplayHelpers";
import { markTaskCommentSeen } from "@/lib/taskCommentSeen";

interface TaskMessagingProps {
  taskId: string;
  /** Increment to focus the comment composer (e.g. footer Comment action). */
  focusComposeKey?: number;
  /** Lightweight activity-feed layout (no chat bubbles). */
  variant?: "chat" | "activity";
  /** Hide the inline composer (footer Comment scrolls here / focuses separately). */
  hideComposer?: boolean;
}

interface AttachmentPreview {
  file: File;
  preview?: string;
  id: string;
}

function resolveMessageAuthor(
  authorUserId: string | null | undefined,
  authorName: string | null | undefined,
  members: ReturnType<typeof useOrgMembers>["members"],
  currentUser: ReturnType<typeof useDataContext>["user"],
  currentUserId: string | null | undefined
) {
  const id = authorUserId || "";
  const member = id ? members.find((m) => m.user_id === id) : undefined;
  const isSelf = Boolean(id && currentUserId && id === currentUserId);
  const name =
    member?.display_name ||
    member?.nickname ||
    authorName ||
    (isSelf ? userDisplayName(currentUser) : undefined) ||
    "Someone";
  const imageUrl =
    member?.avatar_url || (isSelf ? userAvatarUrl(currentUser) : undefined) || undefined;
  return {
    name,
    imageUrl,
    accentColor: memberAccentColor(id || name),
  };
}

export function TaskMessaging({
  taskId,
  focusComposeKey = 0,
  variant = "chat",
  hideComposer = false,
}: TaskMessagingProps) {
  const { messages, loading, error, refresh } = useTaskMessages(taskId);
  const { orgId } = useActiveOrg();
  const { user, userId } = useDataContext();
  const { members } = useOrgMembers();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);
  const [messageAttachments, setMessageAttachments] = useState<Map<string, any[]>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const composeRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focusComposeKey) return;
    const el = composeRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus();
  }, [focusComposeKey]);

  useEffect(() => {
    if (messages.length === 0) return;

    const fetchAttachments = async () => {
      const messageIds = messages.map((m) => m.id);
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

    void fetchAttachments();
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, attachments.length]);

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

      if (file.type.startsWith("image/")) {
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

    requestAnimationFrame(() => {
      composeRef.current?.focus();
      composeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSend = async () => {
    if (!messageText.trim() && attachments.length === 0) {
      toast({
        title: "Nothing to send",
        description: "Type a message or attach a file.",
      });
      return;
    }
    if (!orgId || !userId) {
      toast({
        title: "Can't send yet",
        description: !orgId
          ? "No active organisation — try refreshing the page."
          : "You're not signed in — sign in and try again.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);

    try {
      const { data: conversation, error: convError } = await supabase
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

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      const authorName = authUser?.email?.split("@")[0] || "User";

      const { data: message, error: insertError } = await supabase
        .from("messages")
        .insert({
          org_id: orgId,
          conversation_id: conversationId,
          author_user_id: userId,
          author_name: authorName,
          body:
            messageText.trim() ||
            (attachments.length > 0
              ? `Sent ${attachments.length} file${attachments.length > 1 ? "s" : ""}`
              : ""),
          source: "web",
          direction: "outbound",
        } as any)
        .select("id")
        .single();

      if (insertError) {
        throw insertError;
      }

      if (attachments.length > 0 && message) {
        const uploadedAttachments = [];

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

            const { data: urlData } = supabase.storage.from("task-images").getPublicUrl(fileName);

            const { error: attachError } = await supabase.from("attachments").insert({
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
            description: `Sent with ${uploadedAttachments.length} attachment${uploadedAttachments.length > 1 ? "s" : ""}`,
          });
        } else if (attachments.length > 0) {
          toast({
            title: "Message saved",
            description: "Your text was saved, but files failed to upload. Try again or pick smaller files.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Message sent",
          description: "Your message was added to this task.",
        });
      }

      setMessageText("");
      setAttachments([]);
      await refresh();
      markTaskCommentSeen(taskId);
      void queryClient.invalidateQueries({ queryKey: ["task-comment-signals", orgId] });
    } catch (err: unknown) {
      console.error("Error sending message:", err);
      toast({
        title: "Error",
        description: toErrorMessage(err, "Failed to send message"),
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const placeholder = useMemo(() => {
    if (attachments.length > 0) {
      return "Add a caption (optional) — press send to upload";
    }
    return "Add a comment… (Enter to send)";
  }, [attachments.length]);

  if (error) {
    return (
      <div className="p-4 text-center text-destructive">
        <p>Error loading messages: {error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={cn("min-h-0 px-0.5", variant === "activity" ? "space-y-4" : "space-y-2.5")}>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          variant === "activity" ? (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          ) : null
        ) : (
          messages.map((message) => {
            const isOwnMessage = message.author_user_id === userId;
            const messageAtts = messageAttachments.get(message.id) || [];
            const author = resolveMessageAuthor(
              message.author_user_id,
              message.author_name,
              members,
              user,
              userId
            );

            if (variant === "activity") {
              return (
                <div key={message.id} className="flex gap-2.5">
                  <UserAvatar
                    imageUrl={author.imageUrl}
                    name={author.name}
                    propertyColor={author.accentColor}
                    size={22}
                    shape="card"
                    className="mt-0.5 !h-[22px] !w-[22px] !min-h-[22px] !min-w-[22px] shrink-0 rounded-[7px]"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-sm font-medium text-foreground">{author.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(message.created_at), "MMM d, HH:mm")}
                      </span>
                    </div>
                    {message.body ? (
                      <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                        {message.body}
                      </p>
                    ) : null}
                    {messageAtts.length > 0 ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {messageAtts.map((attachment) => {
                          const isImage = attachment.file_type?.startsWith("image/");
                          return isImage ? (
                            <a
                              key={attachment.id}
                              href={attachment.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block overflow-hidden rounded-md"
                            >
                              <img
                                src={attachment.file_url}
                                alt={attachment.file_name || "Attachment"}
                                className="h-16 w-16 object-cover"
                              />
                            </a>
                          ) : (
                            <a
                              key={attachment.id}
                              href={attachment.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              {attachment.file_name || "Attachment"}
                            </a>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={message.id}
                className={cn("flex gap-2 max-w-[92%]", isOwnMessage ? "ml-auto flex-row-reverse" : "")}
              >
                <UserAvatar
                  imageUrl={author.imageUrl}
                  name={author.name}
                  propertyColor={author.accentColor}
                  size={TASK_CARD_META_CHIP_SIZE}
                  shape="card"
                  className="mt-0.5 shrink-0"
                />
                <div
                  className={cn(
                    "min-w-0 rounded-lg p-3",
                    isOwnMessage
                      ? "bg-primary text-primary-foreground"
                      : "bg-input text-foreground"
                  )}
                  title={author.name}
                >
                  <div className="mb-1 flex items-center justify-end">
                    <span
                      className={cn(
                        "text-2xs font-mono uppercase tracking-wide",
                        isOwnMessage ? "text-white/70" : "text-muted-foreground"
                      )}
                    >
                      {format(new Date(message.created_at), "HH:mm")}
                    </span>
                  </div>
                  {message.body && (
                    <p className="text-sm whitespace-pre-wrap mb-1">{message.body}</p>
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
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Unified compose box: attach controls stacked top-left; caption below thumbs */}
      {!hideComposer ? (
      <div className="rounded-[12px] bg-background shadow-engraved p-2.5">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFileSelect(e.target.files, true);
            e.target.value = "";
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFileSelect(e.target.files, false);
            e.target.value = "";
          }}
        />

        <div className="flex items-start gap-2">
          <div className="flex shrink-0 flex-col gap-1.5">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="flex h-9 w-9 items-center justify-center rounded-card bg-muted/60 shadow-e1 transition-all hover:shadow-e2"
              aria-label="Attach image"
              title="Attach image"
            >
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-9 w-9 items-center justify-center rounded-card bg-muted/60 shadow-e1 transition-all hover:shadow-e2"
              aria-label="Upload file"
              title="Upload file"
            >
              <Upload className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            {attachments.length > 0 ? (
              <div className="space-y-1.5">
                <p className="font-mono text-2xs uppercase tracking-wide text-muted-foreground px-0.5">
                  Not uploaded yet — press send
                </p>
                <div className="flex flex-wrap gap-2">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="relative overflow-hidden rounded-card shadow-e1"
                    >
                      {attachment.preview ? (
                        <div className="relative h-16 w-16">
                          <img
                            src={attachment.preview}
                            alt={attachment.file.name}
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeAttachment(attachment.id)}
                            className="absolute right-0.5 top-0.5 rounded-full bg-background/90 p-0.5 shadow-e1"
                            aria-label="Remove attachment"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex max-w-[140px] items-center gap-1.5 bg-muted/40 px-2 py-1.5">
                          <FileText className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate text-2xs">{attachment.file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(attachment.id)}
                            className="shrink-0 rounded p-0.5 hover:bg-background"
                            aria-label="Remove attachment"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex items-end gap-1.5">
              <Textarea
                ref={composeRef}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className={cn(
                  "min-h-[4.5rem] flex-1 resize-none border-0 bg-transparent px-1 py-1.5 shadow-none",
                  "focus-visible:ring-0 focus-visible:ring-offset-0"
                )}
                rows={3}
                disabled={isSending}
              />
              <Button
                type="button"
                onClick={() => void handleSend()}
                disabled={(!messageText.trim() && attachments.length === 0) || isSending}
                className="h-8 w-8 shrink-0 rounded-card p-0 shadow-primary-btn"
                size="sm"
                aria-label="Send message"
                title={attachments.length > 0 ? "Send to upload" : "Send"}
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
      ) : null}
    </div>
  );
}
