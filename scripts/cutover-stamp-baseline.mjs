#!/usr/bin/env node
/**
 * One-time production cutover: stamp the squash baseline as applied on the
 * linked hosted project WITHOUT running it (data preserved).
 *
 * Refuses unless:
 *   FILLA_CUTOVER_CONFIRM=<project-ref>
 * matches supabase/.temp/project-ref (or VITE_SUPABASE_PROJECT_ID).
 *
 * Never use this as daily workflow. Never Dashboard-reset production.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const confirm = process.env.FILLA_CUTOVER_CONFIRM || "";
const refFile = join(root, "supabase/.temp/project-ref");
const linked = existsSync(refFile)
  ? readFileSync(refFile, "utf8").trim()
  : process.env.VITE_SUPABASE_PROJECT_ID || "";

const BASELINE_VERSIONS = [
  "20260817120000",
  "20260817120001",
  "20260817120002",
];

if (!confirm || !linked || confirm !== linked) {
  console.error(`
Cutover stamp refused.

This rewrites migration history on the linked hosted database.
Production project is currently: ${linked || "(unknown)"}

To proceed you must set:
  FILLA_CUTOVER_CONFIRM=${linked || "<project-ref>"}

Preferred path: schema dump ≡ baseline, then stamp only. If they diverge, use a
new production project + authorised data migration instead (see supabase/STAGING.md).
`);
  process.exit(1);
}

console.log("Stamping baseline versions as applied on", linked);
const r = spawnSync(
  "supabase",
  ["migration", "repair", "--status", "applied", ...BASELINE_VERSIONS],
  { cwd: root, stdio: "inherit" }
);
process.exit(r.status ?? 1);
