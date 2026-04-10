import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "../integrations/supabase/types";
import { useActiveOrg } from "./useActiveOrg";

type MessageRow = Tables<"messages">;

type ConversationEmbed = {
  property_id: string | null;
  task_id: string | null;
  tasks: { property_id: string | null } | null;
};

export type MessageWithConversation = MessageRow & {
  conversations: ConversationEmbed | null;
};

export type UseMessagesOptions = {
  /**
   * When the workbench focuses a strict subset of properties, only include messages whose
   * conversation is tied to those properties (via `conversations.property_id` or the linked task).
   */
  propertyScope?: {
    selectedIds: string[];
    totalPropertyCount: number;
  };
};

function resolveMessagePropertyId(row: MessageWithConversation): string | null {
  const c = row.conversations;
  if (!c) return null;
  if (c.property_id) return c.property_id;
  const fromTask = c.tasks?.property_id ?? null;
  return fromTask;
}

function shouldApplyPropertyScope(scope: UseMessagesOptions["propertyScope"], totalPropertyCount: number): boolean {
  if (!scope || totalPropertyCount <= 0) return false;
  const { selectedIds } = scope;
  if (selectedIds.length === 0 || selectedIds.length >= totalPropertyCount) return false;
  return true;
}

export function useMessages(options?: UseMessagesOptions) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const scope = options?.propertyScope;
  const scopeActive = shouldApplyPropertyScope(scope, scope?.totalPropertyCount ?? 0);
  const scopeKey = scopeActive
    ? [...(scope?.selectedIds ?? [])].sort().join(",")
    : "all";

  const fetchMessages = async (): Promise<MessageWithConversation[]> => {
    if (!orgId) {
      return [];
    }

    const selectShape = scopeActive
      ? `
          *,
          conversations (
            property_id,
            task_id,
            tasks ( property_id )
          )
        `
      : "*";

    const { data, error: err } = await supabase
      .from("messages")
      .select(selectShape)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (err) {
      throw err;
    }
    return (data ?? []) as MessageWithConversation[];
  };

  const query = useQuery({
    queryKey: ["messages", orgId, scopeKey],
    queryFn: fetchMessages,
    enabled: !orgLoading,
    staleTime: 60_000,
    retry: 1,
  });

  const raw = query.data ?? [];

  const messages = useMemo(() => {
    if (!scopeActive || !scope) return raw as MessageRow[];
    const allowed = new Set(scope.selectedIds);
    return raw.filter((row) => {
      const pid = resolveMessagePropertyId(row);
      return pid != null && allowed.has(pid);
    }) as MessageRow[];
  }, [raw, scope, scopeActive]);

  return {
    messages,
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refresh: async () => {
      await query.refetch();
    },
  };
}
