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
import { existsSync, readFileSync } from "node:fs";
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
const MIGRATION_PART3 = join(
  root,
  "supabase/migrations/20260602170000_ensure_assets_and_compliance_view.sql"
);
const MIGRATION_PART4 = join(
  root,
  "supabase/migrations/20260602180000_ensure_ai_icon_search_rpc.sql"
);
const MIGRATION_PART5 = join(
  root,
  "supabase/migrations/20260602190000_ensure_entity_icon_name_columns.sql"
);
const MIGRATION_PART6 = join(
  root,
  "supabase/migrations/20260602200000_ensure_space_junctions_and_assets_view.sql"
);
const MIGRATION_PART7 = join(
  root,
  "supabase/migrations/20260602210000_ensure_onboarding_demo_seed.sql"
);
const MIGRATION_PART8 = join(
  root,
  "supabase/migrations/20260602220000_ensure_space_types_default_icon.sql"
);
function loadEnv() {
  if (existsSync(join(root, ".env.local"))) {
    dotenv.config({ path: join(root, ".env.local") });
  }
}

/** Run a migration file (multi-statement). supabase db query -f only allows one statement. */
function runSqlFile(dbUrl, file) {
  const psql = spawnSync("which", ["psql"], { encoding: "utf8" });
  if (psql.status === 0 && psql.stdout.trim()) {
    const result = spawnSync(
      "psql",
      [dbUrl, "-v", "ON_ERROR_STOP=1", "-f", file],
      { cwd: root, encoding: "utf8", env: { ...process.env, PGSSLMODE: "require" } }
    );
    return {
      ok: result.status === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.status,
    };
  }

  // Fallback: one statement per supabase db query (fragile for DO $$ blocks)
  const sql = readFileSync(file, "utf8");
  const statements = splitSqlStatements(sql);
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const result = spawnSync("supabase", ["db", "query", "--db-url", dbUrl, stmt], {
      cwd: root,
      encoding: "utf8",
    });
    if (result.status !== 0) {
      return {
        ok: false,
        stdout: result.stdout,
        stderr: result.stderr || `statement ${i + 1}/${statements.length} failed`,
        exitCode: result.status,
      };
    }
  }
  return { ok: true, stdout: "", stderr: "", exitCode: 0 };
}

/** Split SQL on semicolons outside quotes and dollar-quoted bodies. */
function splitSqlStatements(sql) {
  const out = [];
  let buf = "";
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  let dollarTag = null;

  while (i < sql.length) {
    const ch = sql[i];
    const next2 = sql.slice(i, i + 2);

    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) {
        buf += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      buf += ch;
      i++;
      continue;
    }

    if (!inSingle && !inDouble && ch === "$") {
      const m = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (m) {
        dollarTag = m[0];
        buf += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }

    if (!inDouble && ch === "'" && next2 === "''") {
      buf += "''";
      i += 2;
      continue;
    }
    if (!inDouble && ch === "'") {
      inSingle = !inSingle;
      buf += ch;
      i++;
      continue;
    }
    if (!inSingle && ch === '"') {
      inDouble = !inDouble;
      buf += ch;
      i++;
      continue;
    }

    if (!inSingle && !inDouble && ch === ";") {
      const trimmed = buf.trim();
      if (trimmed && !trimmed.startsWith("--")) out.push(trimmed);
      buf = "";
      i++;
      continue;
    }

    buf += ch;
    i++;
  }

  const tail = buf.trim();
  if (tail && !tail.startsWith("--")) out.push(tail);
  return out;
}

async function probeAfterRepair() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const orgId = "6614b500-5c85-495c-a237-5bcf73dff4a1";
  const sb = createClient(url, key);
  const checks = [
    "themes",
    "tasks_view",
    "properties_view",
    "compliance_portfolio_view",
    "property_details",
    "attachments",
    "assets",
  ];
  const results = {};
  for (const table of checks) {
    const selectCols = table === "property_details" ? "property_id" : "id";
    const { error } = await sb.from(table).select(selectCols).eq("org_id", orgId).limit(1);
    results[table] = error ? { code: error.code, message: error.message } : { ok: true };
  }
  const { error: colErr } = await sb
    .from("organisation_members")
    .select("assigned_properties")
    .limit(1);
  results.assigned_properties = colErr
    ? { code: colErr.code, message: colErr.message }
    : { ok: true };
  const { error: rpcErr } = await sb.rpc("ai_icon_search", { query_text: "home" });
  results.ai_icon_search = rpcErr
    ? { code: rpcErr.code, message: rpcErr.message }
    : { ok: true };
  const { error: spaceIconErr } = await sb.from("spaces").select("id, icon_name").limit(1);
  results.spaces_icon_name = spaceIconErr
    ? { code: spaceIconErr.code, message: spaceIconErr.message }
    : { ok: true };
  for (const table of ["compliance_spaces", "attachment_spaces", "assets_view"]) {
    const { error } = await sb.from(table).select("*").limit(1);
    results[table] = error ? { code: error.code, message: error.message } : { ok: true };
  }
  const { error: seedRpcErr } = await sb.rpc("seed_onboarding_demo_for_property", {
    p_property_id: "00000000-0000-0000-0000-000000000000",
  });
  results.seed_onboarding_demo_for_property =
    seedRpcErr?.code === "PGRST202"
      ? { code: seedRpcErr.code, message: seedRpcErr.message }
      : { ok: true };
  const { error: spaceTypesErr } = await sb
    .from("space_types")
    .select("name, default_ui_group, default_icon")
    .limit(1);
  results.space_types_default_icon = spaceTypesErr
    ? { code: spaceTypesErr.code, message: spaceTypesErr.message }
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
  supabase/migrations/20260602170000_ensure_assets_and_compliance_view.sql
  supabase/migrations/20260602180000_ensure_ai_icon_search_rpc.sql
  supabase/migrations/20260602190000_ensure_entity_icon_name_columns.sql
  supabase/migrations/20260602200000_ensure_space_junctions_and_assets_view.sql
  supabase/migrations/20260602210000_ensure_onboarding_demo_seed.sql
  supabase/migrations/20260602220000_ensure_space_types_default_icon.sql
`);
    process.exit(1);
  }

  const dbUrl = `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require`;

  console.log(`Applying schema repair to ${ref} (via psql)…`);
  for (const [label, file] of [
    ["part 1", MIGRATION],
    ["part 2", MIGRATION_PART2],
    ["part 3", MIGRATION_PART3],
    ["part 4", MIGRATION_PART4],
    ["part 5", MIGRATION_PART5],
    ["part 6", MIGRATION_PART6],
    ["part 7", MIGRATION_PART7],
    ["part 8", MIGRATION_PART8],
  ]) {
    const result = runSqlFile(dbUrl, file);

    if (!result.ok) {
      console.error(`${label} failed:`, result.stdout || result.stderr || "SQL failed");
      process.exit(result.exitCode ?? 1);
    }
    console.log(`${label} applied.`);
  }

  console.log("Schema repair applied. Verifying via REST…");
  const probe = await probeAfterRepair();
  console.log(JSON.stringify(probe, null, 2));

  const failed = Object.entries(probe).filter(([, v]) => !("ok" in v && v.ok));
  if (failed.length) {
    console.error("Some relations still failing:", failed);
    process.exit(1);
  }
  console.log(
    "Done — repair views/tables including compliance_spaces, attachment_spaces, and assets_view are available."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
