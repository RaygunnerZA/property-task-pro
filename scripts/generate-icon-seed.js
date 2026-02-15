#!/usr/bin/env node
/**
 * Generates icon_library seed SQL from lucide-react exports.
 * Run: node scripts/generate-icon-seed.js > supabase/migrations/20260221000001_seed_icon_library.sql
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dtsPath = path.join(__dirname, "../node_modules/lucide-react/dist/lucide-react.d.ts");
const content = fs.readFileSync(dtsPath, "utf8");

// Extract icon names: declare const IconName:
const re = /declare const ([A-Za-z0-9]+):/g;
const icons = [];
let m;
while ((m = re.exec(content)) !== null) {
  icons.push(m[1]);
}

// PascalCase to kebab-case
function toKebab(str) {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

// Generate tags from kebab name (split + common synonyms)
const synonymMap = {
  "fire-extinguisher": ["fire", "extinguisher", "safety", "emergency"],
  "alarm-smoke": ["smoke", "alarm", "detector", "fire", "warning"],
  "flame": ["fire", "heat", "boiler", "burner"],
  "zap": ["electrical", "power", "electric", "lightning"],
  "package": ["box", "asset", "item", "storage"],
  "wrench": ["tool", "maintenance", "repair", "mechanical"],
  "thermometer": ["temperature", "heat", "hvac", "climate"],
  "droplet": ["water", "plumbing", "liquid", "leak"],
  "fan": ["hvac", "ventilation", "air", "cooling"],
  "fuel": ["tank", "gas", "oil", "heating"],
  "gauge": ["meter", "pressure", "measure", "dial"],
  "shield": ["safety", "compliance", "protection"],
  "alert-triangle": ["warning", "alert", "caution", "hazard"],
  "plug": ["electrical", "outlet", "power"],
  "cable": ["electrical", "wire", "power"],
  "hammer": ["tool", "repair", "construction"],
  "settings": ["mechanical", "control", "config"],
  "box": ["storage", "container", "package"],
};

function getTags(kebab) {
  const base = kebab.split("-");
  const extra = synonymMap[kebab];
  const all = [...new Set([...base, ...(extra || [])])];
  return all.filter((t) => t.length > 1);
}

const lines = [
  "-- Seed icon_library with Lucide icons (generated from lucide-react)",
  "-- Run: node scripts/generate-icon-seed.js",
  "",
  "INSERT INTO icon_library (name, tags, category, search_vector)",
  "VALUES",
];

const values = icons.map((pascal) => {
  const kebab = toKebab(pascal);
  const tags = getTags(kebab);
  const searchStr = [kebab, ...tags].join(" ");
  const tagsSql = tags.length ? `ARRAY[${tags.map((t) => `'${t.replace(/'/g, "''")}'`).join(", ")}]` : `ARRAY[]::TEXT[]`;
  const searchVec = `to_tsvector('english', '${searchStr.replace(/'/g, "''")}')`;
  return `  ('${kebab}', ${tagsSql}, NULL, ${searchVec})`;
});

lines.push(values.join(",\n"));
lines.push("ON CONFLICT (name) DO UPDATE SET tags = EXCLUDED.tags, search_vector = EXCLUDED.search_vector;");

console.log(lines.join("\n"));
