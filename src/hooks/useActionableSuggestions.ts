import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useAuth } from "@/hooks/useAuth";
import { useCompliancePortfolioQuery } from "@/hooks/useCompliancePortfolioQuery";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useSignalsQuery } from "@/hooks/useSignalsQuery";
import { useSignalActions } from "@/hooks/useSignalActions";
import {
  compileActionableSuggestions,
  signalsForCompiler,
  suggestionFingerprint,
  toSuggestionDocuments,
  toSuggestionTasks,
} from "@/lib/signals/compileActionableSuggestions";
import { ACCESS_PATTERN, VISIT_PATTERN } from "@/lib/signals/suggestionMatching";
import {
  readSuggestionUserState,
  upsertSuggestionUserState,
} from "@/lib/signals/suggestionUserState";
import { performSuggestionPrimaryAction } from "@/lib/signals/performSuggestionAction";
import type { ActionableSuggestion } from "@/lib/signals/actionableSuggestionTypes";

const TERMINAL = new Set(["completed", "archived", "done"]);

type ExtraTaskRow = {
  id: string;
  assigned_user_id: string | null;
  assigned_vendor_name: string | null;
  is_compliance: boolean | null;
  type: string | null;
  completed_at: string | null;
  status: string | null;
  description: string | null;
};

export function useActionableSuggestions(options?: {
  tasks?: Array<Record<string, unknown>>;
  propertyIds?: string[];
  enabled?: boolean;
}) {
  const navigate = useNavigate();
  const { orgId, role, assignedProperties } = useActiveOrg();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const propertyIds = options?.propertyIds;
  const enabled = options?.enabled ?? true;
  const tasks = options?.tasks ?? [];
  const { dismiss, snooze } = useSignalActions();

  const [userState, setUserState] = useState(() => readSuggestionUserState(orgId));

  const scopedPropertyIds = useMemo(
    () => (propertyIds && propertyIds.length > 0 ? new Set(propertyIds) : undefined),
    [propertyIds]
  );

  const taskIds = useMemo(
    () => tasks.map((task) => String(task.id ?? "")).filter(Boolean),
    [tasks]
  );

  const { data: platformSignals = [] } = useSignalsQuery({
    propertyIds,
    enabled,
  });
  const { data: compliancePortfolio = [] } = useCompliancePortfolioQuery();
  const { members = [] } = useOrgMembers();

  const { data: extraTasks = [] } = useQuery({
    queryKey: ["suggestion-task-extras", orgId, taskIds.join(",")],
    enabled: enabled && !!orgId && taskIds.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<ExtraTaskRow[]> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, assigned_user_id, assigned_vendor_name, is_compliance, type, completed_at, status, description")
        .eq("org_id", orgId!)
        .in("id", taskIds);
      if (error) throw error;
      return (data ?? []) as ExtraTaskRow[];
    },
  });

  const { data: taskAssetLinks = [] } = useQuery({
    queryKey: ["suggestion-task-assets", orgId, taskIds.join(",")],
    enabled: enabled && !!orgId && taskIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            in: (col: string, ids: string[]) => Promise<{ data: Array<{ task_id: string; asset_id: string }> | null; error: { code?: string } | null }>;
          };
        };
      })
        .from("task_assets")
        .select("task_id, asset_id")
        .in("task_id", taskIds);
      if (error) {
        if (error.code === "42P01") return [];
        throw error;
      }
      return (data ?? []).map((row) => ({
        taskId: String(row.task_id),
        assetId: String(row.asset_id),
      }));
    },
  });

  const assetIds = useMemo(
    () => [...new Set(taskAssetLinks.map((link) => link.assetId))],
    [taskAssetLinks]
  );

  const { data: assets = [] } = useQuery({
    queryKey: ["suggestion-assets", orgId, assetIds.join(",")],
    enabled: enabled && !!orgId && assetIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("id, name, property_id")
        .eq("org_id", orgId!)
        .in("id", assetIds);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        property_id: row.property_id,
      }));
    },
  });

  const messageCandidateIds = useMemo(() => {
    const extras = new Map(extraTasks.map((row) => [row.id, row]));
    return tasks
      .filter((task) => {
        const extra = extras.get(String(task.id));
        const text = `${task.title ?? ""} ${task.description ?? ""} ${extra?.description ?? ""} ${extra?.assigned_vendor_name ?? ""}`;
        const status = String(extra?.status ?? task.status ?? "").toLowerCase();
        return (
          !TERMINAL.has(status) &&
          (ACCESS_PATTERN.test(text) || VISIT_PATTERN.test(text) || Boolean(extra?.assigned_vendor_name))
        );
      })
      .map((task) => String(task.id));
  }, [tasks, extraTasks]);

  const { data: messagesByTaskId = {} } = useQuery({
    queryKey: ["suggestion-task-messages", orgId, messageCandidateIds.join(",")],
    enabled: enabled && !!orgId && messageCandidateIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: conversations, error: convError } = await supabase
        .from("conversations")
        .select("id, task_id")
        .eq("org_id", orgId!)
        .in("task_id", messageCandidateIds);
      if (convError) throw convError;
      const convIds = (conversations ?? []).map((row) => row.id);
      if (convIds.length === 0) return {};
      const { data: messages, error: msgError } = await supabase
        .from("messages")
        .select("body, created_at, conversation_id, direction, source")
        .eq("org_id", orgId!)
        .in("conversation_id", convIds)
        .order("created_at", { ascending: false })
        .limit(200);
      if (msgError) throw msgError;
      const taskByConv = new Map(
        (conversations ?? []).map((row) => [row.id, row.task_id as string | null])
      );
      const grouped: Record<
        string,
        { taskId: string; body: string; createdAt: string; direction?: string | null; source?: string | null }[]
      > = {};
      for (const message of messages ?? []) {
        const taskId = taskByConv.get(message.conversation_id);
        if (!taskId) continue;
        const list = grouped[taskId] ?? [];
        list.push({
          taskId,
          body: message.body,
          createdAt: message.created_at ?? "",
          direction: message.direction,
          source: message.source,
        });
        grouped[taskId] = list;
      }
      return grouped;
    },
  });

  const mergedTasks = useMemo(() => {
    const extras = new Map(extraTasks.map((row) => [row.id, row]));
    const assetIdsByTask = new Map<string, string[]>();
    for (const link of taskAssetLinks) {
      const list = assetIdsByTask.get(link.taskId) ?? [];
      list.push(link.assetId);
      assetIdsByTask.set(link.taskId, list);
    }
    return toSuggestionTasks(
      tasks.map((task) => {
        const extra = extras.get(String(task.id));
        return {
          ...task,
          assigned_user_id: extra?.assigned_user_id ?? task.assigned_user_id,
          assigned_vendor_name: extra?.assigned_vendor_name ?? task.assigned_vendor_name,
          is_compliance: extra?.is_compliance ?? task.is_compliance,
          type: extra?.type ?? task.type,
          completed_at: extra?.completed_at ?? task.completed_at,
          description: extra?.description ?? task.description,
          asset_ids: assetIdsByTask.get(String(task.id)) ?? task.asset_ids,
        };
      })
    );
  }, [tasks, extraTasks, taskAssetLinks]);

  const membersByUserId = useMemo(() => {
    return Object.fromEntries(
      members.map((member) => [member.user_id, { name: member.display_name, role: member.role }])
    );
  }, [members]);

  const suggestions = useMemo(() => {
    if (!enabled) return [] as ActionableSuggestion[];
    return compileActionableSuggestions({
      now: new Date(),
      currentUserId: userId,
      role,
      assignedPropertyIds: assignedProperties,
      scopedPropertyIds,
      tasks: mergedTasks,
      documents: toSuggestionDocuments(compliancePortfolio as Array<Record<string, unknown>>),
      signals: signalsForCompiler(platformSignals),
      taskAssetLinks,
      assets,
      messagesByTaskId,
      membersByUserId,
      userState: orgId ? readSuggestionUserState(orgId) : userState,
    });
  }, [
    enabled,
    userId,
    role,
    assignedProperties,
    scopedPropertyIds,
    mergedTasks,
    compliancePortfolio,
    platformSignals,
    taskAssetLinks,
    assets,
    messagesByTaskId,
    membersByUserId,
    orgId,
    userState,
  ]);

  const persistState = useCallback(
    (suggestion: ActionableSuggestion, patch: { dismissedAt?: string; snoozedUntil?: string }) => {
      if (!orgId) return;
      const next = upsertSuggestionUserState(orgId, suggestion.id, {
        ...patch,
        fingerprint: suggestionFingerprint(suggestion),
      });
      setUserState(next);
    },
    [orgId]
  );

  const dismissSuggestion = useCallback(
    async (suggestion: ActionableSuggestion) => {
      persistState(suggestion, { dismissedAt: new Date().toISOString() });
      for (const signalId of suggestion.signalIds) {
        try {
          await dismiss.mutateAsync(signalId);
        } catch {
          // Suggestion state still hides this item locally.
        }
      }
    },
    [dismiss, persistState]
  );

  const snoozeSuggestion = useCallback(
    async (suggestion: ActionableSuggestion) => {
      persistState(suggestion, {
        snoozedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      for (const signalId of suggestion.signalIds) {
        try {
          await snooze.mutateAsync(signalId);
        } catch {
          // Local snooze still applies.
        }
      }
    },
    [persistState, snooze]
  );

  const runPrimaryAction = useCallback(
    (suggestion: ActionableSuggestion) => {
      performSuggestionPrimaryAction(suggestion, { navigate });
    },
    [navigate]
  );

  return {
    suggestions,
    topSuggestion: suggestions[0] ?? null,
    dismissSuggestion,
    snoozeSuggestion,
    runPrimaryAction,
  };
}
