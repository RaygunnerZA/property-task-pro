import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  getTaskCommentSeenAt,
  isTaskCommentSignalNew,
  markTaskCommentSeen,
} from "@/lib/taskCommentSeen";

const store = new Map<string, string>();

vi.stubGlobal("localStorage", {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, value);
  },
  removeItem: (key: string) => {
    store.delete(key);
  },
  clear: () => {
    store.clear();
  },
  key: () => null,
  length: 0,
});

vi.stubGlobal("window", {
  dispatchEvent: () => true,
});

describe("taskCommentSeen", () => {
  beforeEach(() => {
    store.clear();
  });

  afterEach(() => {
    store.clear();
  });

  it("treats unseen other-author comments as new", () => {
    expect(
      isTaskCommentSignalNew({
        taskId: "t1",
        createdAt: "2026-08-05T12:00:00.000Z",
        authorUserId: "other",
        currentUserId: "me",
      })
    ).toBe(true);
  });

  it("ignores own comments", () => {
    expect(
      isTaskCommentSignalNew({
        taskId: "t1",
        createdAt: "2026-08-05T12:00:00.000Z",
        authorUserId: "me",
        currentUserId: "me",
      })
    ).toBe(false);
  });

  it("clears after mark seen when comment is older", () => {
    markTaskCommentSeen("t1", "2026-08-05T13:00:00.000Z");
    expect(getTaskCommentSeenAt("t1")).toBe("2026-08-05T13:00:00.000Z");
    expect(
      isTaskCommentSignalNew({
        taskId: "t1",
        createdAt: "2026-08-05T12:00:00.000Z",
        authorUserId: "other",
        currentUserId: "me",
      })
    ).toBe(false);
  });

  it("shows again when a newer comment arrives after seen", () => {
    markTaskCommentSeen("t1", "2026-08-05T12:00:00.000Z");
    expect(
      isTaskCommentSignalNew({
        taskId: "t1",
        createdAt: "2026-08-05T14:00:00.000Z",
        authorUserId: "other",
        currentUserId: "me",
      })
    ).toBe(true);
  });
});
