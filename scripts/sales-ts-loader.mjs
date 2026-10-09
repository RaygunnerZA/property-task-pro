/**
 * Resolve `@/` and extensionless relative imports so Node can load the sales
 * dataset TypeScript with type stripping. Used only by seed-demo-sales.mjs.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

let root = "";

export function initialize(data) {
  root = data?.root || "";
}

function tsFile(specifier) {
  const rel = specifier.slice(2);
  const withExt = rel.endsWith(".ts") ? rel : `${rel}.ts`;
  return pathToFileURL(join(root, "src", withExt)).href;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    return { url: tsFile(specifier), shortCircuit: true };
  }
  const parent = context.parentURL || "";
  const extensionless =
    (specifier.startsWith("./") || specifier.startsWith("../")) && !specifier.match(/\.[a-z]+$/i);
  if (extensionless && parent.includes("/src/")) {
    const candidate = new URL(`${specifier}.ts`, parent);
    if (existsSync(fileURLToPath(candidate))) {
      return { url: candidate.href, shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}
