#!/usr/bin/env node
/**
 * Restarts `npm run dev` when Vite exits unexpectedly (crash, killed port, etc.).
 * Run in a dedicated terminal — do not rely on short-lived agent background shells.
 */
import { spawn } from "node:child_process";

const RESTART_MS = 2000;

function runDev() {
  const child = spawn("npm", ["run", "dev"], {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    const reason = signal ? `signal ${signal}` : `code ${code ?? "?"}`;
    console.warn(`[dev-keepalive] Vite stopped (${reason}). Restarting in ${RESTART_MS / 1000}s…`);
    setTimeout(runDev, RESTART_MS);
  });
}

console.info("[dev-keepalive] Starting Vite on http://localhost:8080/ (Ctrl+C to stop)");
runDev();
