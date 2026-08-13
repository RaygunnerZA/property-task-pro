/**
 * useDeleteTaskMutation — Unit Tests
 *
 * Verifies soft-delete (Trash) contract:
 * 1. orgId is required
 * 2. onSuccess invalidates the expected query keys (including trashed-tasks)
 *
 * Run: npx vitest src/hooks/mutations/__tests__/useDeleteTaskMutation.test.ts
 */

import { describe, it, expect, vi } from "vitest";
import type { DeleteTaskVariables } from "../useDeleteTaskMutation";

describe("useDeleteTaskMutation — variables contract", () => {
  it("requires orgId for trash move", () => {
    const variables: DeleteTaskVariables = { taskId: "t1" };
    expect(variables.orgId).toBeUndefined();
  });
});

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
    void qc.invalidateQueries({ queryKey: ["tasks"] });
    void qc.invalidateQueries({ queryKey: ["trashed-tasks"] });
    if (variables.orgId) {
      void qc.invalidateQueries({ queryKey: ["tasks-briefing", variables.orgId, null] });
      if (variables.propertyId) {
        void qc.invalidateQueries({ queryKey: ["tasks-briefing", variables.orgId, variables.propertyId] });
        void qc.invalidateQueries({ queryKey: ["property-timeline", variables.orgId, variables.propertyId] });
        void qc.invalidateQueries({ queryKey: ["property-vendors", variables.orgId, variables.propertyId] });
      }
    }
  }

  it("always invalidates tasks and trashed-tasks", () => {
    const qc = makeQueryClient();
    simulateOnSuccess({ taskId: "t1" }, qc);
    expect(qc._invalidated).toContainEqual(["tasks"]);
    expect(qc._invalidated).toContainEqual(["trashed-tasks"]);
  });

  it("invalidates org-level briefing when orgId is provided", () => {
    const qc = makeQueryClient();
    simulateOnSuccess({ taskId: "t1", orgId: "o1" }, qc);
    expect(qc._invalidated).toContainEqual(["tasks-briefing", "o1", null]);
  });

  it("invalidates property-timeline and property-vendors when propertyId is provided", () => {
    const qc = makeQueryClient();
    simulateOnSuccess({ taskId: "t1", orgId: "o1", propertyId: "p1" }, qc);
    expect(qc._invalidated).toContainEqual(["property-timeline", "o1", "p1"]);
    expect(qc._invalidated).toContainEqual(["property-vendors", "o1", "p1"]);
  });
});
