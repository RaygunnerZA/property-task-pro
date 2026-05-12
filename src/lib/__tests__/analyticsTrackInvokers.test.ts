import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Matches client invocations like `track("event", {` — not `export function track(event`.
 * Guardrail for @Docs/24 §24.5 (Phase E.6).
 */
const TRACK_EVENT_INVOCATION = /\btrack\s*\(\s*["'`]/;

/**
 * Allowlist of files that may call `track()` with a string-literal event name.
 * Prefer new hooks under `src/hooks/mutations/` and document in `@Docs/24_Phase1_Observability_Spec.md` §24.5.
 */
const ALLOWED_TRACK_INVOKER_PATHS = new Set([
  "src/hooks/mutations/useCreatePropertyMutation.ts",
  "src/hooks/mutations/useCreateTaskMutation.ts",
  "src/hooks/use-file-upload.ts",
  "src/hooks/useAIExtract.ts",
  "src/hooks/useAssistant.ts",
  "src/hooks/useMarkComplianceComplete.ts",
  "src/services/ai/resolutionAudit.ts",
]);

function* walkSourceFiles(dir: string): Generator<string> {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      yield* walkSourceFiles(p);
    } else if (/\.(ts|tsx)$/.test(ent.name) && !/\.(test|spec)\.(ts|tsx)$/.test(ent.name)) {
      yield p;
    }
  }
}

describe("analytics track() invokers (E.6)", () => {
  it("only documented files invoke track() with a string event literal", () => {
    const cwd = process.cwd();
    const srcRoot = join(cwd, "src");
    const offenders: string[] = [];

    for (const abs of walkSourceFiles(srcRoot)) {
      const rel = relative(cwd, abs).replace(/\\/g, "/");
      if (rel === "src/lib/analytics.ts") continue;
      const content = readFileSync(abs, "utf8");
      if (!TRACK_EVENT_INVOCATION.test(content)) continue;
      if (!ALLOWED_TRACK_INVOKER_PATHS.has(rel)) offenders.push(rel);
    }

    expect(
      offenders,
      `Unexpected track() invocations in:\n${offenders.join("\n")}\nUpdate ALLOWED_TRACK_INVOKER_PATHS and @Docs/24 §24.5.`
    ).toEqual([]);
  });
});
