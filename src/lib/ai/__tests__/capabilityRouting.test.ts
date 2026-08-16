import { describe, expect, it } from "vitest";
import {
  CAPABILITIES,
  SchemaError,
  STRATEGIES,
  isRetryableFailure,
  normaliseProvider,
  parseJsonLoose,
  resolveStrategies,
  type Provider,
} from "../../../../supabase/functions/_shared/aiRouting.ts";

const allProviders: Provider[] = ["GEMINI", "OPENAI", "LOVABLE"];

const ids = (strategies: { id: string }[]) => strategies.map((s) => s.id);

describe("normaliseProvider", () => {
  it("reads the historically inconsistent AI_PROVIDER spellings the same way", () => {
    expect(normaliseProvider("gemini")).toBe("GEMINI");
    expect(normaliseProvider("GEMINI")).toBe("GEMINI");
    expect(normaliseProvider("openai")).toBe("OPENAI");
    expect(normaliseProvider("OPENAI")).toBe("OPENAI");
    expect(normaliseProvider("gpt-4o-mini")).toBe("OPENAI");
    expect(normaliseProvider("LOVABLE")).toBe("LOVABLE");
  });

  it("returns null for missing or unknown values", () => {
    expect(normaliseProvider(null)).toBeNull();
    expect(normaliseProvider("")).toBeNull();
    expect(normaliseProvider("something-else")).toBeNull();
  });
});

describe("resolveStrategies requirements", () => {
  it("excludes models that cannot accept a PDF when the input is a PDF", () => {
    const resolved = resolveStrategies("document_analysis", {
      availableProviders: allProviders,
      input: { pdf: true },
    });

    expect(ids(resolved)).toContain("model:gemini-2.0-flash");
    expect(ids(resolved)).not.toContain("model:gpt-4o-mini");
  });

  it("allows the OpenAI model for non-PDF documents", () => {
    const resolved = resolveStrategies("document_analysis", {
      availableProviders: allProviders,
      input: { pdf: false },
    });

    expect(ids(resolved)).toContain("model:gpt-4o-mini");
  });

  it("drops strategies whose provider has no credentials", () => {
    const resolved = resolveStrategies("photo_asset_identification", {
      availableProviders: ["OPENAI"],
    });

    expect(ids(resolved)).toEqual(["model:gpt-4o-mini"]);
  });

  it("falls back to a deterministic strategy when no provider is configured", () => {
    const resolved = resolveStrategies("task_extraction", {
      availableProviders: [],
    });

    expect(ids(resolved)).toEqual(["deterministic:rule-based-task"]);
  });

  it("returns nothing for a vision capability with no vision-capable strategy", () => {
    const resolved = resolveStrategies("document_analysis", {
      availableProviders: [],
    });

    expect(resolved).toEqual([]);
  });
});

describe("resolveStrategies ordering", () => {
  it("puts the preferred provider first without losing the remaining fallbacks", () => {
    const resolved = resolveStrategies("document_analysis", {
      availableProviders: allProviders,
      preferred: "OPENAI",
    });

    expect(ids(resolved)[0]).toBe("model:gpt-4o-mini");
    expect(ids(resolved)).toContain("model:gemini-2.0-flash");
  });

  it("keeps the declared order when no preference is set", () => {
    const resolved = resolveStrategies("document_analysis", {
      availableProviders: allProviders,
    });

    expect(ids(resolved)).toEqual(["model:gemini-2.0-flash", "model:gpt-4o-mini"]);
  });

  it("pins an override first but retains fallbacks", () => {
    const resolved = resolveStrategies("document_analysis", {
      availableProviders: allProviders,
      override: "model:gpt-4o-mini",
    });

    expect(ids(resolved)[0]).toBe("model:gpt-4o-mini");
    expect(ids(resolved)).toContain("model:gemini-2.0-flash");
  });

  it("ignores an unknown override rather than failing the call", () => {
    const resolved = resolveStrategies("document_analysis", {
      availableProviders: allProviders,
      override: "model:does-not-exist",
    });

    expect(ids(resolved)).toEqual(["model:gemini-2.0-flash", "model:gpt-4o-mini"]);
  });

  it("does not duplicate a strategy that was already in the declared order", () => {
    const resolved = resolveStrategies("document_analysis", {
      availableProviders: allProviders,
      override: "model:gpt-4o-mini",
    });

    expect(ids(resolved)).toEqual(["model:gpt-4o-mini", "model:gemini-2.0-flash"]);
  });

  it("still applies capability requirements to an override", () => {
    // gpt-4o-mini cannot take a PDF, so pinning it must not force a PDF through it.
    const resolved = resolveStrategies("document_analysis", {
      availableProviders: allProviders,
      override: "model:gpt-4o-mini",
      input: { pdf: true },
    });

    expect(ids(resolved)).not.toContain("model:gpt-4o-mini");
    expect(ids(resolved)).toEqual(["model:gemini-2.0-flash"]);
  });

  it("still applies credential availability to an override", () => {
    const resolved = resolveStrategies("document_analysis", {
      availableProviders: ["GEMINI"],
      override: "model:gpt-4o-mini",
    });

    expect(ids(resolved)).toEqual(["model:gemini-2.0-flash"]);
  });
});

describe("knowledge critic provider distinctness (Ch 7)", () => {
  it("is declared as requiring a distinct provider", () => {
    expect(CAPABILITIES.knowledge_critique.requireDistinctProvider).toBe(true);
  });

  it("never resolves to the extractor's provider, for any provider", () => {
    for (const extractor of allProviders) {
      const resolved = resolveStrategies("knowledge_critique", {
        availableProviders: allProviders,
        mustDifferFrom: extractor,
      });

      expect(resolved.length).toBeGreaterThan(0);
      for (const strategy of resolved) {
        expect(strategy.provider).not.toBe(extractor);
      }
    }
  });

  it("respects the extractor provider even when it is the preferred provider", () => {
    const resolved = resolveStrategies("knowledge_critique", {
      availableProviders: allProviders,
      preferred: "OPENAI",
      mustDifferFrom: "OPENAI",
    });

    for (const strategy of resolved) {
      expect(strategy.provider).not.toBe("OPENAI");
    }
  });

  it("yields no strategy rather than reusing the only available provider", () => {
    const resolved = resolveStrategies("knowledge_critique", {
      availableProviders: ["OPENAI"],
      mustDifferFrom: "gpt-4o-mini",
    });

    expect(resolved).toEqual([]);
  });

  it("cannot be overridden by an admin route pin", () => {
    // A pin is an operational lever, not a licence to break a constitutional rule.
    const resolved = resolveStrategies("knowledge_critique", {
      availableProviders: allProviders,
      override: "model:gpt-4o-mini",
      mustDifferFrom: "OPENAI",
    });

    expect(ids(resolved)).not.toContain("model:gpt-4o-mini");
    for (const strategy of resolved) {
      expect(strategy.provider).not.toBe("OPENAI");
    }
  });

  it("does not constrain providers for capabilities without the rule", () => {
    const resolved = resolveStrategies("document_analysis", {
      availableProviders: allProviders,
      mustDifferFrom: "GEMINI",
    });

    expect(ids(resolved)).toContain("model:gemini-2.0-flash");
  });
});

describe("capability definitions", () => {
  it("only references strategies that exist in the registry", () => {
    for (const [capability, def] of Object.entries(CAPABILITIES)) {
      for (const id of def.order) {
        expect(STRATEGIES[id], `${capability} references unknown strategy ${id}`).toBeDefined();
      }
    }
  });

  it("pins a prompt version for every capability", () => {
    for (const def of Object.values(CAPABILITIES)) {
      expect(def.promptVersion).toBeTruthy();
    }
  });
});

describe("parseJsonLoose", () => {
  it("parses plain JSON", () => {
    expect(parseJsonLoose('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses fenced JSON", () => {
    expect(parseJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonLoose('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("throws SchemaError on invalid JSON", () => {
    expect(() => parseJsonLoose("not json")).toThrow(SchemaError);
  });

  it("throws SchemaError on an empty response", () => {
    expect(() => parseJsonLoose("")).toThrow(SchemaError);
  });
});

describe("isRetryableFailure", () => {
  it("retries a bad shape but not a transport failure", () => {
    expect(isRetryableFailure(new SchemaError("bad shape"))).toBe(true);
    expect(isRetryableFailure(new Error("HTTP 500"))).toBe(false);
    expect(isRetryableFailure(null)).toBe(false);
  });
});
