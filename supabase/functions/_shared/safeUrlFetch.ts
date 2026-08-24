/**
 * SSRF-hardened URL fetch for server-side intake (Knowledge URL, etc.).
 */

const MAX_BYTES = 15 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;

function isPrivateIpv4(a: number, b: number): boolean {
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

export function assertSafePublicUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("invalid_url");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("url_protocol_not_allowed");
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "0.0.0.0" ||
    host === "[::1]" ||
    host === "::1"
  ) {
    throw new Error("url_host_not_allowed");
  }

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const octets = ipv4.slice(1, 5).map((x) => Number(x));
    if (octets.some((n) => n > 255)) throw new Error("url_host_not_allowed");
    if (isPrivateIpv4(octets[0]!, octets[1]!)) throw new Error("url_host_not_allowed");
  }

  return parsed;
}

export async function safeFetchUrl(
  rawUrl: string
): Promise<{ bytes: Uint8Array; contentType: string; finalUrl: string; fileName: string }> {
  const parsed = assertSafePublicUrl(rawUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(parsed.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "Filla-Knowledge-Intake/1.0" },
    });

    if (!res.ok) throw new Error(`url_fetch_failed:${res.status}`);

    const finalUrl = res.url || parsed.toString();
    assertSafePublicUrl(finalUrl);

    const contentType = (res.headers.get("content-type") ?? "application/octet-stream")
      .split(";")[0]
      .trim()
      .toLowerCase();

    const reader = res.body?.getReader();
    if (!reader) throw new Error("url_empty_body");

    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.length;
      if (total > MAX_BYTES) throw new Error("url_response_too_large");
      chunks.push(value);
    }

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }

    const pathPart = new URL(finalUrl).pathname.split("/").pop() ?? "document";
    const fileName = decodeURIComponent(pathPart).replace(/[^\w.\-]+/g, "_").slice(0, 120) || "document.bin";

    return { bytes, contentType, finalUrl, fileName };
  } finally {
    clearTimeout(timer);
  }
}
