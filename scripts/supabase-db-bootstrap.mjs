#!/usr/bin/env node
/**
 * Read-only diagnose of the linked hosted project vs git migrations.
 * Does not repair history. Cutover: npm run db:cutover-stamp (gated).
 */
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const PROD_REF = "gbtexoyvfpnduykmxunc";

if (process.argv.includes("--repair-stale-remote") || process.argv.includes("--mark-local-applied")) {
  console.error(`
History repair is frozen.

Daily path: supabase start && supabase db reset (local Docker).
Production stamp is npm run db:cutover-stamp with FILLA_CUTOVER_CONFIRM=${PROD_REF}
after staging is proven. Never Dashboard-reset ${PROD_REF}.
`);
  process.exit(1);
}

function loadEnv() {
  if (existsSync(join(root, ".env.local"))) dotenv.config({ path: join(root, ".env.local") });
  else if (existsSync(join(root, ".env"))) dotenv.config({ path: join(root, ".env") });
}

function listLocalMigrationVersions() {
  return readdirSync(join(root, "supabase/migrations"))
    .filter((f) => /^\d{14}_.+\.sql$/.test(f))
    .map((f) => f.slice(0, 14))
    .sort();
}

async function tableExists(supabase, table) {
  const { error } = await supabase.from(table).select("*", { head: true, count: "exact" });
  if (!error) return true;
  if (error.code === "PGRST205" || error.message?.includes("does not exist")) return false;
  return null;
}

async function main() {
  loadEnv();
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  if (url.includes(PROD_REF)) {
    console.log("Linked URL looks like production", PROD_REF, "— diagnose only; will not mutate.");
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const orgExists = await tableExists(supabase, "organisations");
  const followersExists = await tableExists(supabase, "task_followers");
  const adminsExists = await tableExists(supabase, "platform_admins");

  const list = spawnSync("supabase", ["migration", "list"], { cwd: root, encoding: "utf8" });
  const migrationStdout = (list.stdout || "") + (list.stderr || "");

  console.log("\n=== Filla DB diagnose (read-only) ===\n");
  console.log("organisations:", orgExists === true ? "EXISTS" : orgExists === false ? "missing" : "unknown");
  console.log("task_followers:", followersExists === true ? "EXISTS" : followersExists === false ? "missing" : "unknown");
  console.log("platform_admins:", adminsExists === true ? "EXISTS" : adminsExists === false ? "missing" : "unknown");
  console.log("local migrations:", listLocalMigrationVersions().join(", "));
  console.log("\n--- supabase migration list ---\n");
  console.log(migrationStdout);
  console.log(`
Local rebuild: supabase start && supabase db reset
Staging:       supabase/STAGING.md
Prod cutover:  npm run db:cutover-stamp (gated)
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
