#!/usr/bin/env node
/**
 * Apply partial-remote schema repair to the linked Supabase project.
 *
 * Requires in .env.local:
 *   SUPABASE_DB_PASSWORD  (Dashboard → Project Settings → Database)
 *
 * Usage:
 *   node scripts/apply-partial-remote-repair.mjs
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const MIGRATION = join(
  root,
  "supabase/migrations/20260602150000_ensure_partial_remote_schema.sql"
);
const MIGRATION_PART2 = join(
  root,
  "supabase/migrations/20260602160000_ensure_partial_remote_schema_part2.sql"
);
const LOG_PATH = join(root, ".cursor/debug-b975f1.log");

function loadEnv() {
  if (existsSync(join(root, ".env.local"))) {
    dotenv.config({ path: join(root, ".env.local") });
  }
}

function agentLog(message, data, hypothesisId, runId = "repair") {
  const line = JSON.stringify({
    sessionId: "b975f1",
    timestamp: Date.now(),
    location: "apply-partial-remote-repair.mjs",
    message,
    hypothesisId,
    data,
    runId,
  });
  try {
    appendFileSync(LOG_PATH, line + "\n");
  } catch {
    /* ignore */
  }
  fetch("http://127.0.0.1:7410/ingest/6d369163-f131-49c2-8952-c57e2a819080", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "b975f1",
    },
    body: line,
  }).catch(() => {});
}

async function probeAfterRepair() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const orgId = "6614b500-5c85-495c-a237-5bcf73dff4a1";
  const sb = createClient(url, key);
  const checks = [
    "themes",
    "tasks_view",
    "properties_view",
    "compliance_portfolio_view",
    "property_details",
    "attachments",
  ];
  const results = {};
  for (const table of checks) {
    const { error } = await sb.from(table).select("id").eq("org_id", orgId).limit(1);
    results[table] = error ? { code: error.code, message: error.message } : { ok: true };
  }
  const { error: colErr } = await sb
    .from("organisation_members")
    .select("assigned_properties")
    .limit(1);
  results.assigned_properties = colErr
    ? { code: colErr.code, message: colErr.message }
    : { ok: true };
  return results;
}

async function main() {
  loadEnv();
  const password = process.env.SUPABASE_DB_PASSWORD;
  const ref =
    process.env.VITE_SUPABASE_URL?.match(/https:\/\/([^.]+)/)?.[1] ??
    "gbtexoyvfpnduykmxunc";

  if (!password) {
    console.error(`
Missing SUPABASE_DB_PASSWORD in .env.local

1. Open https://supabase.com/dashboard/project/${ref}/settings/database
2. Copy the database password (or reset it)
3. Add to .env.local:  SUPABASE_DB_PASSWORD=your-password
4. Re-run: node scripts/apply-partial-remote-repair.mjs

Or paste these files in SQL Editor and run manually:
  supabase/migrations/20260602150000_ensure_partial_remote_schema.sql
  supabase/migrations/20260602160000_ensure_partial_remote_schema_part2.sql
`);
    process.exit(1);
  }

  const dbUrl = `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-1-eu-central-1.pooler.supabase.com:5432/postgres`;

  console.log(`Applying schema repair (part 1) to ${ref}…`);
  for (const [label, file] of [
    ["part 1", MIGRATION],
    ["part 2", MIGRATION_PART2],
  ]) {
    const result = spawnSync(
      "supabase",
      ["db", "query", "--db-url", dbUrl, "-f", file],
      { cwd: root, encoding: "utf8" }
    );

    if (result.status !== 0) {
      console.error(`${label} failed:`, result.stdout || result.stderr || "db query failed");
      agentLog("repair failed", { label, exitCode: result.status, stderr: result.stderr }, "H1");
      process.exit(result.status ?? 1);
    }
    console.log(`${label} applied.`);
  }

  console.log("Schema repair applied. Verifying via REST…");
  const probe = await probeAfterRepair();
  agentLog("post-repair probe", probe, "H1", "post-fix");
  console.log(JSON.stringify(probe, null, 2));

  const failed = Object.entries(probe).filter(([, v]) => !("ok" in v && v.ok));
  if (failed.length) {
    console.error("Some relations still failing:", failed);
    process.exit(1);
  }
  console.log("Done — themes, views, and assigned_properties are available.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
