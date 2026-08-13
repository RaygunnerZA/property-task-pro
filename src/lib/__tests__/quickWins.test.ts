import { describe, expect, it, beforeEach } from "vitest";
import { ONBOARDING_QUICK_WINS } from "@/fixtures/onboardingAttentionSamples";
import {
  markQuickWinComplete,
  quickWinIdFromAttentionId,
  readCompletedQuickWins,
  writeCompletedQuickWins,
} from "@/lib/quickWins";

const memory = new Map<string, string>();

beforeEach(() => {
  memory.clear();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: (key: string, value: string) => {
          memory.set(key, value);
        },
        clear: () => memory.clear(),
      },
      dispatchEvent: () => true,
      setTimeout: globalThis.setTimeout.bind(globalThis),
    },
  });
});

describe("quickWins", () => {
  it("maps fixture attention ids", () => {
    expect(quickWinIdFromAttentionId("onboarding:quick:upload")).toBe("upload");
    expect(quickWinIdFromAttentionId("onboarding:quick:profile")).toBe("profile");
    expect(quickWinIdFromAttentionId("onboarding:review:fire-ext")).toBeNull();
  });

  it("does not invite drag-and-drop onto the Upload card", () => {
    const upload = ONBOARDING_QUICK_WINS.find((item) => item.id === "onboarding:quick:upload");
    expect(upload).toBeDefined();
    const blob = `${upload?.context ?? ""} ${upload?.description ?? ""}`.toLowerCase();
    expect(blob).not.toMatch(/drag and drop/);
    expect(blob).toMatch(/add record/);
  });

  it("marks a win once per property", () => {
    expect(markQuickWinComplete("upload", "prop-1")).toBe(true);
    expect(markQuickWinComplete("upload", "prop-1")).toBe(false);
    expect(readCompletedQuickWins("prop-1").has("upload")).toBe(true);
    expect(readCompletedQuickWins("prop-2").has("upload")).toBe(false);
  });

  it("hydrates from storage", () => {
    writeCompletedQuickWins("prop-1", new Set(["profile", "task"]));
    const ids = readCompletedQuickWins("prop-1");
    expect([...ids].sort()).toEqual(["profile", "task"]);
  });
});
