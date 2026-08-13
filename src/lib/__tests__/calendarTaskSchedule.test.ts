import { describe, expect, it } from "vitest";
import {
  buildCalendarPlacements,
  buildScheduleUpdate,
  filterTasksForScheduleAgenda,
  filterTasksForScheduleDate,
  formatScheduleDateTime,
  getPeriodFromScheduleValue,
  hasAssigneeDefinedScheduleTime,
  parseDropTargetId,
  parsePlacementDragId,
} from "../calendarTaskSchedule";

describe("calendarTaskSchedule", () => {
  it("detects morning vs afternoon from datetime", () => {
    expect(getPeriodFromScheduleValue("2026-05-28T09:00")).toBe("morning");
    expect(getPeriodFromScheduleValue("2026-05-28T14:30")).toBe("afternoon");
    expect(getPeriodFromScheduleValue("2026-05-28")).toBe("untimed");
  });

  it("builds placements for due date and milestones", () => {
    const placements = buildCalendarPlacements([
      {
        id: "t1",
        title: "A",
        due_date: "2026-05-16",
        milestones: [{ id: "m1", dateTime: "2026-05-28T09:00" }],
      },
    ]);
    expect(placements).toHaveLength(2);
    expect(placements.map((p) => p.id)).toContain("t1:due");
    expect(placements.map((p) => p.id)).toContain("t1:milestone:m1");
  });

  it("parses drag and drop ids", () => {
    expect(parsePlacementDragId("abc:due")).toEqual({ taskId: "abc", source: "due" });
    expect(parsePlacementDragId("abc:milestone:m1")).toEqual({
      taskId: "abc",
      source: "milestone",
      milestoneId: "m1",
    });
    expect(parseDropTargetId("drop|2026-05-26|afternoon")).toEqual({
      dateKey: "2026-05-26",
      period: "afternoon",
    });
  });

  it("requires assignee + explicit time for schedule time labels", () => {
    expect(
      hasAssigneeDefinedScheduleTime(
        { assigned_user_id: "user-1" },
        "2026-05-28T14:30"
      )
    ).toBe(true);
    expect(
      hasAssigneeDefinedScheduleTime({ assigned_user_id: null }, "2026-05-28T14:30")
    ).toBe(false);
    expect(
      hasAssigneeDefinedScheduleTime({ assigned_user_id: "user-1" }, "2026-05-28")
    ).toBe(false);
  });

  it("builds schedule updates for due and milestone sources", () => {
    const date = new Date(2026, 4, 26);
    expect(buildScheduleUpdate({ id: "t1" }, "due", undefined, date, "morning")).toEqual({
      due_date: formatScheduleDateTime(date, "morning"),
    });
    expect(
      buildScheduleUpdate(
        { milestones: [{ id: "m1", dateTime: "2026-05-01T09:00" }] },
        "milestone",
        "m1",
        date,
        "afternoon"
      )
    ).toEqual({
      milestones: [{ id: "m1", dateTime: formatScheduleDateTime(date, "afternoon") }],
    });
  });

  it("filters schedule tasks to the selected day including overdue and milestones", () => {
    const day = new Date(2026, 4, 20);
    const result = filterTasksForScheduleDate(
      [
        { id: "due", status: "open", due_date: "2026-05-20" },
        { id: "other-day", status: "open", due_date: "2026-05-21" },
        {
          id: "milestone-only",
          status: "open",
          milestones: [{ id: "m1", dateTime: "2026-05-20T09:00", label: "Inspect" }],
        },
        {
          id: "json-milestone",
          status: "open",
          milestones: JSON.stringify([{ id: "m2", dateTime: "2026-05-20T14:00" }]),
        },
        { id: "done", status: "completed", due_date: "2026-05-20" },
      ],
      day
    );

    expect(result.map((t) => t.id)).toEqual(["due", "milestone-only", "json-milestone"]);
    expect(result[1]._milestoneLabel).toBe("Inspect");
  });

  it("builds agenda from a start date forward including future days and overdue", () => {
    const from = new Date(2026, 4, 20);
    const result = filterTasksForScheduleAgenda(
      [
        { id: "overdue", status: "open", due_date: "2026-05-18" },
        { id: "today", status: "open", due_date: "2026-05-20" },
        { id: "tomorrow", status: "open", due_date: "2026-05-21" },
        {
          id: "future-milestone",
          status: "open",
          milestones: [{ id: "m1", dateTime: "2026-05-22T09:00", label: "Inspect" }],
        },
        { id: "done", status: "completed", due_date: "2026-05-21" },
      ],
      { fromDate: from, includeOverdue: true }
    );

    expect(result.map((t) => t.id)).toEqual([
      "overdue",
      "today",
      "tomorrow",
      "future-milestone",
    ]);
  });

  it("can exclude overdue from the schedule agenda", () => {
    const from = new Date(2026, 4, 20);
    const result = filterTasksForScheduleAgenda(
      [
        { id: "overdue", status: "open", due_date: "2026-05-18" },
        { id: "today", status: "open", due_date: "2026-05-20" },
      ],
      { fromDate: from, includeOverdue: false }
    );
    expect(result.map((t) => t.id)).toEqual(["today"]);
  });
});
