import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import {
  mapTasksViewToComplianceTask,
  type ComplianceTaskCardModel,
} from "@/utils/mapTasksViewToCards";

export type ComplianceTask = ComplianceTaskCardModel;

type OccurrenceRow = {
  task_id: string;
  compliance_rules: { name: string } | null;
};

export function useComplianceTasks() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["compliance-tasks", orgId],
    enabled: !!orgId && !orgLoading,
    staleTime: 60_000,
    queryFn: async (): Promise<ComplianceTask[]> => {
      if (!orgId) return [];

      const { data: occs, error: occErr } = await supabase
        .from("compliance_occurrences")
        .select("task_id, compliance_rules(name)")
        .eq("org_id", orgId)
        .not("task_id", "is", null);

      if (occErr) throw occErr;

      const rows = (occs ?? []) as unknown as OccurrenceRow[];
      const ruleByTask = new Map<string, string>();

      for (const row of rows) {
        const tid = row.task_id;
        const name = row.compliance_rules?.name?.trim() || "";
        const prev = ruleByTask.get(tid);
        if (!name) {
          if (!prev) ruleByTask.set(tid, "");
          continue;
        }
        if (!prev) ruleByTask.set(tid, name);
        else if (!prev.split(", ").includes(name)) {
          ruleByTask.set(tid, `${prev}, ${name}`);
        }
      }

      const taskIds = [...ruleByTask.keys()];
      if (taskIds.length === 0) return [];

      const { data: tasks, error: taskErr } = await supabase
        .from("tasks_view")
        .select("*")
        .eq("org_id", orgId)
        .in("id", taskIds);

      if (taskErr) throw taskErr;

      const list = (tasks ?? [])
        .filter((t) => t.id)
        .map((t) =>
          mapTasksViewToComplianceTask(t, ruleByTask.get(t.id!) ?? "")
        )
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

      return list;
    },
  });

  const tasks = useMemo(() => data ?? [], [data]);

  return {
    data: tasks,
    loading: isLoading || orgLoading,
    isError,
    error,
  };
}
