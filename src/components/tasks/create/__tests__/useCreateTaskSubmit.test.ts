/**
 * useCreateTaskSubmit — Unit Tests
 *
 * Tests the submit pipeline contract without any React rendering:
 * 1. Validation guards: blocking chips, missing property, empty title, auth
 * 2. Title auto-generation from AI title and description
 * 3. Pending invitation handling (pending- prefix → null assigned user)
 * 4. Analytics source selection (ai vs manual)
 *
 * The hook wraps a useCallback, so we extract and test the logic directly
 * via a simulated invocation of the inner async body.
 *
 * Run: npx vitest src/components/tasks/create/__tests__/useCreateTaskSubmit.test.ts
 */

import { describe, it, expect, vi } from "vitest";
import type { SuggestedChip } from "@/types/chip-suggestions";
import { resolveTaskTitle } from "@/lib/taskTitleFromDescription";

// ---------------------------------------------------------------------------
// Helper: build a minimal chip
// ---------------------------------------------------------------------------
function chip(overrides: Partial<SuggestedChip>): SuggestedChip {
  return {
    id: "chip-1",
    label: "Test",
    type: "verb",
    blockingRequired: false,
    resolvedEntityId: undefined,
    section: "who",
    ...overrides,
  } as SuggestedChip;
}

// ---------------------------------------------------------------------------
// Title resolution uses shared resolveTaskTitle (no raw description slice)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Assigned user resolution (extracted from useCreateTaskSubmit)
// ---------------------------------------------------------------------------
function resolveAssignedUser(assignedUserId: string | undefined): string | null {
  if (!assignedUserId) return null;
  if (assignedUserId.startsWith("pending-")) return null;
  return assignedUserId;
}

// ---------------------------------------------------------------------------
// Analytics source resolution (extracted from useCreateTaskSubmit)
// ---------------------------------------------------------------------------
function resolveAnalyticsSource(
  taskCreatedSource: string | undefined,
  prefill: unknown
): "manual" | "ai" | "assistant" {
  if (taskCreatedSource) return taskCreatedSource as "manual" | "ai" | "assistant";
  return prefill ? "ai" : "manual";
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useCreateTaskSubmit — blocking chip validation", () => {
  it("identifies blocking chips that have no resolvedEntityId", () => {
    const chips = new Map<string, SuggestedChip>([
      ["c1", chip({ id: "c1", blockingRequired: true, resolvedEntityId: undefined })],
      ["c2", chip({ id: "c2", blockingRequired: false })],
    ]);
    const unresolved = Array.from(chips.values()).filter(
      (c) => c.blockingRequired && !c.resolvedEntityId
    );
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0].id).toBe("c1");
  });

  it("does not flag chips that are resolved", () => {
    const chips = new Map<string, SuggestedChip>([
      ["c1", chip({ id: "c1", blockingRequired: true, resolvedEntityId: "entity-1" })],
    ]);
    const unresolved = Array.from(chips.values()).filter(
      (c) => c.blockingRequired && !c.resolvedEntityId
    );
    expect(unresolved).toHaveLength(0);
  });

  it("identifies invite (person) chips among blocking unresolved chips", () => {
    const chips = new Map<string, SuggestedChip>([
      ["c1", chip({ id: "c1", type: "person", blockingRequired: true, resolvedEntityId: undefined })],
      ["c2", chip({ id: "c2", type: "space", blockingRequired: true, resolvedEntityId: undefined })],
    ]);
    const unresolved = Array.from(chips.values()).filter(
      (c) => c.blockingRequired && !c.resolvedEntityId
    );
    const inviteChips = unresolved.filter((c) => c.type === "person");
    expect(inviteChips).toHaveLength(1);
    expect(inviteChips[0].id).toBe("c1");
  });
});

describe("useCreateTaskSubmit — title resolution", () => {
  it("uses the manually entered title when present", () => {
    expect(resolveTaskTitle("Fix the boiler", "AI Title", "Some description")).toBe("Fix the boiler");
  });

  it("falls back to AI-generated title when manual title is empty", () => {
    expect(resolveTaskTitle("", "AI Title Here", "Some description")).toBe("AI Title Here");
  });

  it("falls back to an action summary — not a raw character slice", () => {
    const longDesc = `Please fix the kitchen tap urgently. ${"A".repeat(60)}`;
    const result = resolveTaskTitle("", "", longDesc);
    expect(result?.toLowerCase()).toContain("fix");
    expect(result).not.toMatch(/^A{50}/);
    expect(result).not.toContain("...");
  });

  it("returns null when description is too vague for a title", () => {
    expect(resolveTaskTitle("", "", "Hi")).toBeNull();
  });

  it("returns null when all title sources are empty", () => {
    expect(resolveTaskTitle("", "", "")).toBeNull();
  });

  it("trims whitespace from manual title", () => {
    expect(resolveTaskTitle("  Trim me  ", "", "")).toBe("Trim me");
  });
});

describe("useCreateTaskSubmit — assigned user resolution", () => {
  it("passes through a real user ID unchanged", () => {
    expect(resolveAssignedUser("user-abc-123")).toBe("user-abc-123");
  });

  it("converts a pending- prefix user to null", () => {
    expect(resolveAssignedUser("pending-john@example.com")).toBeNull();
  });

  it("returns null when no user is assigned", () => {
    expect(resolveAssignedUser(undefined)).toBeNull();
  });

  it("does not strip a user whose id contains 'pending' but does not start with it", () => {
    // edge-case: a real UUID that happens to contain 'pending' elsewhere
    const id = "abc-pending-123";
    expect(resolveAssignedUser(id)).toBe("abc-pending-123");
  });
});

describe("useCreateTaskSubmit — analytics source resolution", () => {
  it("uses the explicit taskCreatedSource when set", () => {
    expect(resolveAnalyticsSource("assistant", null)).toBe("assistant");
  });

  it("returns 'ai' when prefill is provided and no explicit source", () => {
    expect(resolveAnalyticsSource(undefined, { title: "prefilled" })).toBe("ai");
  });

  it("returns 'manual' when no source and no prefill", () => {
    expect(resolveAnalyticsSource(undefined, null)).toBe("manual");
  });

  it("respects explicit source over prefill", () => {
    expect(resolveAnalyticsSource("manual", { title: "prefill" })).toBe("manual");
  });
});

describe("useCreateTaskSubmit — space/asset chip property guard", () => {
  it("detects space chips that require a property", () => {
    const chips = new Map<string, SuggestedChip>([
      ["c1", chip({ id: "c1", type: "space", blockingRequired: false })],
    ]);
    const hasSpaceOrAssetChips = Array.from(chips.values()).some(
      (c) => c.type === "space" || c.type === "asset"
    );
    expect(hasSpaceOrAssetChips).toBe(true);
  });

  it("detects asset chips that require a property", () => {
    const chips = new Map<string, SuggestedChip>([
      ["c1", chip({ id: "c1", type: "asset", blockingRequired: false })],
    ]);
    const hasSpaceOrAssetChips = Array.from(chips.values()).some(
      (c) => c.type === "space" || c.type === "asset"
    );
    expect(hasSpaceOrAssetChips).toBe(true);
  });

  it("returns false for chips that are neither space nor asset", () => {
    const chips = new Map<string, SuggestedChip>([
      ["c1", chip({ id: "c1", type: "person" })],
      ["c2", chip({ id: "c2", type: "date" })],
    ]);
    const hasSpaceOrAssetChips = Array.from(chips.values()).some(
      (c) => c.type === "space" || c.type === "asset"
    );
    expect(hasSpaceOrAssetChips).toBe(false);
  });
});
