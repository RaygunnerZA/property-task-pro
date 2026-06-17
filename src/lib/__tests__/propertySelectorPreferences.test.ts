import { describe, expect, it, beforeEach } from "vitest";
import {
  getEffectiveDefaultPropertyId,
  getLearnedDefaultPropertyId,
  getPinnedDefaultPropertyId,
  isPropertyPinnedDefault,
  recordPropertySelection,
  setPinnedDefaultPropertyId,
} from "@/lib/propertySelectorPreferences";

const ORG = "org-test-1";

function installLocalStorageMock() {
  const store = new Map<string, string>();
  const mock = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
  Object.defineProperty(globalThis, "localStorage", { value: mock, configurable: true });
}

describe("propertySelectorPreferences", () => {
  beforeEach(() => {
    installLocalStorageMock();
    localStorage.clear();
  });

  it("pins and clears default property", () => {
    setPinnedDefaultPropertyId(ORG, "prop-a");
    expect(isPropertyPinnedDefault(ORG, "prop-a")).toBe(true);
    expect(getEffectiveDefaultPropertyId(ORG)).toBe("prop-a");

    setPinnedDefaultPropertyId(ORG, null);
    expect(isPropertyPinnedDefault(ORG, "prop-a")).toBe(false);
  });

  it("learns default after five selections", () => {
    for (let i = 0; i < 4; i++) {
      recordPropertySelection(ORG, "prop-b");
    }
    expect(getLearnedDefaultPropertyId(ORG)).toBeNull();

    recordPropertySelection(ORG, "prop-b");
    expect(getLearnedDefaultPropertyId(ORG)).toBe("prop-b");
    expect(getEffectiveDefaultPropertyId(ORG)).toBe("prop-b");
  });

  it("prefers pinned default over learned default", () => {
    for (let i = 0; i < 5; i++) {
      recordPropertySelection(ORG, "prop-b");
    }
    setPinnedDefaultPropertyId(ORG, "prop-a");
    expect(getEffectiveDefaultPropertyId(ORG)).toBe("prop-a");
  });
});
