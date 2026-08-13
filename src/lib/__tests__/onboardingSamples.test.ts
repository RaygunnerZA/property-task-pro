import { describe, expect, it, beforeEach } from "vitest";
import {
  ONBOARDING_NEEDS_ATTENTION,
  ONBOARDING_QUICK_WINS,
  ONBOARDING_RECORDS,
  ONBOARDING_SIGNALS,
} from "@/fixtures/onboardingAttentionSamples";
import {
  dismissOnboardingSample,
  isOnboardingSampleNotification,
  ONBOARDING_SAMPLE_LABEL,
  readDismissedOnboardingSampleIds,
} from "@/lib/onboardingEducation";

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
    },
  });
});

describe("onboarding sample notifications", () => {
  const samples = [
    ...ONBOARDING_NEEDS_ATTENTION,
    ...ONBOARDING_SIGNALS,
    ...ONBOARDING_RECORDS,
  ];

  it("labels sample rows DEMO CONTENT with a DELETE THIS action", () => {
    expect(samples.length).toBeGreaterThan(0);
    for (const item of samples) {
      expect(isOnboardingSampleNotification(item)).toBe(true);
      expect(item.context).toBe(ONBOARDING_SAMPLE_LABEL);
      expect(item.fixtureActions?.primary).toEqual({
        id: "delete-sample",
        label: "DELETE THIS",
      });
      expect(item.title.toLowerCase()).toMatch(/^how /);
    }
  });

  it("does not treat Quick wins as sample notifications", () => {
    for (const item of ONBOARDING_QUICK_WINS) {
      expect(isOnboardingSampleNotification(item)).toBe(false);
      expect(item.fixtureActions?.primary.label).not.toBe("DELETE THIS");
      expect(item.context).not.toBe(ONBOARDING_SAMPLE_LABEL);
    }
  });

  it("persists deleted sample ids per property", () => {
    const id = ONBOARDING_NEEDS_ATTENTION[0]?.id ?? "onboarding:review:fire-ext";
    dismissOnboardingSample("prop-1", id);
    expect(readDismissedOnboardingSampleIds("prop-1").has(id)).toBe(true);
    expect(readDismissedOnboardingSampleIds("prop-2").has(id)).toBe(false);
  });
});
