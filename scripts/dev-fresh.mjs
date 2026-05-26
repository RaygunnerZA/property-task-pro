#!/usr/bin/env node
/**
 * Clears Vite's dependency cache and starts dev with --force.
 * Use when hard reload still shows stale modules after main.tsx HMR fixes.
 */
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteCache = path.join(root, "node_modules", ".vite");

await rm(viteCache, { recursive: true, force: true });
console.info("[dev:fresh] Cleared", viteCache);
console.info("[dev:fresh] Starting Vite on http://localhost:8080/ (Ctrl+C to stop)");

const child = spawn("npm", ["run", "dev", "--", "--force"], {
  stdio: "inherit",
  shell: true,
  cwd: root,
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 0));
