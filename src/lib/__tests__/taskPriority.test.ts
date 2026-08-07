import { describe, expect, it } from "vitest";
import { taskPriorityLabel, toTaskPriorityDb } from "@/lib/taskPriority";

describe("toTaskPriorityDb", () => {
  it("maps normal to medium for DB check constraint", () => {
    expect(toTaskPriorityDb("normal")).toBe("medium");
    expect(toTaskPriorityDb("NORMAL")).toBe("medium");
  });

  it("passes through allowed values", () => {
    expect(toTaskPriorityDb("low")).toBe("low");
    expect(toTaskPriorityDb("medium")).toBe("medium");
    expect(toTaskPriorityDb("high")).toBe("high");
    expect(toTaskPriorityDb("urgent")).toBe("urgent");
  });

  it("defaults unknown to medium", () => {
    expect(toTaskPriorityDb(null)).toBe("medium");
    expect(toTaskPriorityDb("asap")).toBe("medium");
  });
});

describe("taskPriorityLabel", () => {
  it("shows NORMAL for medium", () => {
    expect(taskPriorityLabel("medium")).toBe("NORMAL");
    expect(taskPriorityLabel("normal")).toBe("NORMAL");
    expect(taskPriorityLabel("urgent")).toBe("URGENT");
  });
});
