#!/usr/bin/env node
/**
 * Fail if config.toml disables JWT on a function that is not in the known set.
 * Adding verify_jwt=false requires updating this list and @Docs/Schema_Discrepancy_Register.md.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ALLOW_JWT_OFF = new Set([
  "stripe-webhook", // Stripe signature
  "inbound-email", // Resend/Svix
  "intake-process", // flagged: no getUser
  "ai-extract", // flagged: no getUser
  "ai-doc-analyse", // flagged: no getUser
  "ai-image-analyse", // flagged: no getUser
  "knowledge-critic", // flagged: no getUser
  "knowledge-discovery", // flagged: no getUser
]);

const cfg = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../supabase/config.toml"),
  "utf8"
);

const off = new Set();
const blocks = cfg.split(/\n(?=\[functions\.)/);
for (const block of blocks) {
  const name = block.match(/^\[functions\.([^\]]+)\]/)?.[1];
  if (!name) continue;
  if (/verify_jwt\s*=\s*false/.test(block)) off.add(name);
}

const unexpected = [...off].filter((n) => !ALLOW_JWT_OFF.has(n)).sort();
const missing = [...ALLOW_JWT_OFF].filter((n) => !off.has(n)).sort();
if (unexpected.length || missing.length) {
  console.error("verify_jwt inventory mismatch");
  if (unexpected.length) console.error("new JWT-off functions:", unexpected.join(", "));
  if (missing.length) console.error("listed but not JWT-off in config:", missing.join(", "));
  process.exit(1);
}
console.log("verify_jwt inventory: PASS (" + [...off].sort().join(", ") + ")");
