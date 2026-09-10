import { describe, expect, it } from "vitest";
import {
  getRecurringTaskSeriesColor,
  resolveCalendarChipBackground,
  resolveCalendarChipColor,
  taskHasRecurrence,
} from "@/lib/calendarSeriesColor";

describe("calendarSeriesColor", () => {
  it("assigns a stable color per task id", () => {
    const a = getRecurringTaskSeriesColor("task-alpha");
    const b = getRecurringTaskSeriesColor("task-beta");
    expect(a).toBe(getRecurringTaskSeriesColor("task-alpha"));
    expect(b).toBe(getRecurringTaskSeriesColor("task-beta"));
    expect(a).not.toBe(b);
  });

  it("uses series color for recurring tasks", () => {
    const task = {
      id: "weekly-1",
      title: "Calendar Test",
      repeat_rule: { type: "weekly", interval: 1 },
    };
    expect(taskHasRecurrence(task)).toBe(true);
    const { baseColor, isSeriesColor } = resolveCalendarChipColor(task);
    expect(isSeriesColor).toBe(true);
    expect(baseColor).toBe(getRecurringTaskSeriesColor("weekly-1"));
  });

  it("uses calendar type color for one-off tasks", () => {
    const task = { id: "once-1", title: "Add checklist test" };
    const { isSeriesColor } = resolveCalendarChipColor(task);
    expect(isSeriesColor).toBe(false);
  });

  it("anchor and repeat occurrences share the same series fill", () => {
    const task = {
      id: "weekly-2",
      repeat_rule: { type: "weekly", interval: 1 },
    };
    const anchor = resolveCalendarChipBackground(task, false);
    const repeat = resolveCalendarChipBackground(task, true);
    expect(anchor).toBe(repeat);
    expect(
      resolveCalendarChipBackground(task, false, {
        opaque: true,
        stackIndex: 0,
        stackCount: 2,
      })
    ).toBe(
      resolveCalendarChipBackground(task, true, {
        opaque: true,
        stackIndex: 1,
        stackCount: 2,
      })
    );
  });

  it("opaque stacked chips use solid hex so text cannot ghost through", () => {
    const task = { id: "once-opaque", title: "Plumbing compliance" };
    const fill = resolveCalendarChipBackground(task, false, { opaque: true });
    expect(fill).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(fill).not.toMatch(/^rgba\(/);
  });

  it("one-off chips tint by priority", () => {
    const urgent = resolveCalendarChipColor({
      id: "u1",
      title: "Burst pipe",
      priority: "urgent",
    });
    const high = resolveCalendarChipColor({
      id: "h1",
      title: "Service boiler",
      priority: "high",
    });
    expect(urgent.isSeriesColor).toBe(false);
    expect(urgent.baseColor).toBe("#EB6834");
    expect(high.baseColor).toBe("#E8A04A");
  });

  it("darkens cards further back in a same-period hand", () => {
    const task = { id: "stack-1", title: "Same priority", priority: "high" };
    const back = resolveCalendarChipBackground(task, false, {
      opaque: true,
      stackIndex: 0,
      stackCount: 2,
    });
    const front = resolveCalendarChipBackground(task, false, {
      opaque: true,
      stackIndex: 1,
      stackCount: 2,
    });
    expect(back).not.toBe(front);
    // Back card should mix more ink → lower RGB sum.
    const sum = (hex: string) => {
      const n = hex.replace("#", "");
      return (
        parseInt(n.slice(0, 2), 16) +
        parseInt(n.slice(2, 4), 16) +
        parseInt(n.slice(4, 6), 16)
      );
    };
    expect(sum(back)).toBeLessThan(sum(front));
  });
});
