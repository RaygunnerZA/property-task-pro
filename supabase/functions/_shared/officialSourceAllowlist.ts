/**
 * Official-source host allowlist for Knowledge discovery / Watch.
 * Model-proposed URLs are untrusted; only allowlisted hosts may be researched or intaken.
 */

/** Hostname suffixes (no leading dot). Match exact or subdomain. */
export const OFFICIAL_SOURCE_HOST_SUFFIXES: readonly string[] = [
  // United Kingdom
  "gov.uk",
  "legislation.gov.uk",
  "gov.scot",
  "gov.wales",
  "nidirect.gov.uk",
  // France
  "legifrance.gouv.fr",
  "service-public.fr",
  "gouv.fr",
  // Switzerland
  "admin.ch",
  "fedlex.admin.ch",
  // Germany (property / building law)
  "gesetze-im-internet.de",
  // EU
  "europa.eu",
];

/** Predictable model typos → canonical host (hostname only, lowercased). */
export const OFFICIAL_SOURCE_HOST_TYPOS: Readonly<Record<string, string>> = {
  "legislation.gouv.fr": "legifrance.gouv.fr",
  "www.legislation.gouv.fr": "www.legifrance.gouv.fr",
  "legifrance.gov.fr": "legifrance.gouv.fr",
  "www.legifrance.gov.fr": "www.legifrance.gouv.fr",
  "legislation.gov.fr": "legifrance.gouv.fr",
};

export function normaliseHostname(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, "");
}

export function isOfficialSourceHost(hostname: string): boolean {
  const h = normaliseHostname(hostname);
  // Known typo hosts must be repaired before they count as official.
  if (OFFICIAL_SOURCE_HOST_TYPOS[h] || OFFICIAL_SOURCE_HOST_TYPOS[h.replace(/^www\./, "")]) {
    return false;
  }
  const bare = h.replace(/^www\./, "");
  if (!bare || !bare.includes(".")) return false;
  return OFFICIAL_SOURCE_HOST_SUFFIXES.some(
    (suffix) => bare === suffix || bare.endsWith(`.${suffix}`)
  );
}

/**
 * Apply known host typo repairs. Returns null if URL cannot be parsed.
 * Does not validate allowlist — call isOfficialSourceHost on the result.
 */
export function repairOfficialSourceUrl(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  const host = normaliseHostname(parsed.hostname);
  const repairedHost = OFFICIAL_SOURCE_HOST_TYPOS[host] ?? OFFICIAL_SOURCE_HOST_TYPOS[host.replace(/^www\./, "")] ?? host;
  if (repairedHost !== host) {
    parsed.hostname = repairedHost;
  }
  return parsed.toString();
}

export type OfficialSourceValidation =
  | { ok: true; url: string; repaired: boolean }
  | { ok: false; reason: "invalid_url" | "not_allowlisted"; detail: string; url?: string };

/** Sanitise + typo-repair + allowlist. Sync — no network. */
export function validateOfficialSourceUrl(raw: unknown): OfficialSourceValidation {
  if (typeof raw !== "string") {
    return { ok: false, reason: "invalid_url", detail: "URL is not a string" };
  }
  const trimmed = raw.trim();
  if (trimmed.length < 12 || trimmed.length > 2048) {
    return { ok: false, reason: "invalid_url", detail: "URL length out of bounds" };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: "invalid_url", detail: "Unparseable URL" };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "invalid_url", detail: "Only https URLs are allowed" };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: "invalid_url", detail: "Credentials in URL are not allowed" };
  }

  const repaired = repairOfficialSourceUrl(trimmed);
  if (!repaired) {
    return { ok: false, reason: "invalid_url", detail: "Could not normalise URL" };
  }
  const finalParsed = new URL(repaired);
  if (!isOfficialSourceHost(finalParsed.hostname)) {
    return {
      ok: false,
      reason: "not_allowlisted",
      detail: `Host “${finalParsed.hostname}” is not on the official-source allowlist`,
      url: repaired,
    };
  }
  return {
    ok: true,
    url: repaired,
    repaired: repaired !== trimmed && repaired.toLowerCase() !== trimmed.toLowerCase(),
  };
}

export type SourceProbeResult =
  | { ok: true; finalUrl: string; status: number; redirected: boolean }
  | {
      ok: false;
      label: "source needs repair";
      reason:
        | "not_allowlisted"
        | "invalid_url"
        | "dns_or_network"
        | "http_error"
        | "redirect_off_allowlist"
        | "empty_response";
      detail: string;
      proposedUrl: string;
      finalUrl?: string;
    };

const PROBE_TIMEOUT_MS = 12_000;

/**
 * Resolve redirects and confirm the URL is fetchable on an allowlisted host.
 * Does not download the body (aborts after headers when possible).
 */
export async function probeOfficialSourceUrl(rawUrl: string): Promise<SourceProbeResult> {
  const validated = validateOfficialSourceUrl(rawUrl);
  if (!validated.ok) {
    return {
      ok: false,
      label: "source needs repair",
      reason: validated.reason,
      detail: validated.detail,
      proposedUrl: typeof rawUrl === "string" ? rawUrl : "",
      finalUrl: validated.url,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    let res: Response;
    try {
      res = await fetch(validated.url, {
        method: "HEAD",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; FillaKnowledgeBot/1.0; +https://filla.app; research)",
          Accept: "text/html,application/xhtml+xml,application/pdf,text/plain;q=0.9,*/*;q=0.8",
        },
      });
      // Some hosts reject HEAD — fall through to GET.
      if (res.status === 405 || res.status === 501 || res.status === 403) {
        res = await fetch(validated.url, {
          method: "GET",
          redirect: "follow",
          signal: controller.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; FillaKnowledgeBot/1.0; +https://filla.app; research)",
            Accept: "text/html,application/xhtml+xml,application/pdf,text/plain;q=0.9,*/*;q=0.8",
            Range: "bytes=0-0",
          },
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "network_error";
      return {
        ok: false,
        label: "source needs repair",
        reason: "dns_or_network",
        detail: msg.slice(0, 300),
        proposedUrl: validated.url,
      };
    }

    const finalUrl = res.url || validated.url;
    let finalHost: string;
    try {
      finalHost = new URL(finalUrl).hostname;
    } catch {
      return {
        ok: false,
        label: "source needs repair",
        reason: "invalid_url",
        detail: "Redirect target was not a valid URL",
        proposedUrl: validated.url,
        finalUrl,
      };
    }

    if (!isOfficialSourceHost(finalHost)) {
      return {
        ok: false,
        label: "source needs repair",
        reason: "redirect_off_allowlist",
        detail: `Redirect landed on non-allowlisted host “${finalHost}”`,
        proposedUrl: validated.url,
        finalUrl,
      };
    }

    if (!res.ok && res.status !== 206) {
      return {
        ok: false,
        label: "source needs repair",
        reason: "http_error",
        detail: `HTTP ${res.status}`,
        proposedUrl: validated.url,
        finalUrl,
      };
    }

    // Drain/cancel body if GET returned one.
    try {
      await res.body?.cancel();
    } catch {
      /* ignore */
    }

    return {
      ok: true,
      finalUrl,
      status: res.status,
      redirected: finalUrl.replace(/\/$/, "") !== validated.url.replace(/\/$/, ""),
    };
  } finally {
    clearTimeout(timer);
  }
}
