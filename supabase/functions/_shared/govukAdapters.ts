/**
 * Replaceable GOV.UK adapters for Knowledge Watch.
 *
 * Content API: page content + metadata in a predictable format.
 * Search API: filtered discovery metadata. GOV.UK labels Search unsupported —
 * Filla must tolerate failure and keep a swappable adapter.
 *
 * Hosts are fixed. Callers must not pass a user-supplied host.
 * https://www.gov.uk/help/reuse-govuk-content
 */

import type { CatalogueSearchHit } from "./officialSourceCatalogue.ts";

export const GOVUK_WWW_ORIGIN = "https://www.gov.uk";
export const GOVUK_SEARCH_PATH = "/api/search.json";
export const GOVUK_CONTENT_PREFIX = "/api/content";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_COUNT = 50;
const USER_AGENT = "FillaKnowledgeBot/1.0 (+https://filla.app; official-catalogue)";

export type GovukSearchParams = {
  q?: string;
  taxonId?: string;
  organisation?: string;
  purposeSupergroup?: string;
  count?: number;
  start?: number;
};

export type GovukSearchSuccess = {
  ok: true;
  total: number;
  start: number;
  results: CatalogueSearchHit[];
};

export type GovukAdapterFailure = {
  ok: false;
  error: string;
  unsupported?: boolean;
  status?: number;
};

export type GovukSearchResult = GovukSearchSuccess | GovukAdapterFailure;

export type GovukContentMetadata = {
  content_id: string | null;
  public_updated_at: string | null;
  updated_at: string | null;
  document_type: string | null;
  withdrawn: boolean;
  title: string | null;
  base_path: string;
};

export type GovukContentResult =
  | { ok: true; metadata: GovukContentMetadata; raw: Record<string, unknown> }
  | GovukAdapterFailure;

export function govukSearchUrl(params: GovukSearchParams): string {
  const url = new URL(GOVUK_SEARCH_PATH, GOVUK_WWW_ORIGIN);
  const count = Math.max(1, Math.min(params.count ?? 20, MAX_COUNT));
  const start = Math.max(0, params.start ?? 0);
  url.searchParams.set("count", String(count));
  url.searchParams.set("start", String(start));
  url.searchParams.set(
    "fields",
    "title,description,link,content_id,public_timestamp,document_type,content_purpose_supergroup,organisations"
  );
  if (params.q?.trim()) url.searchParams.set("q", params.q.trim().slice(0, 200));
  if (params.taxonId?.trim()) {
    url.searchParams.set("filter_part_of_taxonomy_tree", params.taxonId.trim());
  }
  if (params.organisation?.trim()) {
    url.searchParams.set("filter_organisations", params.organisation.trim());
  }
  if (params.purposeSupergroup?.trim()) {
    url.searchParams.set("filter_content_purpose_supergroup", params.purposeSupergroup.trim());
  }
  return url.toString();
}

export function govukContentUrl(path: string): string {
  const cleaned = path.trim();
  const pathname = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
  if (pathname.includes("://") || pathname.includes("..")) {
    throw new Error("invalid_content_path");
  }
  return `${GOVUK_WWW_ORIGIN}${GOVUK_CONTENT_PREFIX}${pathname}`;
}

export function parseGovukSearchPayload(payload: unknown): GovukSearchSuccess {
  const row = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const rawResults = Array.isArray(row.results) ? row.results : [];
  const results: CatalogueSearchHit[] = [];
  for (const item of rawResults) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const title = typeof r.title === "string" ? r.title.trim() : "";
    const link = typeof r.link === "string" ? r.link.trim() : "";
    if (!title && !link) continue;
    const orgs = Array.isArray(r.organisations)
      ? r.organisations
          .map((o) => {
            if (typeof o === "string") return o;
            if (o && typeof o === "object" && typeof (o as { slug?: unknown }).slug === "string") {
              return (o as { slug: string }).slug;
            }
            return "";
          })
          .filter(Boolean)
      : undefined;
    results.push({
      title: title || link,
      description: typeof r.description === "string" ? r.description : undefined,
      link,
      content_id: typeof r.content_id === "string" ? r.content_id : undefined,
      public_timestamp: typeof r.public_timestamp === "string" ? r.public_timestamp : undefined,
      document_type: typeof r.document_type === "string" ? r.document_type : undefined,
      content_purpose_supergroup:
        typeof r.content_purpose_supergroup === "string" ? r.content_purpose_supergroup : undefined,
      organisations: orgs,
    });
  }
  return {
    ok: true,
    total: typeof row.total === "number" && Number.isFinite(row.total) ? row.total : results.length,
    start: typeof row.start === "number" && Number.isFinite(row.start) ? row.start : 0,
    results,
  };
}

export function parseGovukContentMetadata(
  path: string,
  payload: unknown
): GovukContentMetadata {
  const row = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const withdrawnNotice = row.withdrawn_notice;
  const withdrawn =
    withdrawnNotice != null &&
    typeof withdrawnNotice === "object" &&
    Object.keys(withdrawnNotice as object).length > 0;
  return {
    content_id: typeof row.content_id === "string" ? row.content_id : null,
    public_updated_at: typeof row.public_updated_at === "string" ? row.public_updated_at : null,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
    document_type: typeof row.document_type === "string" ? row.document_type : null,
    withdrawn,
    title: typeof row.title === "string" ? row.title : null,
    base_path: typeof row.base_path === "string" ? row.base_path : path,
  };
}

async function fetchGovukJson(url: string): Promise<
  { ok: true; status: number; payload: unknown } | GovukAdapterFailure
> {
  if (!url.startsWith(`${GOVUK_WWW_ORIGIN}/`)) {
    return { ok: false, error: "adapter_host_not_allowed" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
    });
    if (res.status === 410) {
      return { ok: false, error: "gone", status: 410 };
    }
    if (!res.ok) {
      return {
        ok: false,
        error: `http_${res.status}`,
        status: res.status,
        unsupported: res.status === 404 || res.status === 501,
      };
    }
    const payload = await res.json().catch(() => null);
    if (payload == null) return { ok: false, error: "invalid_json", status: res.status };
    return { ok: true, status: res.status, payload };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "network_error";
    return { ok: false, error: msg.slice(0, 200), unsupported: true };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchGovukSearch(params: GovukSearchParams): Promise<GovukSearchResult> {
  const fetched = await fetchGovukJson(govukSearchUrl(params));
  if (!fetched.ok) return fetched;
  return parseGovukSearchPayload(fetched.payload);
}

export async function fetchGovukContent(path: string): Promise<GovukContentResult> {
  let url: string;
  try {
    url = govukContentUrl(path);
  } catch {
    return { ok: false, error: "invalid_content_path" };
  }
  const fetched = await fetchGovukJson(url);
  if (!fetched.ok) return fetched;
  const raw =
    fetched.payload && typeof fetched.payload === "object"
      ? (fetched.payload as Record<string, unknown>)
      : {};
  return {
    ok: true,
    metadata: parseGovukContentMetadata(path, fetched.payload),
    raw,
  };
}

/** Bounded Search sample for catalogue review. Counts as Watch searches. */
export async function sampleGovukSearch(
  params: GovukSearchParams,
  maxPages = 3
): Promise<GovukSearchResult> {
  const pages = Math.max(1, Math.min(maxPages, 4));
  const count = Math.max(1, Math.min(params.count ?? 50, MAX_COUNT));
  const first = await fetchGovukSearch({ ...params, count, start: 0 });
  if (!first.ok) return first;
  const results = [...first.results];
  let start = count;
  for (let i = 1; i < pages && results.length < first.total; i += 1) {
    const next = await fetchGovukSearch({ ...params, count, start });
    if (!next.ok) {
      return {
        ok: true,
        total: first.total,
        start: 0,
        results,
      };
    }
    results.push(...next.results);
    start += count;
  }
  return { ok: true, total: first.total, start: 0, results };
}
