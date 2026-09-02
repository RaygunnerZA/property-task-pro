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

  it("anchor and repeat occurrences share hue with different alpha", () => {
    const task = {
      id: "weekly-2",
      repeat_rule: { type: "weekly", interval: 1 },
    };
    const anchor = resolveCalendarChipBackground(task, false);
    const repeat = resolveCalendarChipBackground(task, true);
    expect(anchor).toMatch(/^rgba\(/);
    expect(repeat).toMatch(/^rgba\(/);
    expect(anchor).not.toBe(repeat);
    expect(anchor.slice(0, 15)).toBe(repeat.slice(0, 15));
  });
});
