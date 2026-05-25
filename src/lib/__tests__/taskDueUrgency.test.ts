import { describe, expect, it, vi, afterEach } from "vitest";
import {
  formatTaskDueRelative,
  getTaskDueUrgency,
  taskDueUrgencyLabel,
} from "@/lib/taskDueUrgency";

describe("getTaskDueUrgency", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns overdue when due date is before today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-25T12:00:00"));
    expect(
      getTaskDueUrgency({ due_date: "2026-05-24", status: "open" })
    ).toBe("overdue");
  });

  it("returns due_soon when due within 7 days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-25T12:00:00"));
    expect(
      getTaskDueUrgency({ due_date: "2026-05-30", status: "open" })
    ).toBe("due_soon");
  });

  it("returns null when due is beyond the horizon", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-25T12:00:00"));
    expect(
      getTaskDueUrgency({ due_date: "2026-06-10", status: "open" })
    ).toBeNull();
  });

  it("returns null for completed tasks", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-25T12:00:00"));
    expect(
      getTaskDueUrgency({ due_date: "2026-05-20", status: "completed" })
    ).toBeNull();
  });
});

describe("taskDueUrgencyLabel", () => {
  it("returns chip labels without bracket notation", () => {
    expect(taskDueUrgencyLabel("overdue")).toBe("OVERDUE");
    expect(taskDueUrgencyLabel("due_soon")).toBe("DUE SOON");
    expect(taskDueUrgencyLabel("overdue")).not.toMatch(/[\[\]]/);
    expect(taskDueUrgencyLabel("due_soon")).not.toMatch(/[\[\]]/);
  });
});

describe("formatTaskDueRelative", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats future due dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-25T12:00:00"));
    expect(formatTaskDueRelative("2026-05-27")).toBe("Due in 2 days");
    expect(formatTaskDueRelative("2026-05-26")).toBe("Due tomorrow");
    expect(formatTaskDueRelative("2026-05-25")).toBe("Due today");
  });

  it("formats overdue due dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-25T12:00:00"));
    expect(formatTaskDueRelative("2026-05-23")).toBe("Overdue by 2 days");
    expect(formatTaskDueRelative("2026-05-24")).toBe("Overdue by 1 day");
  });
});
