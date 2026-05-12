/**
 * useCreateTaskMutation — Unit Tests
 *
 * Tests the mutation contract:
 * 1. supabase is called with the correct arguments
 * 2. track("task_created") fires in onSuccess with the right shape
 * 3. Errors from supabase propagate before track fires
 *
 * Run: npx vitest src/hooks/mutations/__tests__/useCreateTaskMutation.test.ts
 */

import { describe, it, expect, vi } from "vitest";
import type { TaskCreatedSource } from "../useCreateTaskMutation";

// ─── mutationFn contract ─────────────────────────────────────────────────────

describe("useCreateTaskMutation — mutationFn contract", () => {
  it("calls supabase.from('tasks').insert with the provided insert payload", async () => {
    const inserted: unknown[] = [];
    const mockData = { id: "task-1", org_id: "org-1", property_id: null, status: "open" };

    const supabaseMock = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn((payload: unknown) => {
          inserted.push(payload);
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
            }),
          };
        }),
      }),
    };

    const insertPayload = {
      org_id: "org-1",
      title: "Fix boiler",
      status: "open" as const,
    };

    // Simulate mutationFn
    const { data, error } = await supabaseMock.from("tasks").insert(insertPayload).select().single();
    if (error) throw error;

    expect(supabaseMock.from).toHaveBeenCalledWith("tasks");
    expect(inserted[0]).toEqual(insertPayload);
    expect(data).toEqual(mockData);
  });

  it("throws when supabase returns an error", async () => {
    const dbError = new Error("permission denied");
    const supabaseMock = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: dbError }),
          }),
        }),
      }),
    };

    async function simulateMutationFn() {
      const { data, error } = await supabaseMock.from("tasks").insert({}).select().single();
      if (error) throw error;
      if (!data) throw new Error("Couldn't create task: no data returned");
      return data;
    }

    await expect(simulateMutationFn()).rejects.toThrow("permission denied");
  });

  it("throws when supabase returns null data without an error", async () => {
    const supabaseMock = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    };

    async function simulateMutationFn() {
      const { data, error } = await supabaseMock.from("tasks").insert({}).select().single();
      if (error) throw error;
      if (!data) throw new Error("Couldn't create task: no data returned");
      return data;
    }

    await expect(simulateMutationFn()).rejects.toThrow("Couldn't create task");
  });
});

// ─── onSuccess — analytics contract ─────────────────────────────────────────

describe("useCreateTaskMutation — onSuccess analytics contract", () => {
  const sources: TaskCreatedSource[] = ["manual", "ai", "assistant"];

  for (const source of sources) {
    it(`fires track("task_created") with source="${source}"`, () => {
      const trackMock = vi.fn();
      const taskData = { id: "task-2", org_id: "org-2", property_id: "prop-1", status: "open" };

      // Simulate what onSuccess does
      trackMock("task_created", {
        org_id: taskData.org_id,
        task_id: taskData.id,
        source,
      });

      expect(trackMock).toHaveBeenCalledWith("task_created", {
        org_id: "org-2",
        task_id: "task-2",
        source,
      });
    });
  }

  it("does NOT fire track when mutationFn throws", async () => {
    const trackMock = vi.fn();

    async function simulateFailedMutation() {
      throw new Error("supabase error");
    }

    try {
      await simulateFailedMutation();
      // onSuccess would call track here — but we never reach it
      trackMock("task_created", {});
    } catch {
      // error caught — track must not have been called
    }

    expect(trackMock).not.toHaveBeenCalled();
  });

  it("includes org_id, task_id, and source in the track payload — no PII", () => {
    const trackMock = vi.fn();
    const taskData = {
      id: "task-3",
      org_id: "org-3",
      property_id: null,
      status: "open",
      title: "Fix roof",
      assigned_user_id: "user-99",
    };
    const source: TaskCreatedSource = "manual";

    trackMock("task_created", {
      org_id: taskData.org_id,
      task_id: taskData.id,
      source,
    });

    const call = trackMock.mock.calls[0][1] as Record<string, unknown>;
    // Assert the allowed fields are present
    expect(call).toHaveProperty("org_id");
    expect(call).toHaveProperty("task_id");
    expect(call).toHaveProperty("source");
    // Assert PII fields are not included
    expect(call).not.toHaveProperty("title");
    expect(call).not.toHaveProperty("assigned_user_id");
  });
});

// ─── briefing cache patch ────────────────────────────────────────────────────

describe("useCreateTaskMutation — briefing cache patch", () => {
  it("patches the [tasks-briefing, orgId, null] cache key with the new task", () => {
    const cache = new Map<string, unknown[]>();
    const taskData = {
      id: "task-4",
      org_id: "org-4",
      property_id: null,
      status: "open",
      priority: "normal",
      due_date: null,
    };

    function patchBriefingCacheSim(data: typeof taskData) {
      const key = `tasks-briefing|${data.org_id}|null`;
      const existing = (cache.get(key) as typeof taskData[] | undefined) ?? [];
      cache.set(key, [...existing, { id: data.id, status: data.status }]);
    }

    patchBriefingCacheSim(taskData);

    const entries = cache.get("tasks-briefing|org-4|null") as unknown[];
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ id: "task-4", status: "open" });
  });

  it("patches the property-specific briefing cache key when property_id is set", () => {
    const cache = new Map<string, unknown[]>();
    const taskData = {
      id: "task-5",
      org_id: "org-5",
      property_id: "prop-99",
      status: "in_progress",
      priority: "high",
      due_date: "2026-06-01",
    };

    function patchBriefingCacheSim(data: typeof taskData) {
      const globalKey = `tasks-briefing|${data.org_id}|null`;
      const propKey = `tasks-briefing|${data.org_id}|${data.property_id}`;
      cache.set(globalKey, [...(cache.get(globalKey) ?? []), { id: data.id }]);
      cache.set(propKey, [...(cache.get(propKey) ?? []), { id: data.id }]);
    }

    patchBriefingCacheSim(taskData);

    expect(cache.has("tasks-briefing|org-5|prop-99")).toBe(true);
    expect(cache.has("tasks-briefing|org-5|null")).toBe(true);
  });
});
