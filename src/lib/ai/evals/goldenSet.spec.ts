/**
 * Golden-set eval harness.
 *
 * Skipped unless `RUN_AI_EVALS=1`, because it calls real providers and costs
 * money. Run it with `npm run eval:ai`.
 *
 * It calls candidate models directly with the production prompt (imported from
 * the shared prompt module) rather than going through a deployed edge function,
 * so a candidate can be scored without deploying it.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildTaskExtractionPrompt } from "../../../../supabase/functions/_shared/prompts/taskExtraction.ts";
import {
  CAPABILITIES,
  STRATEGIES,
  parseJsonLoose,
} from "../../../../supabase/functions/_shared/aiRouting.ts";
import {
  claimsFromTaskExtraction,
  scoreCapability,
  type FixtureOutcome,
  type FixtureSet,
} from "./scoring";

const enabled = process.env.RUN_AI_EVALS === "1";

/** Candidate under test, e.g. EVAL_STRATEGY="model:gpt-4o-mini". */
const strategyId = process.env.EVAL_STRATEGY ?? "model:gemini-2.0-flash";

function loadFixtureSet(file: string): FixtureSet {
  const full = path.join(process.cwd(), "evals", "fixtures", file);
  return JSON.parse(readFileSync(full, "utf8")) as FixtureSet;
}

async function callOpenAiCompatible(
  endpoint: string,
  apiKey: string,
  model: string,
  prompt: string
): Promise<unknown> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${endpoint}: ${res.status} ${JSON.stringify(json)}`);
  return parseJsonLoose(json.choices?.[0]?.message?.content);
}

async function callGemini(apiKey: string, model: string, prompt: string): Promise<unknown> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(`Gemini: ${res.status} ${JSON.stringify(json)}`);
  return parseJsonLoose(json.candidates?.[0]?.content?.parts?.[0]?.text);
}

function runStrategy(prompt: string): Promise<unknown> {
  const strategy = STRATEGIES[strategyId];
  if (!strategy) throw new Error(`Unknown EVAL_STRATEGY: ${strategyId}`);

  switch (strategy.provider) {
    case "OPENAI": {
      const key = process.env.OPENAI_API_KEY;
      if (!key) throw new Error("OPENAI_API_KEY not set");
      return callOpenAiCompatible(
        "https://api.openai.com/v1/chat/completions",
        key,
        strategy.model,
        prompt
      );
    }
    case "LOVABLE": {
      const key = process.env.LOVABLE_API_KEY;
      if (!key) throw new Error("LOVABLE_API_KEY not set");
      return callOpenAiCompatible(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        key,
        strategy.model,
        prompt
      );
    }
    case "GEMINI": {
      const key = process.env.GEMINI_API_KEY;
      if (!key) throw new Error("GEMINI_API_KEY not set");
      return callGemini(key, strategy.model, prompt);
    }
    default:
      throw new Error(`Strategy ${strategyId} is not a model strategy`);
  }
}

describe.skipIf(!enabled)("task_extraction golden set", () => {
  it(
    `scores ${strategyId}`,
    async () => {
      const set = loadFixtureSet("task_extraction.json");
      const outcomes: FixtureOutcome[] = [];

      for (const fixture of set.fixtures) {
        const started = Date.now();
        try {
          const value = await runStrategy(buildTaskExtractionPrompt(fixture.input.text ?? ""));
          outcomes.push({
            id: fixture.id,
            actual:
              value && typeof value === "object"
                ? claimsFromTaskExtraction(value as Record<string, unknown>)
                : null,
            latencyMs: Date.now() - started,
          });
        } catch (err) {
          console.warn(`[eval] ${fixture.id} failed:`, err);
          outcomes.push({ id: fixture.id, actual: null, latencyMs: Date.now() - started });
        }
      }

      const score = scoreCapability(set.fixtures, outcomes);
      const promptVersion = CAPABILITIES.task_extraction.promptVersion;

      // Emitted as JSON so scripts/run-ai-eval.mjs can record it.
      console.log(
        `[eval-result] ${JSON.stringify({
          capability: set.capability,
          fixture_set: set.fixture_set,
          strategy: strategyId,
          model: STRATEGIES[strategyId]?.model,
          provider: STRATEGIES[strategyId]?.provider,
          prompt_version: promptVersion,
          ...score,
        })}`
      );

      // A run that produced nothing parseable is a failure, not a zero score.
      expect(score.schemaValidRate).toBeGreaterThan(0);
    },
    120_000
  );
});

describe("golden set harness wiring", () => {
  it("uses a known strategy and a versioned prompt", () => {
    expect(STRATEGIES[strategyId]).toBeDefined();
    expect(CAPABILITIES.task_extraction.promptVersion).toBeTruthy();
  });

  it("builds a prompt that carries the description", () => {
    expect(buildTaskExtractionPrompt("leak in the plant room")).toContain(
      "leak in the plant room"
    );
  });
});
