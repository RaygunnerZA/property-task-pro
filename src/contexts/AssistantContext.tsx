/* @refresh reset */
/**
 * AssistantContext — Phase 14 FILLA Assistant Mode
 * Global state for Assistant panel open/close and context.
 * When third column is visible, AssistantPanel renders null (concertina owns it).
 */
import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { AssistantPanel, type AssistantContext as AssistantContextType } from "@/components/assistant/AssistantPanel";
import { useAssistant } from "@/hooks/useAssistant";
import { useThirdColumn } from "@/contexts/ThirdColumnContext";

interface AssistantContextValue {
  openAssistant: (context?: AssistantContextType | null) => void;
  closeAssistant: () => void;
  isOpen: boolean;
  /** For concertina: assistant context, messages, loading, and handlers */
  assistantContext: AssistantContextType | null;
  messages: import("@/components/assistant/AssistantPanel").AssistantMessage[];
  proposedAction: import("@/components/assistant/AssistantPanel").ProposedAction | null;
  loading: boolean;
  onSendMessage: (query: string) => void;
  onConfirmAction: () => void;
  onRejectAction: () => void;
}

const AssistantContext = createContext<AssistantContextValue | null>(null);

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [context, setContext] = useState<AssistantContextType | null>(null);
  const assistant = useAssistant();
  const hasThirdColumn = useThirdColumn();

  const openAssistant = useCallback((ctx?: AssistantContextType | null) => {
    setContext(ctx ?? null);
    setIsOpen(true);
  }, []);

  const closeAssistant = useCallback(() => {
    setIsOpen(false);
  }, []);

  const onSendMessage = useCallback(
    (query: string) => assistant.sendMessage(query, context ? { type: context.type, id: context.id } : null),
    [assistant.sendMessage, context]
  );

  // When third column is visible, concertina renders AssistantPanelBody; don't show Sheet
  const showSheet = !hasThirdColumn;

  const value: AssistantContextValue = {
    openAssistant,
    closeAssistant,
    isOpen,
    assistantContext: context,
    messages: assistant.messages,
    proposedAction: assistant.proposedAction,
    loading: assistant.loading,
    onSendMessage,
    onConfirmAction: assistant.confirmAction,
    onRejectAction: assistant.rejectAction,
  };

  return (
    <AssistantContext.Provider value={value}>
      {children}
      {showSheet && (
        <AssistantPanel
          open={isOpen}
          onOpenChange={(open) => !open && closeAssistant()}
          context={context}
          messages={assistant.messages}
          proposedAction={assistant.proposedAction}
          loading={assistant.loading}
          onSendMessage={onSendMessage}
          onConfirmAction={assistant.confirmAction}
          onRejectAction={assistant.rejectAction}
        />
      )}
    </AssistantContext.Provider>
  );
}

export function useAssistantContext() {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error("useAssistantContext must be used within AssistantProvider");
  return ctx;
}
