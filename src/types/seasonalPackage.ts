/** Seasonal editorial packages over published Knowledge. */

export type SeasonalSeason = "spring" | "summer" | "autumn" | "winter";
export type SeasonalHemisphere = "northern" | "southern" | "either";
export type SeasonalUrgencyBand = "timely" | "evergreen";
export type SeasonalPackageStatus = "draft" | "approved" | "archived";

export type SeasonalCtaType =
  | "create_task"
  | "upload_document"
  | "add_asset"
  | "open_knowledge"
  | "none";

export type SeasonalPackageItem = {
  id: string;
  knowledge_id: string;
  tip_output_id: string | null;
  tip_text: string;
  why_now: string | null;
  cta_type: SeasonalCtaType;
  cta_label: string;
  display_order: number;
  knowledge_title: string | null;
  knowledge_summary: string | null;
};

export type SeasonalPackage = {
  id: string;
  slug: string;
  title: string;
  introduction: string;
  season: SeasonalSeason;
  hemisphere: SeasonalHemisphere;
  display_from: string;
  display_until: string;
  urgency_band: SeasonalUrgencyBand;
  prep_window_label: string | null;
  applicability: Record<string, unknown>;
  status: SeasonalPackageStatus;
  version: number;
  org_id: string | null;
  items: SeasonalPackageItem[];
};

/** Soft ranking only — never implies missing work from absent inventory. */
export type SeasonalSoftSignal = {
  /** True when the property has no heating-like asset recorded. */
  noHeatingAssetRecorded?: boolean;
  /** True when no certificate/document has been uploaded for the property. */
  noCertificateUploaded?: boolean;
};

export function packageIsInDisplayWindow(
  pkg: Pick<SeasonalPackage, "display_from" | "display_until">,
  today: Date = new Date()
): boolean {
  const y = today.getUTCFullYear();
  const m = String(today.getUTCMonth() + 1).padStart(2, "0");
  const d = String(today.getUTCDate()).padStart(2, "0");
  const day = `${y}-${m}-${d}`;
  return day >= pkg.display_from && day <= pkg.display_until;
}

/**
 * Prefer packages whose CTAs match known inventory gaps for ranking only.
 * Absence of data is not evidence that work is incomplete.
 */
export function softRankSeasonalPackages(
  packages: SeasonalPackage[],
  signals: SeasonalSoftSignal = {}
): SeasonalPackage[] {
  const score = (pkg: SeasonalPackage) => {
    let n = 0;
    for (const item of pkg.items) {
      if (signals.noHeatingAssetRecorded && item.cta_type === "add_asset") n += 2;
      if (signals.noCertificateUploaded && item.cta_type === "upload_document") n += 2;
      if (item.cta_type === "create_task") n += 1;
    }
    return n;
  };
  return [...packages].sort((a, b) => {
    const diff = score(b) - score(a);
    if (diff !== 0) return diff;
    return b.display_from.localeCompare(a.display_from);
  });
}

export function pickTopSeasonalPackage(
  packages: SeasonalPackage[],
  signals?: SeasonalSoftSignal
): SeasonalPackage | null {
  const withItems = packages.filter((pkg) => pkg.items.length > 0);
  if (withItems.length === 0) return null;
  return softRankSeasonalPackages(withItems, signals)[0] ?? null;
}
