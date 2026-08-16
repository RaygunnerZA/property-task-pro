#!/usr/bin/env node
/**
 * Golden-set eval runner.
 *
 * Wraps the Vitest harness (src/lib/ai/evals/goldenSet.spec.ts) so evals are one
 * command, and optionally records the result to ai_capability_evals.
 *
 *   npm run eval:ai                                  # wiring check only
 *   RUN_AI_EVALS=1 npm run eval:ai                   # calls the default strategy
 *   RUN_AI_EVALS=1 npm run eval:ai -- --strategy model:gpt-4o-mini
 *   RUN_AI_EVALS=1 RECORD_EVAL=1 npm run eval:ai     # also write to the database
 *
 * Recording needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, because
 * record_ai_capability_eval is service-role only.
 */

import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const strategyFlag = args.indexOf("--strategy");
const strategy = strategyFlag !== -1 ? args[strategyFlag + 1] : process.env.EVAL_STRATEGY;

const SPEC = "src/lib/ai/evals/goldenSet.spec.ts";

if (process.env.RUN_AI_EVALS !== "1") {
  console.log(
    "RUN_AI_EVALS is not set — running the wiring check only, no provider calls.\n" +
      "Set RUN_AI_EVALS=1 to score a candidate against the golden set."
  );
}

const child = spawn("npx", ["vitest", "run", SPEC, "--reporter=verbose"], {
  env: { ...process.env, ...(strategy ? { EVAL_STRATEGY: strategy } : {}) },
  stdio: ["inherit", "pipe", "inherit"],
});

let stdout = "";
child.stdout.on("data", (chunk) => {
  const text = chunk.toString();
  stdout += text;
  process.stdout.write(text);
});

child.on("close", async (code) => {
  if (code !== 0) process.exit(code ?? 1);

  const match = stdout.match(/\[eval-result\] (\{.*\})/);
  if (!match) {
    if (process.env.RUN_AI_EVALS === "1") {
      console.error("No [eval-result] line found — nothing to record.");
      process.exit(1);
    }
    process.exit(0);
  }

  const result = JSON.parse(match[1]);
  console.log(
    `\nScore for ${result.model} (${result.prompt_version}) on ${result.fixture_set}:\n` +
      `  recall              ${result.recall}\n` +
      `  false positive rate ${result.falsePositiveRate}\n` +
      `  schema valid rate   ${result.schemaValidRate}\n` +
      `  latency p50         ${result.latencyMsP50}ms\n` +
      `  fixtures            ${result.fixtureCount}`
  );

  if (process.env.RECORD_EVAL !== "1") {
    console.log("\nSet RECORD_EVAL=1 to store this run in ai_capability_evals.");
    return;
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("RECORD_EVAL=1 needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const res = await fetch(`${url}/rest/v1/rpc/record_ai_capability_eval`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_capability: result.capability,
      p_model: result.model,
      p_prompt_version: result.prompt_version,
      p_provider: result.provider,
      p_fixture_set: result.fixture_set,
      p_fixture_count: result.fixtureCount,
      p_recall: result.recall,
      p_false_positive_rate: result.falsePositiveRate,
      p_schema_valid_rate: result.schemaValidRate,
      p_latency_ms_p50: result.latencyMsP50,
      p_cost_usd: result.costUsd,
      p_detail: { fixtures: result.detail },
      p_notes: `strategy ${result.strategy}`,
    }),
  });

  if (!res.ok) {
    console.error(`Failed to record eval: ${res.status} ${await res.text()}`);
    process.exit(1);
  }

  console.log("Recorded to ai_capability_evals.");
});
