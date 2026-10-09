import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dismissDescription,
  isDescriptionDismissed,
  localDescriptionDay,
} from "@/lib/ephemeralDescription";

const memory = new Map<string, string>();

vi.stubGlobal("localStorage", {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memory.set(key, value);
  },
  removeItem: (key: string) => {
    memory.delete(key);
  },
  clear: () => {
    memory.clear();
  },
});

describe("ephemeral screen descriptions", () => {
  afterEach(() => {
    memory.clear();
  });

  it("stays open until dismissed, then stays closed for that local day", () => {
    const today = new Date(2026, 9, 9, 15, 0, 0);
    expect(isDescriptionDismissed("tasks:all", today)).toBe(false);
    dismissDescription("tasks:all", today);
    expect(isDescriptionDismissed("tasks:all", today)).toBe(true);
    expect(isDescriptionDismissed("tasks:urgent", today)).toBe(false);
  });

  it("shows the description again on the next local day", () => {
    dismissDescription("calendar:calendar", new Date(2026, 9, 9, 12, 0, 0));
    expect(isDescriptionDismissed("calendar:calendar", new Date(2026, 9, 10, 8, 0, 0))).toBe(
      false
    );
  });

  it("keys the day in local time", () => {
    expect(localDescriptionDay(new Date(2026, 9, 9, 23, 30, 0))).toBe("2026-10-09");
  });
});
