import { useMemo } from "react";

const DEV_EMBED_PARAM = "__devEmbed";

/**
 * True when the app was loaded with `?__devEmbed=1` (dev viewport iframe).
 * Hides duplicate dev chrome; value stays true for the session after client-side navigations.
 */
export function useDevEmbedLayout(): boolean {
  return useMemo(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get(DEV_EMBED_PARAM) === "1",
    []
  );
}

export function buildDevEmbedUrl(href: string): string {
  const url = new URL(href, window.location.origin);
  url.searchParams.set(DEV_EMBED_PARAM, "1");
  return url.toString();
}
