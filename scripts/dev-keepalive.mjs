#!/usr/bin/env node
/**
 * Restarts `npm run dev` when Vite exits unexpectedly (crash, port conflict, etc.).
 * Run in a dedicated terminal — `npm run dev:restart` to clean-reboot.
 */
import { spawn, execSync } from "node:child_process";
import { writeFileSync, unlinkSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RESTART_MS = 2000;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pidFile = path.join(root, ".dev-keepalive.pid");

function freePort8080() {
  try {
    execSync("lsof -ti:8080 | xargs kill -9", { stdio: "ignore", shell: true });
  } catch {
    // port already free
  }
}

function acquireLock() {
  try {
    const existing = Number(readFileSync(pidFile, "utf8").trim());
    process.kill(existing, 0);
    console.error(
      `[dev-keepalive] Already running (pid ${existing}). Run \`npm run dev:restart\` to reboot.`
    );
    process.exit(1);
  } catch {
    // stale or missing pid file — take over
  }

  writeFileSync(pidFile, String(process.pid));

  const release = () => {
    try {
      unlinkSync(pidFile);
    } catch {
      // ignore
    }
  };

  process.on("exit", release);
  process.on("SIGINT", () => {
    release();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    release();
    process.exit(0);
  });
}

let child = null;

function runDev() {
  freePort8080();

  child = spawn("npm", ["run", "dev"], {
    stdio: "inherit",
    cwd: root,
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    child = null;
    const reason = signal ? `signal ${signal}` : `code ${code ?? "?"}`;
    console.warn(`[dev-keepalive] Vite stopped (${reason}). Restarting in ${RESTART_MS / 1000}s…`);
    setTimeout(runDev, RESTART_MS);
  });
}

acquireLock();
console.info("[dev-keepalive] Starting Vite on http://localhost:8080/ (Ctrl+C to stop)");
console.info("[dev-keepalive] Reboot anytime: npm run dev:restart");
runDev();

process.on("SIGINT", () => {
  if (child) child.kill("SIGTERM");
});
process.on("SIGTERM", () => {
  if (child) child.kill("SIGTERM");
});
