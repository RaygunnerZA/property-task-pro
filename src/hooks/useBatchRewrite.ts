import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { loadReviewWorkspace } from "@/services/compliance/reviewWorkspace";
import { complianceClauses } from "@/services/compliance/clauses";
import { fetchClauseRewrite } from "@/services/compliance/clauseRewriteAi";

interface Clause {
  id: string;
  original: string;
  rewrite?: string;
  status?: "pending" | "accepted" | "rejected";
  confidence?: number;
}

type LocalMeta = { rewrite?: string; status?: "pending" | "accepted" | "rejected" };

export function useBatchRewrite(reviewId: string) {
  const queryClient = useQueryClient();
  const { orgId } = useActiveOrg();
  const [local, setLocal] = useState<Record<string, LocalMeta>>({});
  const [loading, setLoading] = useState(false);

  const { data: workspace, isLoading: workspaceLoading } = useQuery({
    queryKey: ["compliance-review", reviewId],
    queryFn: () => loadReviewWorkspace(reviewId),
    enabled: !!reviewId,
    staleTime: 30_000,
  });

  const baseRows = workspace?.clauses ?? [];

  const clauses: Clause[] = useMemo(() => {
    return baseRows.map((c: { id: string; text: string; confidence?: number }) => {
      const id = c.id;
      const meta = local[id];
      return {
        id,
        original: c.text,
        rewrite: meta?.rewrite,
        status: meta?.status ?? "pending",
        confidence:
          c.confidence === null || c.confidence === undefined
            ? undefined
            : Number(c.confidence),
      };
    });
  }, [baseRows, local]);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ["compliance-review", reviewId],
    });
  }, [queryClient, reviewId]);

  const acceptAll = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      for (const c of clauses) {
        const rw = local[c.id]?.rewrite;
        if (rw?.trim()) {
          const { error } = await complianceClauses.updateClauseText(c.id, rw);
          if (error) throw new Error(error);
        }
      }
      setLocal((prev) => {
        const next = { ...prev };
        for (const c of clauses) {
          next[c.id] = { ...next[c.id], status: "accepted" };
        }
        return next;
      });
      invalidate();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [clauses, local, orgId, invalidate]);

  const rejectAll = useCallback(async () => {
    setLocal((prev) => {
      const next = { ...prev };
      for (const c of clauses) {
        next[c.id] = { ...next[c.id], status: "rejected" };
      }
      return next;
    });
  }, [clauses]);

  const regenerateAll = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const patch: Record<string, LocalMeta> = {};
      for (const c of baseRows) {
        const row = c as { id: string; text: string; critic_notes?: string | null };
        try {
          const out = await fetchClauseRewrite({
            org_id: orgId,
            clause_text: row.text || "",
            critic_notes: row.critic_notes ?? null,
          });
          patch[row.id] = {
            rewrite: out.suggestion,
            status: "pending",
          };
        } catch (e) {
          console.error("regenerateAll clause", row.id, e);
        }
      }
      setLocal((prev) => {
        const next = { ...prev };
        for (const [id, meta] of Object.entries(patch)) {
          next[id] = { ...next[id], ...meta };
        }
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, [baseRows, orgId]);

  const acceptOne = useCallback(
    async (clauseId: string) => {
      const rw = local[clauseId]?.rewrite;
      setLoading(true);
      try {
        if (rw?.trim()) {
          const { error } = await complianceClauses.updateClauseText(
            clauseId,
            rw
          );
          if (error) throw new Error(error);
          invalidate();
        }
        setLocal((prev) => ({
          ...prev,
          [clauseId]: { ...prev[clauseId], status: "accepted" },
        }));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    [local, invalidate]
  );

  const rejectOne = useCallback(async (clauseId: string) => {
    setLocal((prev) => ({
      ...prev,
      [clauseId]: { ...prev[clauseId], status: "rejected" },
    }));
  }, []);

  const regenerateOne = useCallback(
    async (clauseId: string) => {
      if (!orgId) return;
      const row = baseRows.find(
        (r: { id: string }) => r.id === clauseId
      ) as { id: string; text: string; critic_notes?: string | null } | undefined;
      if (!row) return;
      setLoading(true);
      try {
        const out = await fetchClauseRewrite({
          org_id: orgId,
          clause_text: row.text || "",
          critic_notes: row.critic_notes ?? null,
        });
        setLocal((prev) => ({
          ...prev,
          [clauseId]: {
            ...prev[clauseId],
            rewrite: out.suggestion,
            status: "pending",
          },
        }));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    [baseRows, orgId]
  );

  return {
    clauses,
    loading: loading || workspaceLoading,
    acceptAll,
    rejectAll,
    regenerateAll,
    acceptOne,
    rejectOne,
    regenerateOne,
  };
}
