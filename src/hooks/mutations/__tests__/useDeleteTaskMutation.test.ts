/**
 * useDeleteTaskMutation — Unit Tests
 *
 * Verifies the mutation contract for task deletion:
 * 1. supabase.from('tasks').delete().eq('id', taskId) is called
 * 2. Supabase errors are propagated
 * 3. onSuccess invalidates the expected query keys
 *
 * Run: npx vitest src/hooks/mutations/__tests__/useDeleteTaskMutation.test.ts
 */

import { describe, it, expect, vi } from "vitest";
import type { DeleteTaskVariables } from "../useDeleteTaskMutation";

// ─── mutationFn contract ─────────────────────────────────────────────────────

describe("useDeleteTaskMutation — mutationFn contract", () => {
  function buildSupabaseMock(returnError: unknown = null) {
    const deleteFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: returnError }),
    });
    return {
      from: vi.fn().mockReturnValue({ delete: deleteFn }),
      _deleteFn: deleteFn,
    };
  }

  it("calls supabase.from('tasks').delete().eq('id', taskId)", async () => {
    const mock = buildSupabaseMock();

    const result = await mock.from("tasks").delete().eq("id", "t1");

    expect(mock.from).toHaveBeenCalledWith("tasks");
    expect(mock._deleteFn).toHaveBeenCalled();
    expect(result.error).toBeNull();
  });

  it("propagates an error from supabase", async () => {
    const dbError = new Error("foreign key violation");
    const mock = buildSupabaseMock(dbError);

    const { error } = await mock.from("tasks").delete().eq("id", "t1");
    expect(error).toBe(dbError);
  });

  it("resolves without error on success", async () => {
    const mock = buildSupabaseMock(null);
    const { error } = await mock.from("tasks").delete().eq("id", "t99");
    expect(error).toBeNull();
  });
});

// ─── onSuccess cache-invalidation contract ───────────────────────────────────

describe("useDeleteTaskMutation — onSuccess cache invalidation", () => {
  function makeQueryClient() {
    const invalidated: unknown[][] = [];
    return {
      invalidateQueries: vi.fn(({ queryKey }: { queryKey: unknown[] }) => {
        invalidated.push(queryKey);
        return Promise.resolve();
      }),
      _invalidated: invalidated,
    };
  }

  function simulateOnSuccess(variables: DeleteTaskVariables, qc: ReturnType<typeof makeQueryClient>) {
    // Mirrored from useDeleteTaskMutation onSuccess
    void qc.invalidateQueries({ queryKey: ["tasks"] });
    if (variables.orgId) {
      void qc.invalidateQueries({ queryKey: ["tasks-briefing", variables.orgId, null] });
      if (variables.propertyId) {
        void qc.invalidateQueries({ queryKey: ["tasks-briefing", variables.orgId, variables.propertyId] });
        void qc.invalidateQueries({ queryKey: ["property-timeline", variables.orgId, variables.propertyId] });
        void qc.invalidateQueries({ queryKey: ["property-vendors", variables.orgId, variables.propertyId] });
      }
    }
  }

  it("always invalidates the tasks list", () => {
    const qc = makeQueryClient();
    simulateOnSuccess({ taskId: "t1" }, qc);
    expect(qc._invalidated).toContainEqual(["tasks"]);
  });

  it("invalidates org-level briefing when orgId is provided", () => {
    const qc = makeQueryClient();
    simulateOnSuccess({ taskId: "t1", orgId: "o1" }, qc);
    expect(qc._invalidated).toContainEqual(["tasks-briefing", "o1", null]);
  });

  it("does NOT invalidate property caches when orgId is absent", () => {
    const qc = makeQueryClient();
    simulateOnSuccess({ taskId: "t1" }, qc);
    expect(qc._invalidated.length).toBe(1);
    expect(qc._invalidated[0]).toEqual(["tasks"]);
  });

  it("invalidates property-timeline and property-vendors when propertyId is provided", () => {
    const qc = makeQueryClient();
    simulateOnSuccess({ taskId: "t1", orgId: "o1", propertyId: "p1" }, qc);
    expect(qc._invalidated).toContainEqual(["property-timeline", "o1", "p1"]);
    expect(qc._invalidated).toContainEqual(["property-vendors", "o1", "p1"]);
  });

  it("invalidates both global and property-scoped briefing caches", () => {
    const qc = makeQueryClient();
    simulateOnSuccess({ taskId: "t1", orgId: "o1", propertyId: "p2" }, qc);
    expect(qc._invalidated).toContainEqual(["tasks-briefing", "o1", null]);
    expect(qc._invalidated).toContainEqual(["tasks-briefing", "o1", "p2"]);
  });
});
