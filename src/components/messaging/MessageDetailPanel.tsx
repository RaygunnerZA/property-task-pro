import { useState, useEffect, useRef } from "react";
import { X, MoreVertical, MessageSquare, FileText, Clock, User, Send, Download } from "lucide-react";
import { useMessages } from "@/hooks/useMessages";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useDataContext } from "@/contexts/DataContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface MessageDetailPanelProps {
  messageId: string;
  onClose: () => void;
  variant?: "modal" | "column"; // "modal" for mobile overlay, "column" for desktop third column
}

/**
 * Message Detail Panel
 * 
 * Right-side panel for viewing message details and conversation thread
 * - Modal variant: Fixed position, slides in from right (mobile)
 * - Column variant: Renders as third column in grid layout (desktop)
 * - Shows message details, conversation thread, and attachments
 */
export function MessageDetailPanel({ messageId, onClose, variant = "modal" }: MessageDetailPanelProps) {
  const { messages, loading, error, refresh } = useMessages();
  const { orgId } = useActiveOrg();
  const { user, userId } = useDataContext();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("details");
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [messageAttachments, setMessageAttachments] = useState<Map<string, any[]>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Find the selected message
  const selectedMessage = messages.find(m => m.id === messageId);

  // Fetch conversation messages if we have a conversation_id
  const conversationMessages = selectedMessage?.conversation_id
    ? messages.filter(m => m.conversation_id === selectedMessage.conversation_id)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    : selectedMessage ? [selectedMessage] : [];

  // Fetch attachments for messages
  useEffect(() => {
    if (conversationMessages.length === 0) return;

    const fetchAttachments = async () => {
      const messageIds = conversationMessages.map(m => m.id);
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
        const msgId = attachment.parent_id;
        if (!attachmentsMap.has(msgId)) {
          attachmentsMap.set(msgId, []);
        }
        attachmentsMap.get(msgId)!.push(attachment);
      });

      setMessageAttachments(attachmentsMap);
    };

    fetchAttachments();
  }, [conversationMessages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationMessages]);

  const handleSend = async () => {
    if (!messageText.trim() || !selectedMessage?.conversation_id || !orgId || isSending) return;

    setIsSending(true);
    try {
      const { error: sendError } = await supabase
        .from("messages")
        .insert({
          org_id: orgId,
          conversation_id: selectedMessage.conversation_id,
          author_user_id: userId,
          author_name: user?.display_name || user?.email || "Unknown",
          body: messageText.trim(),
          source: "web",
          direction: "outbound",
        });

      if (sendError) throw sendError;

      setMessageText("");
      await refresh();
      toast({
        title: "Message sent",
        description: "Your message has been sent successfully.",
      });
    } catch (err: any) {
      toast({
        title: "Failed to send message",
        description: err.message || "An error occurred while sending the message.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  // Loading state - respects variant
  if (loading) {
    const loadingContent = (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-32 w-full" />
      </div>
    );

    if (variant === "column") {
      return (
        <div className="h-full flex flex-col bg-card">
          {loadingContent}
        </div>
      );
    }

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
          {loadingContent}
        </div>
      </>
    );
  }

  // Error state - respects variant
  if (error || !selectedMessage) {
    const errorContent = (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-destructive mb-4">{error || "Message not found"}</p>
          <button
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        </div>
      </div>
    );

    if (variant === "column") {
      return (
        <div className="h-full flex flex-col bg-card">
          {errorContent}
        </div>
      );
    }

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
          {errorContent}
        </div>
      </>
    );
  }

  // Shared panel content
  const panelContent = (
    <>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border/50 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
            aria-label="Close panel"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Message</h2>
          </div>
          <button
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors opacity-0 pointer-events-none"
            aria-hidden="true"
          >
            <MoreVertical className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Message Metadata */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{selectedMessage.author_name || "Unknown"}</span>
            {selectedMessage.author_role && (
              <span className="text-muted-foreground">• {selectedMessage.author_role}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{format(new Date(selectedMessage.created_at), "MMM d, yyyy 'at' h:mm a")}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-y-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="sticky top-0 z-10 bg-card border-b border-border/50 px-6">
            <TabsList className="w-full grid grid-cols-2 h-12 bg-transparent p-1">
              <TabsTrigger
                value="details"
                className={cn(
                  "rounded-lg data-[state=active]:bg-card",
                  "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]"
                )}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Conversation
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

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden flex flex-col p-6">
            <TabsContent value="details" className="mt-0 flex-1 flex flex-col min-h-0">
              {/* Conversation Thread */}
              <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                {conversationMessages.map((message) => {
                  const isOwnMessage = message.author_user_id === userId;
                  const messageAtts = messageAttachments.get(message.id) || [];

                  return (
                    <div
                      key={message.id}
                      className={cn(
                        "rounded-lg p-3 max-w-[85%]",
                        isOwnMessage
                          ? "bg-primary text-white ml-auto"
                          : "bg-muted text-foreground"
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
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              {selectedMessage.conversation_id && (
                <div className="flex gap-2 pt-4 border-t border-border">
                  <Input
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Type a message..."
                    className="flex-1"
                    disabled={isSending}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!messageText.trim() || isSending}
                    className="shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="attachments" className="mt-0 flex-1 overflow-y-auto">
              <div className="space-y-4">
                {Array.from(messageAttachments.values()).flat().length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No attachments found for this conversation
                  </p>
                ) : (
                  <div className="space-y-2">
                    {Array.from(messageAttachments.entries()).map(([msgId, atts]) => (
                      <div key={msgId} className="space-y-2">
                        {atts.map((attachment) => {
                          const isImage = attachment.file_type?.startsWith("image/");
                          return (
                            <div
                              key={attachment.id}
                              className="p-3 rounded-lg bg-muted border border-border"
                            >
                              <div className="flex items-center gap-2">
                                {isImage ? (
                                  <img
                                    src={attachment.file_url}
                                    alt={attachment.file_name || "Attachment"}
                                    className="h-12 w-12 object-cover rounded"
                                  />
                                ) : (
                                  <FileText className="h-8 w-8 text-muted-foreground" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {attachment.file_name || "Attachment"}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {attachment.file_type || "Unknown type"}
                                  </p>
                                </div>
                                <a
                                  href={attachment.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 hover:bg-background rounded-lg transition-colors"
                                >
                                  <Download className="h-4 w-4" />
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </>
  );

  // Render based on variant
  if (variant === "column") {
    // Column variant: render as regular div (no backdrop, no fixed positioning)
    return (
      <div className="h-full flex flex-col bg-card">
        {panelContent}
      </div>
    );
  }

  // Modal variant: render with backdrop and fixed positioning
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
        {panelContent}
      </div>
    </>
  );
}

