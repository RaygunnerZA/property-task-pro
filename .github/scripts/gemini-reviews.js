import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("Missing GEMINI_API_KEY"); 
  process.exit(1);
}

const MODEL = "models/gemini-1.5-pro";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1/${MODEL}:generateContent?key=${API_KEY}`;

const changedFilesPath = "changed_files.txt";
const outputPath = "gemini_report.md";

if (!fs.existsSync(changedFilesPath)) {
  fs.writeFileSync(outputPath, "No changed files detected.");
  process.exit(0);
}

const files = fs
  .readFileSync(changedFilesPath, "utf-8")
  .split("\n")
  .filter(Boolean)
  .filter(f => fs.existsSync(f))
  .slice(0, 25); // hard safety limit

let context = "";

for (const file of files) {
  const content = fs.readFileSync(file, "utf-8").slice(0, 6000);
  context += `\n\nFILE: ${file}\n---\n${content}`;
}

const prompt = `
You are an architectural review agent for the Filla platform.

Rules:
- Do NOT invent files, flows, or components
- Identify schema violations, RLS risks, architectural drift, or UX inconsistencies
- Flag risky changes clearly
- Be concise, technical, and deterministic

Review the following changed files:
${context}

Return:
1. High-risk issues
2. Medium-risk issues
3. Low-risk issues
4. Overall assessment
`;

async function run() {
  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ]
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
  const text =
    data.candidates?.[0]?.content?.parts?.[0]?.text ??
    "No response from Gemini.";

  fs.writeFileSync(outputPath, text);
}

run();
