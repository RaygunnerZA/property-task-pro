#!/usr/bin/env node
/**
 * Smoke test for Knowledge AI provider wiring.
 *
 *   npm run smoke:knowledge-ai
 *
 * Optional env (from shell or .env loaded below):
 *   FILLA_KNOWLEDGE_GEMINI_API_KEY — preferred for Knowledge paths
 *   GEMINI_API_KEY                   — fallback
 *   GEMINI_FLASH_MODEL               — default gemini-3.6-flash
 *   VITE_SUPABASE_URL / SUPABASE_URL — Filla project (hosted or local)
 *
 * Flags:
 *   --skip-gemini   Only test ai-doc-analyse workbook interpretation
 *   --skip-filla    Only test direct Gemini generateContent
 *   --url <base>    Override Supabase project URL
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadDotEnv(path.join(root, ".env"));

const args = process.argv.slice(2);
const skipGemini = args.includes("--skip-gemini");
const skipFilla = args.includes("--skip-filla");
const urlFlag = args.indexOf("--url");
const supabaseUrl = (
  urlFlag !== -1 ? args[urlFlag + 1] : process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
)?.replace(/\/$/, "");

const geminiKey =
  process.env.FILLA_KNOWLEDGE_GEMINI_API_KEY?.trim() ||
  process.env.GEMINI_API_KEY?.trim() ||
  "";
const geminiModel = process.env.GEMINI_FLASH_MODEL?.trim() || "gemini-3.6-flash";
const platformOrgId = "00000000-0000-0000-0000-000000000000";

const workbookManifest = {
  kind: "xlsx",
  sheetCount: 2,
  sheets: [
    {
      sheetName: "00_READ_ME",
      headers: ["Section", "Notes"],
      sampleRows: [["Purpose", "How to use this workbook"]],
      rowCount: 1,
      columnCount: 2,
      relatedSheets: ["01_LEGAL"],
      supportSignals: {
        isDataBearing: true,
        isReadme: true,
        heuristicRole: "reference_context",
        heuristicRecommendation: "keep_as_context",
        heuristicReason: "Readme-like",
      },
    },
    {
      sheetName: "01_LEGAL",
      headers: ["Title", "Guidance", "Jurisdiction"],
      sampleRows: [["Gas safety certificate", "Renew annually", "GB-ENG"]],
      rowCount: 20,
      columnCount: 3,
      relatedSheets: [],
      supportSignals: {
        isDataBearing: true,
        isReadme: false,
        heuristicRole: "knowledge_data",
        heuristicRecommendation: "include",
        heuristicReason: "Tabular guidance",
      },
    },
  ],
};

let failed = false;

console.log("Knowledge AI smoke test\n");

if (!skipGemini) {
  if (!geminiKey) {
    fail("Gemini", "Set FILLA_KNOWLEDGE_GEMINI_API_KEY or GEMINI_API_KEY");
  } else {
    await runStep("Gemini generateContent", async () => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Reply with exactly: OK" }] }],
        }),
      });
      const body = await res.text();
      if (!res.ok) {
        throw new Error(`${res.status} ${body.slice(0, 400)}`);
      }
      const json = JSON.parse(body);
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (!text.trim()) throw new Error("Empty Gemini response");
      console.log(`    model: ${geminiModel}`);
      console.log(`    reply: ${text.trim().slice(0, 80)}`);
    });
  }
} else {
  console.log("SKIP Gemini (--skip-gemini)\n");
}

if (!skipFilla) {
  if (!supabaseUrl) {
    fail("Filla workbook", "Set VITE_SUPABASE_URL or SUPABASE_URL (or pass --url)");
  } else {
    await runStep("ai-doc-analyse workbook_interpretation", async () => {
      const res = await fetch(`${supabaseUrl}/functions/v1/ai-doc-analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: platformOrgId,
          file_name: "smoke-workbook.json",
          workbook_manifest: workbookManifest,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(`${res.status} ${JSON.stringify(json).slice(0, 400)}`);
      }
      if (json.interpretation_status !== "ok" || json.ok !== true) {
        throw new Error(
          json.interpretation_error ??
            json.error ??
            "Workbook interpretation did not succeed"
        );
      }
      const included = (json.sheets ?? []).filter((s) => s.classification === "knowledge_data");
      if (included.length === 0) {
        throw new Error("No knowledge_data sheets returned");
      }
      console.log(`    url: ${supabaseUrl}`);
      console.log(
        `    sheets: ${(json.sheets ?? [])
          .map((s) => `${s.sheet_name}=${s.classification}`)
          .join(", ")}`
      );
    });
  }
} else {
  console.log("SKIP Filla (--skip-filla)\n");
}

if (failed) {
  console.error("\nSmoke test FAILED");
  process.exit(1);
}

console.log("\nSmoke test OK");
process.exit(0);

async function runStep(label, fn) {
  process.stdout.write(`→ ${label} ... `);
  try {
    await fn();
    console.log("OK");
  } catch (err) {
    failed = true;
    const message = err instanceof Error ? err.message : String(err);
    console.log("FAIL");
    console.error(`    ${message}`);
  }
  console.log("");
}

function fail(label, message) {
  failed = true;
  console.log(`→ ${label} ... FAIL`);
  console.error(`    ${message}\n`);
}

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}
