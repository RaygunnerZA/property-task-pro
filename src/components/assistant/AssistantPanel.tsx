/**
 * AssistantPanel — Phase 14 FILLA Assistant Mode
 * Slide-out right panel with message list, input, context summary, and action confirmation.
 */
import { useRef, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Check, X } from "lucide-react";
import { FillaIcon } from "@/components/filla/FillaIcon";
import { cn } from "@/lib/utils";

export type AssistantContextType = "property" | "space" | "asset" | "task" | "document" | null;

export interface AssistantContext {
  type: AssistantContextType;
  id: string | null;
  name?: string;
}

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ProposedAction {
  type: "task" | "link";
  payload: unknown;
}

interface AssistantPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context?: AssistantContext | null;
  messages?: AssistantMessage[];
  proposedAction?: ProposedAction | null;
  loading?: boolean;
  onSendMessage?: (query: string) => void;
  onConfirmAction?: () => void;
  onRejectAction?: () => void;
}

const CONTEXT_LABELS: Record<NonNullable<AssistantContextType>, string> = {
  property: "Property",
  space: "Space",
  asset: "Asset",
  task: "Task",
  document: "Document",
};

export function AssistantPanel({
  open,
  onOpenChange,
  context,
  messages = [],
  proposedAction = null,
  loading = false,
  onSendMessage,
  onConfirmAction,
  onRejectAction,
}: AssistantPanelProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = () => {
    const value = inputRef.current?.value?.trim();
    if (!value || !onSendMessage) return;
    onSendMessage(value);
    if (inputRef.current) inputRef.current.value = "";
  };

  const canSend = !!onSendMessage && !loading;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="sm:max-w-md flex flex-col p-0"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/20 shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <FillaIcon size={20} className="text-primary" />
            Assistant
          </SheetTitle>
          {context?.type && context?.name && (
            <p className="text-sm text-muted-foreground mt-1">
              Context: {CONTEXT_LABELS[context.type]} — {context.name}
            </p>
          )}
        </SheetHeader>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Message list */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {messages.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Ask a question about this property, asset, compliance, or tasks.
              </p>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-lg p-3 shadow-e1",
                  msg.role === "user"
                    ? "ml-8 bg-primary/10 text-foreground"
                    : "mr-8 bg-card"
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))}
            {loading && (
              <div className="rounded-lg p-3 shadow-e1 mr-8 bg-card animate-pulse">
                <p className="text-sm text-muted-foreground">Thinking...</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Proposed action confirmation */}
          {proposedAction && (
            <div className="px-6 py-3 border-t border-border/20 bg-muted/30 shrink-0">
              <p className="text-sm font-medium mb-2">Execute this action?</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="btn-neomorphic"
                  onClick={onConfirmAction}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onRejectAction}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="px-6 py-4 border-t border-border/20 shrink-0">
            <div className="flex gap-2">
              <Textarea
                ref={inputRef}
                placeholder="Ask a question..."
                className="min-h-[80px] resize-none shadow-engraved"
                disabled={!canSend}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
              <Button
                size="icon"
                className="shrink-0 btn-neomorphic h-[80px] w-12"
                onClick={handleSubmit}
                disabled={!canSend}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
