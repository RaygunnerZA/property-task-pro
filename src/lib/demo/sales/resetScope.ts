/** Slugs the sales-demo reset is allowed to replace. Linden is never included. */
export const SALES_HOME_SLUG = "demo-sales-home";
export const SALES_OPS_SLUG = "demo-sales-ops";
export const LINDEN_SLUG_PREFIX = "demo-linden-";
export const PRODUCTION_SUPABASE_REF = "gbtexoyvfpnduykmxunc";

export type SalesResetTarget = "home" | "ops" | "both";

export function salesSlugsFor(target: SalesResetTarget): string[] {
  if (target === "home") return [SALES_HOME_SLUG];
  if (target === "ops") return [SALES_OPS_SLUG];
  return [SALES_HOME_SLUG, SALES_OPS_SLUG];
}

export function salesResetWouldTouch(slug: string, target: SalesResetTarget): boolean {
  return salesSlugsFor(target).includes(slug);
}

export function projectRefFromSupabaseUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    if (host === "127.0.0.1" || host === "localhost") return null;
    const ref = host.split(".")[0];
    return ref || null;
  } catch {
    return null;
  }
}

export function assertSalesSeedTarget(url: string, allowlist: string[], allowLiveDemo = false): void {
  if (!url) throw new Error("Need SUPABASE_URL or VITE_SUPABASE_URL.");
  if (url.includes(PRODUCTION_SUPABASE_REF)) {
    if (!allowLiveDemo) {
      throw new Error(`Refusing to seed production project ${PRODUCTION_SUPABASE_REF}.`);
    }
    return;
  }
  const local = /127\.0\.0\.1|localhost/.test(url);
  if (local) return;
  const ref = projectRefFromSupabaseUrl(url);
  if (!ref || !allowlist.includes(ref)) {
    throw new Error(
      "Refusing hosted Supabase. Set SALES_DEMO_PROJECT_IDS to the allowlisted demo project ref, or point SUPABASE_URL at local 127.0.0.1."
    );
  }
  if (allowlist.includes(PRODUCTION_SUPABASE_REF)) {
    throw new Error(`Refusing to seed production project ${PRODUCTION_SUPABASE_REF}.`);
  }
}
