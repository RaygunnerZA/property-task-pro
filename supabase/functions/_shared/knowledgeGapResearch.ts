/**
 * Gap-research contracts: request parse + model-output validation.
 * Pure TypeScript so Vitest can import it from the app test suite.
 * Model URLs are untrusted; intake still goes through safeFetchUrl.
 */

import { SchemaError } from "./aiRouting.ts";

export const MAX_RESEARCH_GAPS = 20;
export const MAX_RESEARCH_SOURCES = 8;

export const GAP_RESEARCH_PROMPT_VERSION = "knowledge-gap-research-v1";

export const GAP_RESEARCH_SYSTEM =
  "You find official primary sources for property-compliance Knowledge gaps. " +
  "Prefer legislation, named regulators, and government guidance over blogs, aggregators, or AI summaries. " +
  "One URL should cover as many listed gaps as it genuinely does. " +
  "Return JSON only: {\"sources\":[{\"url\":\"https://...\",\"title\":\"...\",\"publisher\":\"...\",\"authority\":\"legislation|regulator|government_guidance|standards_body|other\",\"covers\":[\"gap-id\"]}]} " +
  "covers ids must be copied exactly from the prompt. " +
  "Do not invent claims, quotes, or document text. If you cannot name a precise https URL, omit that gap. At most 8 sources.";

export type ResearchGapStatus = "missing" | "partial";

export type ResearchGapInput = {
  id: string;
  topic_key: string;
  topic: string;
  jurisdiction: string;
  status: ResearchGapStatus;
};

export type ResearchSourceHit = {
  url: string;
  title: string;
  publisher: string;
  authority: "legislation" | "regulator" | "government_guidance" | "standards_body" | "other";
  covers: string[];
};

const AUTHORITY = new Set([
  "legislation",
  "regulator",
  "government_guidance",
  "standards_body",
  "other",
]);

function clip(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function hasControlChars(value: string): boolean {
  return /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value);
}

/** Accept only https URLs with no credentials. Host checks for SSRF happen at fetch. */
export function sanitiseResearchSourceUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length < 12 || trimmed.length > 2048) return null;
  if (hasControlChars(trimmed) || /\s/.test(trimmed)) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password) return null;
  const host = parsed.hostname.toLowerCase();
  if (!host.includes(".") || host === "localhost" || host.endsWith(".local")) return null;
  return parsed.toString();
}

export function parseResearchGapsBody(body: unknown): ResearchGapInput[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new SchemaError("gaps_body_not_object");
  }
  const gaps = (body as { gaps?: unknown }).gaps;
  if (!Array.isArray(gaps) || gaps.length === 0) {
    throw new SchemaError("gaps_required");
  }
  if (gaps.length > MAX_RESEARCH_GAPS) {
    throw new SchemaError("too_many_gaps");
  }

  const out: ResearchGapInput[] = [];
  const seen = new Set<string>();
  for (const raw of gaps) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const rec = raw as Record<string, unknown>;
    const id = clip(rec.id, 160);
    const topic_key = clip(rec.topic_key, 48).toLowerCase();
    const topic = clip(rec.topic, 80);
    const jurisdiction = clip(rec.jurisdiction, 80);
    const status = rec.status === "partial" ? "partial" : rec.status === "missing" ? "missing" : null;
    if (!id || !topic_key || !topic || !jurisdiction || !status) continue;
    if (hasControlChars(id) || hasControlChars(topic) || hasControlChars(jurisdiction)) continue;
    if (!id.startsWith(`${topic_key}::`)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, topic_key, topic, jurisdiction, status });
  }
  if (out.length === 0) throw new SchemaError("gaps_invalid");
  return out;
}

export function clusterGapsByTopic(gaps: ResearchGapInput[]): Array<{
  topic_key: string;
  topic: string;
  items: ResearchGapInput[];
}> {
  const map = new Map<string, { topic_key: string; topic: string; items: ResearchGapInput[] }>();
  for (const gap of gaps) {
    const existing = map.get(gap.topic_key);
    if (existing) {
      existing.items.push(gap);
    } else {
      map.set(gap.topic_key, { topic_key: gap.topic_key, topic: gap.topic, items: [gap] });
    }
  }
  return [...map.values()];
}

export function buildGapResearchUserPrompt(gaps: ResearchGapInput[]): string {
  const clusters = clusterGapsByTopic(gaps);
  const lines = clusters.map((cluster) => {
    const cells = cluster.items
      .map((item) => `${item.jurisdiction} (${item.status}, id=${item.id})`)
      .join("; ");
    return `- ${cluster.topic} [${cluster.topic_key}]: ${cells}`;
  });
  return `Find the most official/credible public source for each gap. Prefer one URL that covers several listed jurisdictions when that is how the instrument is actually published.\n\nGaps:\n${lines.join("\n")}`;
}

export function validateDiscoverySources(
  raw: unknown,
  allowedIds: Set<string>
): { sources: ResearchSourceHit[]; uncovered: string[] } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new SchemaError("discovery_payload_not_object");
  }
  const sourcesRaw = (raw as { sources?: unknown }).sources;
  if (!Array.isArray(sourcesRaw)) throw new SchemaError("sources_missing");

  const sources: ResearchSourceHit[] = [];
  const covered = new Set<string>();
  const seenUrls = new Set<string>();

  for (const item of sourcesRaw) {
    if (sources.length >= MAX_RESEARCH_SOURCES) break;
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const url = sanitiseResearchSourceUrl(rec.url);
    if (!url) continue;
    const urlKey = url.toLowerCase();
    if (seenUrls.has(urlKey)) continue;
    seenUrls.add(urlKey);

    const coversRaw = rec.covers;
    const covers: string[] = [];
    if (Array.isArray(coversRaw)) {
      for (const c of coversRaw) {
        if (typeof c === "string" && allowedIds.has(c) && !covers.includes(c)) {
          covers.push(c);
          covered.add(c);
        }
        if (covers.length >= MAX_RESEARCH_GAPS) break;
      }
    }
    if (covers.length === 0) continue;

    const authority = AUTHORITY.has(String(rec.authority))
      ? (rec.authority as ResearchSourceHit["authority"])
      : "other";

    sources.push({
      url,
      title: clip(rec.title, 200) || url,
      publisher: clip(rec.publisher, 120) || "Unknown",
      authority,
      covers,
    });
  }

  const uncovered = [...allowedIds].filter((id) => !covered.has(id));
  return { sources, uncovered };
}
