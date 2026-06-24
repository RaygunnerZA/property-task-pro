import { describe, expect, it } from "vitest";
import {
  buildCalendarPlacements,
  buildScheduleUpdate,
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
});
