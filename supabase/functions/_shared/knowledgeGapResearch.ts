/**
 * Gap-research contracts: request parse + model-output validation.
 * Pure TypeScript so Vitest can import it from the app test suite.
 * Model URLs are untrusted; intake still goes through safeFetchUrl.
 */

import { SchemaError } from "./aiRouting.ts";
import { validateOfficialSourceUrl } from "./officialSourceAllowlist.ts";

export const MAX_RESEARCH_GAPS = 20;
export const MAX_RESEARCH_SOURCES = 8;

export const GAP_RESEARCH_PROMPT_VERSION = "knowledge-gap-research-v3";

export const GAP_RESEARCH_SYSTEM =
  "You find official primary sources for property-compliance Knowledge gaps. " +
  "Prefer legislation, named regulators, and government guidance over blogs, aggregators, or AI summaries. " +
  "Only use https URLs on official hosts such as: legislation.gov.uk, gov.uk, gov.scot, gov.wales, " +
  "legifrance.gouv.fr (not legislation.gouv.fr), service-public.fr, admin.ch, fedlex.admin.ch. " +
  "Prefer deep links to the specific Act/guidance page — not a bare homepage, language stub (/fr), or unrelated droit ID. " +
  "The page must be about the named property topic (chimney/flue, heating, smoke/CO, gutters, etc.) — " +
  "never health insurance, employment law, or browser requirements. " +
  "One URL should cover as many listed gaps as it genuinely does. " +
  "Return JSON only: {\"sources\":[{\"url\":\"https://...\",\"title\":\"...\",\"publisher\":\"...\",\"authority\":\"legislation|regulator|government_guidance|standards_body|other\",\"covers\":[\"gap-id\"]}]} " +
  "covers ids must be copied exactly from the prompt. " +
  "Do not invent claims, quotes, or document text. If you cannot name a precise https URL on an official host, omit that gap. At most 8 sources.";

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

/**
 * Sanitise + official-host allowlist (+ known typo repair).
 * Prefer this over sanitiseResearchSourceUrl when accepting discovery hits.
 */
export function sanitiseOfficialResearchSourceUrl(raw: unknown): string | null {
  const validated = validateOfficialSourceUrl(raw);
  return validated.ok ? validated.url : null;
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
): {
  sources: ResearchSourceHit[];
  uncovered: string[];
  rejected: Array<{ url: string; reason: string }>;
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new SchemaError("discovery_payload_not_object");
  }
  const sourcesRaw = (raw as { sources?: unknown }).sources;
  if (!Array.isArray(sourcesRaw)) throw new SchemaError("sources_missing");

  const sources: ResearchSourceHit[] = [];
  const rejected: Array<{ url: string; reason: string }> = [];
  const covered = new Set<string>();
  const seenUrls = new Set<string>();

  for (const item of sourcesRaw) {
    if (sources.length >= MAX_RESEARCH_SOURCES) break;
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const rawUrl = typeof rec.url === "string" ? rec.url : "";
    const url = sanitiseOfficialResearchSourceUrl(rec.url);
    if (!url) {
      if (rawUrl) {
        const v = validateOfficialSourceUrl(rawUrl);
        rejected.push({
          url: rawUrl.slice(0, 500),
          reason: v.ok ? "invalid_url" : v.detail,
        });
      }
      continue;
    }
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
  return { sources, uncovered, rejected };
}

/**
 * Verified official URLs for pilot gaps where models often invent dead links (404).
 * Only allowlisted hosts. Prefer these ahead of model-proposed URLs for the same gap.
 */
export const CURATED_GAP_SOURCES: ReadonlyArray<{
  topic_key: string;
  /** Lowercase jurisdiction label, e.g. "england". */
  jurisdiction: string;
  url: string;
  title: string;
  publisher: string;
  authority: ResearchSourceHit["authority"];
}> = [
  {
    topic_key: "chimney-flue-sweeping",
    jurisdiction: "england",
    url: "https://www.gov.uk/government/publications/combustion-appliances-and-fuel-storage-systems-approved-document-j",
    title: "Approved Document J: combustion appliances and fuel storage systems",
    publisher: "UK government",
    authority: "government_guidance",
  },
  {
    topic_key: "chimney-flue-sweeping",
    jurisdiction: "scotland",
    url: "https://www.gov.scot/publications/building-standards-technical-handbook-2022-domestic/3-environment/3-18-combustion-appliances-protection-combustion-products/",
    title:
      "Building standards technical handbook 2022: domestic — combustion appliances (sweeping)",
    publisher: "Scottish Government",
    authority: "government_guidance",
  },
  {
    topic_key: "before-heating-season",
    jurisdiction: "england",
    url: "https://www.hse.gov.uk/GAS/landlords/gasappliances.htm",
    title: "HSE: Maintenance — gas appliances and flues (landlords)",
    publisher: "Health and Safety Executive",
    authority: "regulator",
  },
  {
    topic_key: "before-heating-season",
    jurisdiction: "scotland",
    url: "https://www.gov.scot/publications/repairing-standard-statutory-guidance-private-landlords/pages/15/",
    title: "Repairing Standard: installations for the supply of gas",
    publisher: "Scottish Government",
    authority: "government_guidance",
  },
  {
    topic_key: "before-heating-season",
    jurisdiction: "france",
    url: "https://www.service-public.gouv.fr/particuliers/vosdroits/F20760",
    title: "Entretien annuel de la chaudière : quelles règles pour le locataire ?",
    publisher: "Service-Public.fr",
    authority: "government_guidance",
  },
];

function jurisdictionKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Ensure curated official URLs cover matching gaps; curated sources are listed first
 * so intake hits known-good pages before model-invented URLs that often 404.
 * When a curated seed covers a gap, drop other discovered URLs for that gap only.
 */
export function augmentDiscoveryWithCuratedSources(
  gaps: ResearchGapInput[],
  discovered: ResearchSourceHit[]
): { sources: ResearchSourceHit[]; uncovered: string[]; curatedAdded: number } {
  const sources: ResearchSourceHit[] = discovered.map((s) => ({
    ...s,
    covers: [...s.covers],
  }));
  const byUrl = new Map(sources.map((s) => [s.url.toLowerCase(), s]));
  let curatedAdded = 0;
  const curatedGapIds = new Set<string>();
  const curatedUrlKeys = new Set<string>();

  for (const gap of gaps) {
    const seed = CURATED_GAP_SOURCES.find(
      (c) =>
        c.topic_key === gap.topic_key &&
        jurisdictionKey(c.jurisdiction) === jurisdictionKey(gap.jurisdiction)
    );
    if (!seed) continue;
    const validated = sanitiseOfficialResearchSourceUrl(seed.url);
    if (!validated) continue;

    curatedGapIds.add(gap.id);
    curatedUrlKeys.add(validated.toLowerCase());

    const existing = byUrl.get(validated.toLowerCase());
    if (existing) {
      if (!existing.covers.includes(gap.id)) {
        existing.covers.push(gap.id);
        curatedAdded += 1;
      }
      continue;
    }

    const hit: ResearchSourceHit = {
      url: validated,
      title: seed.title,
      publisher: seed.publisher,
      authority: seed.authority,
      covers: [gap.id],
    };
    sources.unshift(hit);
    byUrl.set(validated.toLowerCase(), hit);
    curatedAdded += 1;
  }

  // Prefer curated over inventable model links for the same gap (avoids 404 dead ends).
  const pruned = sources
    .map((s) => {
      if (curatedUrlKeys.has(s.url.toLowerCase())) return s;
      return {
        ...s,
        covers: s.covers.filter((id) => !curatedGapIds.has(id)),
      };
    })
    .filter((s) => s.covers.length > 0);

  const covered = new Set(pruned.flatMap((s) => s.covers));
  const uncovered = gaps.map((g) => g.id).filter((id) => !covered.has(id));
  return { sources: pruned, uncovered, curatedAdded };
}
