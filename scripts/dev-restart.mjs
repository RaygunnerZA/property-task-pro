#!/usr/bin/env node
/**
 * Clean reboot: stop anything on :8080, then start dev-keepalive.
 * Use this instead of spawning another `npm run dev` when the server dies.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stopScript = path.join(root, "scripts", "dev-stop.mjs");
const keepaliveScript = path.join(root, "scripts", "dev-keepalive.mjs");

const stop = spawn(process.execPath, [stopScript], {
  stdio: "inherit",
  cwd: root,
});

stop.on("exit", () => {
  setTimeout(() => {
    console.info("[dev:restart] Starting keepalive wrapper…");
    const child = spawn(process.execPath, [keepaliveScript], {
      stdio: "inherit",
      cwd: root,
      env: process.env,
    });

    child.on("exit", (code) => process.exit(code ?? 0));
  }, 500);
});
