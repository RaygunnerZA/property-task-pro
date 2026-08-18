#!/usr/bin/env node
/**
 * Generate src/integrations/supabase/types.ts from a running local Postgres.
 * Prefer --db-url so we do not need postgres-meta Docker (Colima/credential quirks).
 * Override with SUPABASE_DB_URL if the local DB is not on 54322.
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "src/integrations/supabase/types.ts");
const dbUrl =
  process.env.SUPABASE_DB_URL ||
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const r = spawnSync(
  "npx",
  ["supabase", "gen", "types", "typescript", "--db-url", dbUrl, "--schema", "public"],
  { cwd: root, encoding: "utf8" }
);
if (r.status !== 0) {
  process.stderr.write(r.stderr || r.stdout || "gen types failed\n");
  process.exit(r.status ?? 1);
}
if (!r.stdout.includes("export type Database")) {
  process.stderr.write(r.stdout || "gen types produced no Database type\n");
  process.exit(1);
}
writeFileSync(out, r.stdout);
console.log("Wrote", out);
