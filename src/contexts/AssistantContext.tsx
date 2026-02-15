/**
 * AssistantContext — Phase 14 FILLA Assistant Mode
 * Global state for Assistant panel open/close and context.
 */
import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { AssistantPanel, type AssistantContext as AssistantContextType } from "@/components/assistant/AssistantPanel";
import { useAssistant } from "@/hooks/useAssistant";

interface AssistantContextValue {
  openAssistant: (context?: AssistantContextType | null) => void;
  closeAssistant: () => void;
  isOpen: boolean;
}

const AssistantContext = createContext<AssistantContextValue | null>(null);

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [context, setContext] = useState<AssistantContextType | null>(null);
  const assistant = useAssistant();

  const openAssistant = useCallback((ctx?: AssistantContextType | null) => {
    setContext(ctx ?? null);
    setIsOpen(true);
  }, []);

  const closeAssistant = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <AssistantContext.Provider value={{ openAssistant, closeAssistant, isOpen }}>
      {children}
      <AssistantPanel
        open={isOpen}
        onOpenChange={(open) => !open && closeAssistant()}
        context={context}
        messages={assistant.messages}
        proposedAction={assistant.proposedAction}
        loading={assistant.loading}
        onSendMessage={(query) => assistant.sendMessage(query, context ? { type: context.type, id: context.id } : null)}
        onConfirmAction={assistant.confirmAction}
        onRejectAction={assistant.rejectAction}
      />
    </AssistantContext.Provider>
  );
}

export function useAssistantContext() {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error("useAssistantContext must be used within AssistantProvider");
  return ctx;
}
