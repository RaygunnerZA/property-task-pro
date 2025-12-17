import fs from "fs";
import fetch from "node-fetch";

const apiKey = process.env.GEMINI_API_KEY;

const changedFiles = fs
  .readFileSync("changed_files.txt", "utf8")
  .split("\n")
  .filter(Boolean);

let payload = "";

for (const file of changedFiles) {
  if (!fs.existsSync(file)) continue;
  payload += `\n\n### FILE: ${file}\n`;
  payload += fs.readFileSync(file, "utf8").slice(0, 12000);
}

const prompt = `
You are a read-only architectural critic.

Rules:
- Do NOT suggest new features
- Do NOT invent missing systems
- Identify:
  • architectural drift
  • schema violations
  • identity / RLS risks
  • prompt-pack violations
- Reference files explicitly.

Analyze the following changes:
${payload}
`;

const response = await fetch(
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=" +
    apiKey,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  }
);

const result = await response.json();

const text =
  result.candidates?.[0]?.content?.parts?.[0]?.text ||
  "No response from Gemini.";

fs.writeFileSync(
  "gemini_report.md",
  `## Gemini Review\n\n${text}`
);
