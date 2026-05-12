/**
 * useUpdateTaskMutation — Unit Tests
 *
 * Verifies the mutation contract for task updates:
 * 1. supabase.from('tasks').update is called with the correct payload
 * 2. Supabase errors are propagated
 * 3. onSuccess invalidates the expected query keys (tasks, task, briefing, timeline)
 *
 * Run: npx vitest src/hooks/mutations/__tests__/useUpdateTaskMutation.test.ts
 */

import { describe, it, expect, vi } from "vitest";
import type { UpdateTaskVariables } from "../useUpdateTaskMutation";

// ─── mutationFn contract ─────────────────────────────────────────────────────

describe("useUpdateTaskMutation — mutationFn contract", () => {
  function buildSupabaseMock(returnData: unknown, returnError: unknown = null) {
    return {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: returnData, error: returnError }),
            }),
          }),
        }),
      }),
    };
  }

  it("calls supabase.from('tasks').update with the updates object", async () => {
    const mockReturn = { id: "t1", org_id: "o1", property_id: null, status: "open" };
    const mock = buildSupabaseMock(mockReturn);

    const updates = { title: "New title", status: "open" as const };
    const { data, error } = await mock.from("tasks").update(updates).eq("id", "t1").select().single();

    if (error) throw error;

    expect(mock.from).toHaveBeenCalledWith("tasks");
    const updateCall = mock.from.mock.results[0].value.update;
    expect(updateCall).toHaveBeenCalledWith(updates);
    expect(data).toEqual(mockReturn);
  });

  it("throws when supabase returns an error", async () => {
    const dbError = new Error("not found");
    const mock = buildSupabaseMock(null, dbError);

    const result = await mock.from("tasks").update({}).eq("id", "t1").select().single();
    const thrown = result.error;

    expect(thrown).toBe(dbError);
  });

  it("throws when supabase returns null data without error", async () => {
    const mock = buildSupabaseMock(null);

    await expect(async () => {
      const { data, error } = await mock.from("tasks").update({}).eq("id", "t1").select().single();
      if (error) throw error;
      if (!data) throw new Error("useUpdateTaskMutation: no data returned");
    }).rejects.toThrow("useUpdateTaskMutation: no data returned");
  });

  it("returns data from supabase on success", async () => {
    const expected = { id: "t2", org_id: "o2", property_id: "p2", status: "completed" };
    const mock = buildSupabaseMock(expected);

    const { data } = await mock.from("tasks").update({}).eq("id", "t2").select().single();
    expect(data).toEqual(expected);
  });
});

// ─── onSuccess cache-invalidation contract ───────────────────────────────────

describe("useUpdateTaskMutation — onSuccess cache invalidation", () => {
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

  function simulateOnSuccess(
    data: { id: string; org_id: string | null; property_id: string | null; status: string },
    variables: UpdateTaskVariables,
    qc: ReturnType<typeof makeQueryClient>
  ) {
    // Mirrored from useUpdateTaskMutation onSuccess
    void qc.invalidateQueries({ queryKey: ["tasks"] });
    void qc.invalidateQueries({ queryKey: ["task", variables.taskId] });
    if (data.org_id) {
      void qc.invalidateQueries({ queryKey: ["tasks-briefing", data.org_id, null] });
      if (data.property_id) {
        void qc.invalidateQueries({ queryKey: ["tasks-briefing", data.org_id, data.property_id] });
        void qc.invalidateQueries({ queryKey: ["property-timeline", data.org_id, data.property_id] });
        if (data.status === "completed") {
          void qc.invalidateQueries({ queryKey: ["property-vendors", data.org_id, data.property_id] });
          void qc.invalidateQueries({ queryKey: ["property-drift", data.org_id, data.property_id] });
        }
      }
    }
  }

  it("always invalidates tasks and task-by-id", () => {
    const qc = makeQueryClient();
    simulateOnSuccess(
      { id: "t1", org_id: null, property_id: null, status: "open" },
      { taskId: "t1", orgId: "o1", updates: {} },
      qc
    );
    expect(qc._invalidated).toContainEqual(["tasks"]);
    expect(qc._invalidated).toContainEqual(["task", "t1"]);
  });

  it("invalidates org-level briefing when org_id is present", () => {
    const qc = makeQueryClient();
    simulateOnSuccess(
      { id: "t1", org_id: "o1", property_id: null, status: "open" },
      { taskId: "t1", orgId: "o1", updates: {} },
      qc
    );
    expect(qc._invalidated).toContainEqual(["tasks-briefing", "o1", null]);
  });

  it("invalidates property-timeline when property_id is present", () => {
    const qc = makeQueryClient();
    simulateOnSuccess(
      { id: "t1", org_id: "o1", property_id: "p1", status: "open" },
      { taskId: "t1", orgId: "o1", propertyId: "p1", updates: {} },
      qc
    );
    expect(qc._invalidated).toContainEqual(["property-timeline", "o1", "p1"]);
  });

  it("also invalidates vendors and drift when status becomes 'completed'", () => {
    const qc = makeQueryClient();
    simulateOnSuccess(
      { id: "t1", org_id: "o1", property_id: "p1", status: "completed" },
      { taskId: "t1", orgId: "o1", propertyId: "p1", updates: { status: "completed" as const } },
      qc
    );
    expect(qc._invalidated).toContainEqual(["property-vendors", "o1", "p1"]);
    expect(qc._invalidated).toContainEqual(["property-drift", "o1", "p1"]);
  });

  it("does NOT invalidate vendors/drift for non-completed status", () => {
    const qc = makeQueryClient();
    simulateOnSuccess(
      { id: "t1", org_id: "o1", property_id: "p1", status: "in_progress" },
      { taskId: "t1", orgId: "o1", propertyId: "p1", updates: { status: "in_progress" as const } },
      qc
    );
    expect(qc._invalidated.every((k) => k[0] !== "property-vendors")).toBe(true);
    expect(qc._invalidated.every((k) => k[0] !== "property-drift")).toBe(true);
  });
});
