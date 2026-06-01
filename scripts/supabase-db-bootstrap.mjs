#!/usr/bin/env node
/**
 * Diagnose remote DB vs migration history and print recovery steps.
 *
 * Usage:
 *   node scripts/supabase-db-bootstrap.mjs
 *   node scripts/supabase-db-bootstrap.mjs --repair-stale-remote
 *
 * Requires .env.local: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const LOG_PATH = join(root, ".cursor/debug-c349f9.log");
const INIT_VERSION = "20251218201715";

const STALE_REMOTE_VERSIONS = [
  "20251208190515", "20251208195211", "20251209135842", "20251209140114",
  "20251209140500", "20251209140926", "20251209141012", "20251209141205",
  "20251209141526", "20251209141609", "20251209141739", "20251209141817",
  "20251209142001", "20251209142038", "20251209142121", "20251209142153",
  "20251209142238", "20251209142512", "20251209142719", "20251209142837",
  "20251209142923", "20251209143025", "20251209143114", "20251209143208",
  "20251209143332", "20251209143342", "20251209143451", "20251209143549",
  "20251209143650", "20251209143726", "20251209143801", "20251209143837",
  "20251209143924", "20251209144034", "20251209144215", "20251209144253",
  "20251209144338", "20251209144430", "20251209144635", "20251209144751",
  "20251209144851", "20251209145004", "20251209145122", "20251209145242",
  "20251209145604", "20251210215923", "20251210220503", "20251210220808",
  "20251210221026", "20251210221316", "20251210221449", "20251210221638",
  "20251210221901",
];

function loadEnv() {
  if (existsSync(join(root, ".env.local"))) {
    dotenv.config({ path: join(root, ".env.local") });
  } else if (existsSync(join(root, ".env"))) {
    dotenv.config({ path: join(root, ".env") });
  }
}

function agentLog(message, data, hypothesisId) {
  const line = JSON.stringify({
    sessionId: "c349f9",
    timestamp: Date.now(),
    location: "supabase-db-bootstrap.mjs",
    message,
    hypothesisId,
    data,
    runId: "bootstrap",
  });
  try {
    appendFileSync(LOG_PATH, line + "\n");
  } catch {
    /* ignore */
  }
  fetch("http://127.0.0.1:7489/ingest/d316ba9e-0be2-4ce9-a7ae-7380d7b3193b", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "c349f9",
    },
    body: line,
  }).catch(() => {});
}

async function tableExists(supabase, table) {
  const { error } = await supabase.from(table).select("*", { head: true, count: "exact" });
  if (!error) return true;
  if (error.code === "PGRST205" || error.message?.includes("does not exist")) return false;
  return null;
}

function parseMigrationList(stdout) {
  const applied = new Set();
  const pending = new Set();
  for (const line of stdout.split("\n")) {
    const m = line.match(/\|\s*(\d{14})\s*\|/);
    if (!m) continue;
    if (line.includes("Applied")) applied.add(m[1]);
    if (line.includes("Pending") || line.includes("Local")) pending.add(m[1]);
  }
  return { applied, raw: stdout };
}

async function main() {
  loadEnv();
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const repairStale = process.argv.includes("--repair-stale-remote");

  if (!url || !key) {
    console.error("Missing VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const orgExists = await tableExists(supabase, "organisations");
  const attachmentsExists = await tableExists(supabase, "attachments");

  const list = spawnSync("supabase", ["migration", "list"], {
    cwd: root,
    encoding: "utf8",
  });
  const migrationStdout = (list.stdout || "") + (list.stderr || "");
  const initApplied = migrationStdout.includes(INIT_VERSION) &&
    migrationStdout.includes("Applied");

  agentLog("diagnose", {
    orgExists,
    attachmentsExists,
    initApplied,
    listExitCode: list.status,
  }, "H1-H3");

  console.log("\n=== Filla Supabase DB bootstrap ===\n");
  console.log("Remote:", url.replace(/https?:\/\//, "").split(".")[0], "…");
  console.log("organisations table:", orgExists === true ? "EXISTS" : orgExists === false ? "missing" : "unknown");
  console.log("attachments table:", attachmentsExists === true ? "EXISTS" : attachmentsExists === false ? "missing" : "unknown");
  console.log(`${INIT_VERSION} (filla_v2_init) in migration list as Applied:`, initApplied ? "yes" : "no / pending");

  if (repairStale) {
    console.log("\nRepairing stale Dec 2025 remote-only migration IDs (reverted)…");
    const r = spawnSync(
      "supabase",
      ["migration", "repair", "--status", "reverted", ...STALE_REMOTE_VERSIONS],
      { cwd: root, stdio: "inherit" }
    );
    if (r.status !== 0) process.exit(r.status ?? 1);
    console.log("Done. Run: npm run db:push\n");
    return;
  }

  if (orgExists && !initApplied) {
    console.log(`
BLOCKED: Schema drift — tables exist but filla_v2_init is not recorded as applied.
This causes: ERROR relation "organisations" already exists on db push.

Fix (dev):
  1. Supabase Dashboard → Project Settings → Database → Reset database
  2. Wait until Table Editor shows no tables
  3. npm run db:push

If you still see remote-only Dec 2025 migration errors first:
  node scripts/supabase-db-bootstrap.mjs --repair-stale-remote
  npm run db:push
`);
    process.exit(1);
  }

  if (!orgExists) {
    console.log(`
Ready for a clean push (no organisations table detected).
  npm run db:push

Active migrations start at ${INIT_VERSION}_filla_v2_init.sql
(legacy 202501/202502 patches are archived under supabase/migrations/archive/)
`);
    process.exit(0);
  }

  console.log(`
Database appears initialized. If the app works, you are done.
To re-apply all migrations from scratch, reset the database in the Dashboard first.
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
