/**
 * AssistantPanel — Phase 14 FILLA Assistant Mode
 * Slide-out right panel (Sheet) or embedded body for third-column concertina.
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
  type: "task" | "link" | "filter_tasks";
  payload: unknown;
}

export const CONTEXT_LABELS: Record<NonNullable<AssistantContextType>, string> = {
  property: "Property",
  space: "Space",
  asset: "Asset",
  task: "Task",
  document: "Document",
};

interface AssistantPanelBodyProps {
  context?: AssistantContext | null;
  messages?: AssistantMessage[];
  proposedAction?: ProposedAction | null;
  loading?: boolean;
  onSendMessage?: (query: string) => void;
  onConfirmAction?: () => void;
  onRejectAction?: () => void;
  showContextHeader?: boolean;
  className?: string;
}

/** Body content for embedded use (e.g. inside ThirdColumnConcertina) */
export function AssistantPanelBody({
  context,
  messages = [],
  proposedAction = null,
  loading = false,
  onSendMessage,
  onConfirmAction,
  onRejectAction,
  showContextHeader = true,
  className,
}: AssistantPanelBodyProps) {
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

  const renderMessageContent = (content: string) => {
    const lines = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const taskLinePattern =
      /^(.*?)\s*\|\s*(.*?)\s*\|\s*(?:\[See Details\]\(task:([^)]+)\)|see details\s*\(([^)]+)\)|See Details unavailable)$/i;
    const headingPattern = /^The following tasks/i;
    const suggestionPattern = /^(You can ask:|Need one property only\?|Try:)/i;

    const parsed = lines.map((line) => {
      const taskMatch = line.match(taskLinePattern);
      if (taskMatch) {
        return {
          type: "task" as const,
          raw: line,
          title: taskMatch[1].trim(),
          due: taskMatch[2].trim(),
          taskId: (taskMatch[3] || taskMatch[4] || "").trim(),
        };
      }

      if (headingPattern.test(line)) {
        return { type: "heading" as const, raw: line };
      }

      if (suggestionPattern.test(line)) {
        return { type: "suggestion" as const, raw: line };
      }

      return { type: "text" as const, raw: line };
    });

    const hasTaskRows = parsed.some((item) => item.type === "task");

    return (
      <div className="space-y-2">
        {parsed.map((item, idx) => {
          if (item.type === "heading" && hasTaskRows) {
            return (
              <div key={idx} className="flex items-center gap-2">
                <FillaIcon size={12} className="text-[#EB6834] shrink-0" />
                <p className="text-sm whitespace-pre-wrap">{item.raw}</p>
              </div>
            );
          }

          if (item.type === "task") {
            return (
              <div key={idx} className="text-sm flex flex-wrap items-center gap-1">
                <span>{item.title}</span>
                <span className="text-muted-foreground">|</span>
                <span>{item.due}</span>
                <span className="text-muted-foreground">|</span>
                {item.taskId ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 py-0 text-xs align-middle"
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent("filla:assistant-open-task", {
                          detail: { taskId: item.taskId },
                        })
                      );
                    }}
                  >
                    See Details
                  </Button>
                ) : (
                  <span className="text-muted-foreground text-xs">No details</span>
                )}
              </div>
            );
          }

          if (item.type === "suggestion") {
            return (
              <p
                key={idx}
                className="text-[12px] leading-[1.35] text-[#8F8D8A]"
                style={{ fontFamily: '"Inter Tight", system-ui, sans-serif' }}
              >
                {item.raw}
              </p>
            );
          }

          return (
            <p key={idx} className="text-sm whitespace-pre-wrap">
              {item.raw}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className={cn("flex flex-1 flex-col min-h-0", className)}>
      {showContextHeader && context?.type && context?.name && (
        <div className="px-4 py-3 border-b border-border/20 shrink-0">
          <p className="text-sm text-muted-foreground">
            Context: {CONTEXT_LABELS[context.type]} — {context.name}
          </p>
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-[120px]">
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
            {renderMessageContent(msg.content)}
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
        <div className="px-4 py-3 border-t border-border/20 bg-muted/30 shrink-0">
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
      <div className="px-4 py-4 border-t border-border/20 shrink-0">
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
  );
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

/** Sheet variant — slides from right when third column is not visible */
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

        <AssistantPanelBody
          context={context}
          messages={messages}
          proposedAction={proposedAction}
          loading={loading}
          onSendMessage={onSendMessage}
          onConfirmAction={onConfirmAction}
          onRejectAction={onRejectAction}
          showContextHeader={false}
        />
      </SheetContent>
    </Sheet>
  );
}
