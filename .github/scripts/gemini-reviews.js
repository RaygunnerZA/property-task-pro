import fs from "fs";

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("Missing GEMINI_API_KEY");
  process.exit(1);
}

/**
 * Only review architectural / backend relevant paths.
 * This protects Lovable UI work from noise.
 */
const ALLOWED_PATHS = [
  "supabase/",
  "schema/",
  "src/app/api/",
  "src/lib/",
  "src/hooks/",
  "src/types/"
];

/**
 * Ignore non-code or non-architectural files.
 */
const IGNORED_EXTENSIONS = [
  ".md",
  ".png",
  ".jpg",
  ".jpeg",
  ".svg",
  ".gif",
  ".webp",
  ".lock"
];

const MODEL = "gemini-2.5-flash";
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

const changedFilesPath = "changed_files.txt";
const outputPath = "gemini_report.md";

/**
 * If no diff file exists, exit cleanly.
 */
if (!fs.existsSync(changedFilesPath)) {
  fs.writeFileSync(outputPath, "No changed files detected.");
  process.exit(0);
}

/**
 * Load and filter changed files strictly.
 */
const files = fs
  .readFileSync(changedFilesPath, "utf-8")
  .split("\n")
  .map(f => f.trim())
  .filter(Boolean)
  .filter(f => fs.existsSync(f))
  .filter(f =>
    ALLOWED_PATHS.some(prefix => f.startsWith(prefix))
  )
  .filter(f =>
    !IGNORED_EXTENSIONS.some(ext => f.endsWith(ext))
  )
  .slice(0, 20); // hard safety cap

if (files.length === 0) {
  fs.writeFileSync(
    outputPath,
    "No architectural or backend-relevant changes detected."
  );
  process.exit(0);
}

/**
 * Build context safely.
 * Never allow file read failures to crash CI.
 */
let context = "";

for (const file of files) {
  let content = "";
  try {
    content = fs.readFileSync(file, "utf-8").slice(0, 6000);
  } catch {
    content = "[Unable to read file as UTF-8]";
  }

  context += `\n\nFILE: ${file}\n---\n${content}`;
}

const prompt = `
You are an architectural review agent for the Filla platform.

Scope rules (STRICT):
- Only review backend, schema, API, and core logic changes
- Do NOT comment on UI styling, layout, copy, or assets
- Do NOT invent files, flows, tables, or components
- If something is missing, state uncertainty explicitly

Focus on:
- Schema integrity
- RLS and access control risks
- API contract changes
- Architectural drift
- Cross-layer violations

Review the following changed files:
${context}

Return:
1. High-risk issues (must fix)
2. Medium-risk issues
3. Low-risk observations
4. Overall architectural assessment
`;

async function run() {
  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1200
      }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    fs.writeFileSync(
      outputPath,
      `Gemini request failed:\n\n${text}`
    );
    process.exit(1);
  }

  const data = await response.json();
  const result =
    data.candidates?.[0]?.content?.parts?.[0]?.text ??
    "No response from Gemini.";

  fs.writeFileSync(outputPath, result);
}

run();
