import { describe, it, expect } from "vitest";
import { includesMeetingSignal, minuteKeyFromDate } from "../createTaskModalMeetingSignals";

describe("createTaskModalMeetingSignals", () => {
  it("minuteKeyFromDate returns YYYY-MM-DDTHH:mm", () => {
    const key = minuteKeyFromDate(new Date(2025, 5, 10, 9, 7, 0));
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("includesMeetingSignal detects meeting keyword in title", () => {
    expect(includesMeetingSignal({ title: "Team meeting", description: "" })).toBe(true);
  });

  it("includesMeetingSignal is false for unrelated title", () => {
    expect(includesMeetingSignal({ title: "Fix leak", description: "Kitchen" })).toBe(false);
  });
});
