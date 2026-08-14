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
import { Send, Loader2, Upload, Image as ImageIcon, X, FileText, Download, MoreHorizontal, Reply, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toErrorMessage } from "@/lib/error";
import { format } from "date-fns";
import { UserAvatar, APP_USER_AVATAR_SIZE } from "@/components/tasks/UserAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  memberAccentColor,
  userAvatarUrl,
  userDisplayName,
} from "@/lib/userDisplayHelpers";
import { markTaskCommentSeen } from "@/lib/taskCommentSeen";
import { clipboardImageFiles, fileDropBind } from "@/utils/ingestIntakeMediaFiles";
import {
  buildReplyPayload,
  firstThreeLines,
  parseMessageReplyTo,
  type MessageReplyTo,
} from "@/lib/taskMessageReply";

const ENTER_SEND_HINT_KEY = "filla_task_message_enter_send_known";

function readEnterSendKnown(): boolean {
  try {
    return window.localStorage.getItem(ENTER_SEND_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

function markEnterSendKnown(): void {
  try {
    window.localStorage.setItem(ENTER_SEND_HINT_KEY, "1");
  } catch {
    /* ignore */
  }
}

interface TaskMessagingProps {
  taskId: string;
  /** Increment to focus the comment composer (e.g. footer Comment action). */
  focusComposeKey?: number;
  /**
   * `chat` — staggered conversation + composer (above action bar).
   * `activity` — read-only compact lines (legacy; prefer timeline merge).
   */
  variant?: "chat" | "activity";
  /** Hide the inline composer. */
  hideComposer?: boolean;
  /** Fired when compose draft has text or attachments (or clears). */
  onDraftChange?: (hasDraft: boolean) => void;
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
  onDraftChange,
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
  const [showEnterHint, setShowEnterHint] = useState(true);
  const [replyTo, setReplyTo] = useState<MessageReplyTo | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const composeRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setShowEnterHint(!readEnterSendKnown());
  }, []);

  useEffect(() => {
    onDraftChange?.(Boolean(messageText.trim() || attachments.length > 0));
  }, [messageText, attachments.length, onDraftChange]);

  useEffect(() => {
    if (!focusComposeKey) return;
    const el = composeRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    el.focus({ preventScroll: true });
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
    if (variant === "activity") return;
    const end = messagesEndRef.current;
    if (!end || messages.length === 0) return;
    const scroller = end.closest("[data-messages-scroller]") as HTMLElement | null;
    if (scroller) {
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
      return;
    }
    end.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [messages, attachments.length, variant]);

  const handleFileSelect = (files: FileList | File[] | null, isImage: boolean) => {
    if (!files) return;
    const list = Array.isArray(files) ? files : Array.from(files);
    if (list.length === 0) return;

    list.forEach((file) => {
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
      composeRef.current?.focus({ preventScroll: true });
    });
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const images = clipboardImageFiles(e.clipboardData);
    if (images.length === 0) return;
    e.preventDefault();
    handleFileSelect(images, true);
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSend = async (opts?: { viaEnter?: boolean }) => {
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
          raw_payload: replyTo ? buildReplyPayload(replyTo) : null,
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

      if (opts?.viaEnter) {
        markEnterSendKnown();
        setShowEnterHint(false);
      }

      setMessageText("");
      setAttachments([]);
      setReplyTo(null);
      await refresh();
      markTaskCommentSeen(taskId);
      void queryClient.invalidateQueries({ queryKey: ["task-comment-signals", orgId] });
      void queryClient.invalidateQueries({ queryKey: ["task-comment-count", taskId] });
      void queryClient.invalidateQueries({ queryKey: ["task-audit-log", orgId, taskId] });
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

  const beginReply = (target: MessageReplyTo) => {
    setReplyTo(target);
    requestAnimationFrame(() => {
      const el = composeRef.current;
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      el.focus({ preventScroll: true });
    });
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!userId) return;
    try {
      await supabase.from("attachments").delete().eq("parent_type", "message").eq("parent_id", messageId);
      const { error: delError } = await supabase
        .from("messages")
        .delete()
        .eq("id", messageId)
        .eq("author_user_id", userId);

      if (delError) throw delError;

      if (replyTo?.id === messageId) setReplyTo(null);
      toast({ title: "Message deleted" });
      await refresh();
      void queryClient.invalidateQueries({ queryKey: ["task-comment-signals", orgId] });
      void queryClient.invalidateQueries({ queryKey: ["task-comment-count", taskId] });
      void queryClient.invalidateQueries({ queryKey: ["task-audit-log", orgId, taskId] });
    } catch (err: unknown) {
      toast({
        title: "Couldn't delete",
        description: toErrorMessage(err, "You can only delete your own messages."),
        variant: "destructive",
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend({ viaEnter: true });
    }
  };

  const placeholder = useMemo(() => {
    if (attachments.length > 0) {
      return "Add a caption (optional)";
    }
    if (replyTo) return "Write a reply…";
    return "Write a message…";
  }, [attachments.length, replyTo]);

  if (error) {
    return (
      <div className="p-4 text-center text-destructive">
        <p>Error loading messages: {error}</p>
      </div>
    );
  }

  if (variant === "activity") {
    return (
      <div className="space-y-1.5 px-0.5">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : messages.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No messages recorded.</p>
        ) : (
          messages.map((message) => {
            const author = resolveMessageAuthor(
              message.author_user_id,
              message.author_name,
              members,
              user,
              userId
            );
            const preview = (message.body || "Attachment").trim().slice(0, 72);
            return (
              <p key={message.id} className="text-[11px] leading-snug text-muted-foreground">
                <span className="tabular-nums text-muted-foreground/80">
                  {format(new Date(message.created_at), "d MMM HH:mm")}
                </span>
                {" · Message · "}
                <span className="text-muted-foreground/90">{preview}</span>
                {preview.length >= 72 ? "…" : ""}
                {" · "}
                {author.name}
              </p>
            );
          })
        )}
      </div>
    );
  }

  return (
    <div
      id="task-detail-comment"
      className="flex flex-col gap-2.5"
      {...(hideComposer ? {} : fileDropBind((files) => handleFileSelect(files, false)))}
    >
      <div
        data-messages-scroller
        className={cn(
          "min-h-0 space-y-3 px-0.5",
          messages.length === 0 && !loading && "hidden"
        )}
      >
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
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
            const sentAt = format(new Date(message.created_at), "d MMM · HH:mm");
            const quoted = parseMessageReplyTo(message.raw_payload);
            const moreMenu = (
              <MessageMoreMenu
                canDelete={isOwnMessage}
                onReply={() =>
                  beginReply({
                    id: message.id,
                    author_name: author.name,
                    excerpt: firstThreeLines(message.body || ""),
                  })
                }
                onDelete={() => void handleDeleteMessage(message.id)}
              />
            );

            return (
              <div
                key={message.id}
                className={cn(
                  "group flex w-full min-w-0 items-start gap-2",
                  isOwnMessage && "flex-row-reverse"
                )}
              >
                <div
                  className={cn(
                    "flex w-8 shrink-0 flex-col items-center",
                    isOwnMessage && "gap-1"
                  )}
                >
                  <UserAvatar
                    imageUrl={author.imageUrl}
                    name={author.name}
                    propertyColor={author.accentColor}
                    size={APP_USER_AVATAR_SIZE}
                    shape="card"
                    className="mt-0.5 shrink-0"
                  />
                  {isOwnMessage ? moreMenu : null}
                </div>
                <div
                  className={cn(
                    "min-w-0 max-w-[min(92%,calc(100%-5.5rem))] space-y-1",
                    isOwnMessage ? "items-end text-right" : "items-start text-left"
                  )}
                >
                  <p
                    className={cn(
                      "text-2xs tabular-nums text-muted-foreground/70",
                      isOwnMessage ? "text-right" : "text-left"
                    )}
                  >
                    <span className="font-medium text-muted-foreground/85">{author.name}</span>
                    {" · "}
                    {sentAt}
                  </p>
                  <div
                    className={cn(
                      "flex items-start gap-2",
                      isOwnMessage && "justify-end"
                    )}
                  >
                  <div
                    className={cn(
                      "min-w-0 rounded-[10px] px-3 py-2 text-left shadow-e1",
                      isOwnMessage
                        ? "bg-primary text-primary-foreground"
                        : "bg-input text-foreground"
                    )}
                  >
                    {quoted ? (
                      <MessageQuote
                        authorName={quoted.author_name}
                        excerpt={quoted.excerpt}
                        tone={isOwnMessage ? "own" : "other"}
                      />
                    ) : null}
                    {message.body ? (
                      <p
                        className={cn(
                          "text-sm whitespace-pre-wrap leading-relaxed",
                          quoted && "mt-1.5"
                        )}
                      >
                        {message.body}
                      </p>
                    ) : null}
                    {messageAtts.length > 0 ? (
                      <div className={cn("space-y-2", (message.body || quoted) && "mt-2")}>
                        {messageAtts.map((attachment) => {
                          const isImage = attachment.file_type?.startsWith("image/");
                          return (
                            <div
                              key={attachment.id}
                              className={cn(
                                "overflow-hidden rounded-md",
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
                                    className="max-h-40 max-w-full object-contain"
                                  />
                                </a>
                              ) : (
                                <a
                                  href={attachment.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 p-2 transition-opacity hover:opacity-80"
                                >
                                  <FileText className="h-4 w-4 shrink-0" />
                                  <span className="min-w-0 flex-1 truncate text-xs">
                                    {attachment.file_name || "Attachment"}
                                  </span>
                                  <Download className="h-3 w-3 shrink-0" />
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                  {!isOwnMessage ? (
                    <div className="shrink-0">{moreMenu}</div>
                  ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {!hideComposer ? (
        <div className="rounded-[12px] bg-input p-2.5 shadow-engraved">
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

            <div className="min-w-0 flex-1 space-y-1.5">
              {replyTo ? (
                <div className="relative pr-6">
                  <MessageQuote
                    authorName={replyTo.author_name}
                    excerpt={replyTo.excerpt}
                    tone="composer"
                  />
                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    className="absolute right-0 top-1 rounded p-0.5 text-muted-foreground hover:bg-background/80 hover:text-foreground"
                    aria-label="Cancel reply"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}

              {attachments.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="relative overflow-hidden rounded-card shadow-e1"
                    >
                      {attachment.preview ? (
                        <div className="relative h-14 w-14">
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
              ) : null}

              <div className="flex items-start gap-1.5">
                <Textarea
                  ref={composeRef}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
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
                  className="h-8 shrink-0 gap-1.5 rounded-card px-2.5 shadow-primary-btn sm:px-3"
                  size="sm"
                  aria-label="Send message"
                  title="Send"
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span className="hidden text-sm font-semibold sm:inline">Send</span>
                    </>
                  )}
                </Button>
              </div>

              {showEnterHint ? (
                <p className="px-0.5 text-2xs text-muted-foreground/45">(Enter to send)</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MessageQuote({
  authorName,
  excerpt,
  tone,
}: {
  authorName: string;
  excerpt: string;
  tone: "own" | "other" | "composer";
}) {
  return (
    <div
      className={cn(
        "rounded-md border-l-2 px-2 py-1.5",
        tone === "own" && "border-primary-foreground/45 bg-black/10 text-primary-foreground/90",
        tone === "other" && "border-primary/70 bg-background/60 text-muted-foreground",
        tone === "composer" && "border-primary/70 bg-muted/50 text-muted-foreground shadow-engraved"
      )}
    >
      <p className="text-2xs font-medium opacity-80">{authorName}</p>
      <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-xs leading-snug opacity-90">
        {excerpt || "Attachment"}
      </p>
    </div>
  );
}

function MessageMoreMenu({
  canDelete,
  onReply,
  onDelete,
}: {
  canDelete: boolean;
  onReply: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Message actions"
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-card text-muted-foreground",
            "opacity-0 transition-opacity duration-150",
            "hover:bg-muted/60 hover:shadow-e1",
            "group-hover:opacity-100 group-focus-within:opacity-100",
            "data-[state=open]:opacity-100 data-[state=open]:bg-muted/60",
            "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "[@media(hover:none)]:opacity-100"
          )}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="bottom"
        className="z-[130] min-w-[10.5rem] border-0 bg-card shadow-e2 data-[state=closed]:animate-none"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DropdownMenuItem className="gap-2 text-sm" onSelect={onReply}>
          <Reply className="h-4 w-4" />
          Reply
        </DropdownMenuItem>
        {canDelete ? (
          <DropdownMenuItem
            className="gap-2 text-sm text-destructive focus:text-destructive"
            onSelect={onDelete}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
