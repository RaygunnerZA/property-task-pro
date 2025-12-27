import { useState, useRef, useEffect, useMemo } from "react";
import { useTaskMessages } from "@/hooks/useTaskMessages";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

interface ChatThreadProps {
  taskId: string;
}

export function ChatThread({ taskId }: ChatThreadProps) {
  const { messages, loading, error, refresh } = useTaskMessages(taskId);
  const { orgId } = useActiveOrg();
  const { user } = useAuth();
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Build user names map from messages (author_name is stored in message)
  useEffect(() => {
    const namesMap = new Map<string, string>();
    
    messages.forEach((message) => {
      if (message.author_user_id && !namesMap.has(message.author_user_id)) {
        namesMap.set(
          message.author_user_id,
          message.author_name || "User"
        );
      }
    });

    setUserNames(namesMap);
  }, [messages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!messageText.trim() || !orgId || !user) {
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

      // Get user email for author name (stored in message for display)
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const authorName = authUser?.email?.split("@")[0] || "User";

      // Insert message
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
      refresh();
    } catch (err: any) {
      console.error("Error sending message:", err);
      toast.error(err.message || "Failed to send message");
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
    <div
      className={cn(
        "rounded-xl bg-gradient-to-br from-[#F4F3F0] via-[#F2F1ED] to-[#EFEDE9]",
        "shadow-[3px_5px_8px_rgba(174,174,178,0.25),-3px_-3px_6px_rgba(255,255,255,0.7),inset_1px_1px_1px_rgba(255,255,255,0.6)]",
        "flex flex-col h-[400px]"
      )}
    >
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "rounded-lg p-3 max-w-[80%]",
                message.author_user_id === user?.id
                  ? "bg-[#8EC9CE] text-white ml-auto"
                  : "bg-[#F6F4F2] text-foreground"
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-sm font-medium">
                  {message.author_user_id
                    ? userNames.get(message.author_user_id) || message.author_name || "Unknown User"
                    : message.author_name || "Unknown User"}
                </span>
                <span
                  className={cn(
                    "text-xs",
                    message.author_user_id === user?.id
                      ? "text-white/70"
                      : "text-muted-foreground"
                  )}
                >
                  {format(new Date(message.created_at), "HH:mm")}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{message.body}</p>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border/50 p-4">
        <div className="flex gap-2">
          <Textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Press Enter to send)"
            className={cn(
              "flex-1 rounded-xl bg-[#F6F4F2] resize-none",
              "shadow-[inset_2px_2px_4px_rgba(0,0,0,0.08),inset_-2px_-2px_4px_rgba(255,255,255,0.7)]",
              "border-0 focus:ring-2 focus:ring-[#0EA5E9]/30"
            )}
            rows={2}
            disabled={isSending}
          />
          <Button
            onClick={handleSend}
            disabled={!messageText.trim() || isSending}
            className={cn(
              "rounded-xl text-white self-end",
              "shadow-[3px_5px_5px_2px_rgba(0,0,0,0.13),-3px_-3px_5px_0px_rgba(255,255,255,0.48),inset_1px_1px_2px_0px_rgba(255,255,255,0.5),inset_-1px_-2px_2px_0px_rgba(0,0,0,0.27)]",
              "bg-[#FF6B6B] border-0"
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
  );
}

