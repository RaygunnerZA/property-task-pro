import { describe, expect, it, beforeEach } from "vitest";
import {
  ONBOARDING_NEEDS_ATTENTION,
  ONBOARDING_QUICK_WINS,
  ONBOARDING_RECORDS,
  ONBOARDING_SIGNALS,
} from "@/fixtures/onboardingAttentionSamples";
import {
  dismissOnboardingSample,
  getSampleContentLesson,
  isOnboardingSampleNotification,
  isSeededSampleContent,
  ONBOARDING_SAMPLE_LABEL,
  readDismissedOnboardingSampleIds,
  seededSampleDismissId,
  shouldAutoHideSeededSamples,
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

describe("seeded sample content lifecycle", () => {
  it("detects (sample) titles and onboarding_demo markers", () => {
    expect(
      isSeededSampleContent({ title: "Gas Safety Certificate (sample)" })
    ).toBe(true);
    expect(
      isSeededSampleContent({
        title: "EICR (sample - due soon)",
        notes: "Shows the renewal state. [onboarding_demo]",
      })
    ).toBe(true);
    expect(isSeededSampleContent({ title: "Real Gas Safety 2026" })).toBe(false);
    expect(
      isSeededSampleContent({ metadata: { onboarding_demo: true } })
    ).toBe(true);
  });

  it("auto-hides samples once real content exists", () => {
    expect(shouldAutoHideSeededSamples({ realItemCount: 0 })).toBe(false);
    expect(shouldAutoHideSeededSamples({ realItemCount: 1 })).toBe(true);
  });

  it("builds stable dismiss ids and section lessons with a phase-out promise", () => {
    expect(seededSampleDismissId("compliance", "abc")).toBe("seeded:compliance:abc");
    const lesson = getSampleContentLesson("records");
    expect(lesson.purpose.length).toBeGreaterThan(20);
    expect(lesson.sampleExplanation.toLowerCase()).toMatch(/sample/);
    expect(lesson.phaseOut.toLowerCase()).toMatch(/disappear|hide|not come back/);
  });
});
