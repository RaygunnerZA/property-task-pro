#!/usr/bin/env node
/**
 * Ensures every supabase.functions.invoke("name") in src/ has a matching supabase/functions/name/.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(root, "src");
const functionsDir = path.join(root, "supabase", "functions");
const invokeRe = /functions\.invoke\s*\(\s*["'`]([^"'`]+)["'`]/g;

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(name)) files.push(full);
  }
  return files;
}

const invoked = new Set();
for (const file of walk(srcDir)) {
  const text = fs.readFileSync(file, "utf8");
  let m;
  while ((m = invokeRe.exec(text)) !== null) invoked.add(m[1]);
}

const deployed = new Set(
  fs
    .readdirSync(functionsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name)
);

const missing = [...invoked].filter((name) => !deployed.has(name)).sort();

if (missing.length === 0) {
  console.log(`OK: ${invoked.size} invoked edge function(s) all exist under supabase/functions/`);
  process.exit(0);
}

console.error("Missing edge function implementations:");
for (const name of missing) console.error(`  - ${name}`);
console.error("\nAdd supabase/functions/<name>/ or remove the invoke call.");
process.exit(1);
