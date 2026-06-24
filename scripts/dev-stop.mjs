#!/usr/bin/env node
/**
 * Stops Vite and any dev-keepalive wrapper on port 8080.
 */
import { execSync } from "node:child_process";
import { unlinkSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pidFile = path.join(root, ".dev-keepalive.pid");

function runQuiet(cmd) {
  try {
    execSync(cmd, { stdio: "ignore", shell: true });
  } catch {
    // already stopped
  }
}

const existingPid = (() => {
  try {
    return Number(readFileSync(pidFile, "utf8").trim());
  } catch {
    return null;
  }
})();

if (existingPid) {
  runQuiet(`kill -TERM ${existingPid} 2>/dev/null`);
  runQuiet(`kill -9 ${existingPid} 2>/dev/null`);
}

runQuiet("lsof -ti:8080 | xargs kill -9");
runQuiet('pkill -f "dev-keepalive.mjs"');
runQuiet('pkill -f "node_modules/.bin/vite"');

try {
  unlinkSync(pidFile);
} catch {
  // no pid file
}

console.info("[dev:stop] Dev server stopped (port 8080 freed).");
