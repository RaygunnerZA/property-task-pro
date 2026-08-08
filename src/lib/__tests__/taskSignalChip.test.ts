import { describe, expect, it, vi, afterEach } from "vitest";
import { resolveTaskSignalChip } from "@/lib/taskSignalChip";

describe("resolveTaskSignalChip", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null for completed tasks even when overdue and urgent", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-25T12:00:00"));
    expect(
      resolveTaskSignalChip({
        due_date: "2026-05-20",
        priority: "urgent",
        status: "completed",
      })
    ).toBeNull();
  });

  it("prefers EXPIRED over OVERDUE and URGENT", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-25T12:00:00"));
    expect(
      resolveTaskSignalChip({
        expired: true,
        due_date: "2026-05-20",
        priority: "urgent",
        status: "open",
      })
    ).toMatchObject({ kind: "expired", label: "EXPIRED", tone: "coral" });
  });

  it("prefers OVERDUE over URGENT", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-25T12:00:00"));
    expect(
      resolveTaskSignalChip({
        due_date: "2026-05-20",
        priority: "urgent",
        status: "open",
      })
    ).toMatchObject({ kind: "overdue", label: "OVERDUE", tone: "coral" });
  });

  it("shows URGENT when not overdue (including over due soon)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-25T12:00:00"));
    expect(
      resolveTaskSignalChip({
        due_date: "2026-05-28",
        priority: "urgent",
        status: "open",
      })
    ).toMatchObject({ kind: "urgent", label: "URGENT", tone: "coral" });
  });

  it("shows DUE SOON when no higher signal", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-25T12:00:00"));
    expect(
      resolveTaskSignalChip({
        due_date: "2026-05-28",
        priority: "medium",
        status: "open",
      })
    ).toMatchObject({ kind: "due_soon", label: "DUE SOON", tone: "amber" });
  });

  it("shows HIGH (amber) over DUE SOON", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-25T12:00:00"));
    expect(
      resolveTaskSignalChip({
        due_date: "2026-05-28",
        priority: "high",
        status: "open",
      })
    ).toMatchObject({ kind: "high", label: "HIGH", tone: "amber" });
  });

  it("shows HIGH with no due date", () => {
    expect(
      resolveTaskSignalChip({ priority: "high", status: "open" })
    ).toMatchObject({ kind: "high", label: "HIGH", tone: "amber" });
  });

  it("prefers URGENT over HIGH", () => {
    expect(
      resolveTaskSignalChip({ priority: "urgent", status: "open" })
    ).toMatchObject({ kind: "urgent", label: "URGENT", tone: "coral" });
  });

  it("shows URGENT with no due date", () => {
    expect(
      resolveTaskSignalChip({ priority: "urgent", status: "open" })
    ).toMatchObject({ kind: "urgent", label: "URGENT", tone: "coral" });
  });
});
