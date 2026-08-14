import { describe, expect, it } from "vitest";
import {
  ALL_TASKS_ILLUSTRATION_ALTERNATES,
  ALL_TASKS_ILLUSTRATION_POOL,
  ALL_TASKS_ILLUSTRATION_PRIMARY,
  ALL_TASKS_ILLUSTRATION_USAGE_DAYS_PER_ROTATION as INTERVAL,
  applyAllTasksIllustrationUsage,
  defaultAllTasksIllustrationState,
  pickAllTasksIllustrationIndex,
  allTasksIllustrationSrc,
} from "@/lib/allTasksIllustration";

function day(n: number): string {
  return `2026-08-${String(n).padStart(2, "0")}`;
}

describe("allTasksIllustration rotation", () => {
  it("keeps the primary for the first few usage days", () => {
    let state = defaultAllTasksIllustrationState();
    for (let d = 1; d <= INTERVAL; d++) {
      state = applyAllTasksIllustrationUsage(state, day(d));
      expect(allTasksIllustrationSrc(state.index)).toBe(ALL_TASKS_ILLUSTRATION_PRIMARY);
      expect(state.randomized).toBe(false);
    }
  });

  it("does not count the same usage day twice", () => {
    let state = defaultAllTasksIllustrationState();
    state = applyAllTasksIllustrationUsage(state, day(1));
    const once = state.usageCount;
    state = applyAllTasksIllustrationUsage(state, day(1));
    expect(state.usageCount).toBe(once);
    expect(allTasksIllustrationSrc(state.index)).toBe(ALL_TASKS_ILLUSTRATION_PRIMARY);
  });

  it("cycles primary then each numbered alternate", () => {
    let state = defaultAllTasksIllustrationState();
    let d = 1;
    for (let slot = 0; slot < ALL_TASKS_ILLUSTRATION_POOL.length; slot++) {
      for (let step = 0; step < INTERVAL; step++) {
        state = applyAllTasksIllustrationUsage(state, day(d));
        d += 1;
        expect(allTasksIllustrationSrc(state.index)).toBe(ALL_TASKS_ILLUSTRATION_POOL[slot]);
      }
    }
    expect(state.randomized).toBe(false);
    expect(state.index).toBe(ALL_TASKS_ILLUSTRATION_POOL.length - 1);
  });

  it("randomises after the ordered cycle and skips the current image", () => {
    let state = defaultAllTasksIllustrationState();
    const orderedSlots = ALL_TASKS_ILLUSTRATION_POOL.length;
    let d = 1;
    for (let i = 0; i < orderedSlots * INTERVAL; i++) {
      state = applyAllTasksIllustrationUsage(state, day(d), () => 0);
      d += 1;
    }
    expect(state.index).toBe(orderedSlots - 1);
    expect(state.randomized).toBe(false);

    const lastOrdered = state.index;
    state = applyAllTasksIllustrationUsage(state, day(d), () => 0);
    expect(state.randomized).toBe(true);
    expect(state.index).not.toBe(lastOrdered);
    expect(allTasksIllustrationSrc(state.index)).toBe(ALL_TASKS_ILLUSTRATION_POOL[state.index]);
  });

  it("pickAllTasksIllustrationIndex avoids the current slot", () => {
    expect(pickAllTasksIllustrationIndex(3, () => 0.01)).not.toBe(3);
    expect(pickAllTasksIllustrationIndex(0, () => 0)).toBeGreaterThan(0);
  });
});
