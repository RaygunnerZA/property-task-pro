/**
 * Seasonal package release gates and derived display states.
 * DB status remains draft | approved | archived.
 * Customer visibility stays list_active_seasonal_packages (approved + window).
 */

import type {
  SeasonalCtaType,
  SeasonalPackage,
  SeasonalPackageItem,
  SeasonalPackageStatus,
} from "@/types/seasonalPackage";

export const SEASONAL_SURFACES = [
  {
    id: "home_inflow" as const,
    label: "Home / Inflow",
    requiresImage: false,
    requiresApprovedCreative: false,
  },
  {
    id: "property_rail" as const,
    label: "Property empty state / left rail",
    requiresImage: false,
    requiresApprovedCreative: false,
  },
  {
    id: "knowledge_library" as const,
    label: "Knowledge library",
    requiresImage: true,
    requiresApprovedCreative: true,
  },
] as const;

export const FUTURE_SEASONAL_SURFACES = [
  { id: "website", label: "Website" },
  { id: "newsletter", label: "Newsletter" },
  { id: "social", label: "Social" },
] as const;

export type SeasonalSurfaceId = (typeof SEASONAL_SURFACES)[number]["id"];

export type SeasonalCreativeStatus = "missing" | "draft" | "approved";

export type SeasonalPackageCreative = {
  status: SeasonalCreativeStatus;
  thumbnail_path: string | null;
  square_path: string | null;
  vertical_path: string | null;
  horizontal_path: string | null;
  alt_text: string;
  focal_point: { x: number; y: number } | null;
};

export type SeasonalDerivedReleaseState =
  | "draft"
  | "needs_content"
  | "needs_creative"
  | "ready_for_review"
  | "scheduled"
  | "live"
  | "ended"
  | "archived";

export type SeasonalReleaseGateId =
  | "has_items"
  | "published_knowledge"
  | "tip_ready"
  | "cta_ready"
  | "dates_valid"
  | "foundation_ready"
  | "creative_ready";

export type SeasonalReleaseGate = {
  id: SeasonalReleaseGateId;
  label: string;
  pass: boolean;
  detail?: string;
};

export type SeasonalPackageAdminItem = SeasonalPackageItem & {
  knowledge_status?: string | null;
  knowledge_applicability?: Record<string, unknown> | null;
};

export type SeasonalPackageAdminRow = Omit<SeasonalPackage, "items"> & {
  surfaces: SeasonalSurfaceId[];
  creative: SeasonalPackageCreative;
  approved_at?: string | null;
  item_count?: number;
  items_ready_count?: number;
  items?: SeasonalPackageAdminItem[];
};

export const EMPTY_CREATIVE: SeasonalPackageCreative = {
  status: "missing",
  thumbnail_path: null,
  square_path: null,
  vertical_path: null,
  horizontal_path: null,
  alt_text: "",
  focal_point: null,
};

const VALID_CTA: SeasonalCtaType[] = [
  "create_task",
  "upload_document",
  "add_asset",
  "open_knowledge",
  "none",
];

export function normalizeCreative(raw: unknown): SeasonalPackageCreative {
  const obj =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const statusRaw = typeof obj.status === "string" ? obj.status : "missing";
  const status: SeasonalCreativeStatus =
    statusRaw === "draft" || statusRaw === "approved" || statusRaw === "missing"
      ? statusRaw
      : "missing";
  const focal =
    obj.focal_point && typeof obj.focal_point === "object" && !Array.isArray(obj.focal_point)
      ? (obj.focal_point as Record<string, unknown>)
      : null;
  return {
    status,
    thumbnail_path: typeof obj.thumbnail_path === "string" ? obj.thumbnail_path : null,
    square_path: typeof obj.square_path === "string" ? obj.square_path : null,
    vertical_path: typeof obj.vertical_path === "string" ? obj.vertical_path : null,
    horizontal_path: typeof obj.horizontal_path === "string" ? obj.horizontal_path : null,
    alt_text: typeof obj.alt_text === "string" ? obj.alt_text : "",
    focal_point:
      focal && typeof focal.x === "number" && typeof focal.y === "number"
        ? { x: focal.x, y: focal.y }
        : null,
  };
}

export function normalizeSurfaces(raw: unknown): SeasonalSurfaceId[] {
  const allowed = new Set(SEASONAL_SURFACES.map((s) => s.id));
  if (!Array.isArray(raw)) return ["home_inflow", "property_rail"];
  const out: SeasonalSurfaceId[] = [];
  for (const item of raw) {
    if (typeof item === "string" && allowed.has(item as SeasonalSurfaceId)) {
      out.push(item as SeasonalSurfaceId);
    }
  }
  return out.length > 0 ? out : ["home_inflow", "property_rail"];
}

export function tipIsReleaseReady(tip: string | null | undefined): boolean {
  return (tip ?? "").trim().length >= 8;
}

export function ctaIsReleaseReady(
  ctaType: string | null | undefined,
  ctaLabel: string | null | undefined
): boolean {
  if (!ctaType || !VALID_CTA.includes(ctaType as SeasonalCtaType)) return false;
  return (ctaLabel ?? "").trim().length >= 1;
}

export function itemIsContentReady(item: SeasonalPackageAdminItem): boolean {
  if (item.knowledge_status && item.knowledge_status !== "published") return false;
  return tipIsReleaseReady(item.tip_text) && ctaIsReleaseReady(item.cta_type, item.cta_label);
}

export function surfacesRequireCreative(surfaces: SeasonalSurfaceId[]): boolean {
  return surfaces.some((id) => {
    const def = SEASONAL_SURFACES.find((s) => s.id === id);
    return Boolean(def?.requiresApprovedCreative);
  });
}

export function creativeMeetsSurfaceRequirements(
  creative: SeasonalPackageCreative,
  surfaces: SeasonalSurfaceId[]
): boolean {
  if (!surfacesRequireCreative(surfaces)) return true;
  if (creative.status !== "approved") return false;
  const hasImage = Boolean(creative.square_path || creative.horizontal_path);
  if (!hasImage) return false;
  return creative.alt_text.trim().length >= 3;
}

export function evaluateSeasonalReleaseGates(input: {
  title: string;
  introduction: string;
  display_from: string;
  display_until: string;
  surfaces: SeasonalSurfaceId[];
  creative: SeasonalPackageCreative;
  items: SeasonalPackageAdminItem[];
}): SeasonalReleaseGate[] {
  const items = input.items ?? [];
  const publishedOk = items.length > 0 && items.every((i) => !i.knowledge_status || i.knowledge_status === "published");
  const tipsOk = items.length > 0 && items.every((i) => tipIsReleaseReady(i.tip_text));
  const ctasOk = items.length > 0 && items.every((i) => ctaIsReleaseReady(i.cta_type, i.cta_label));
  const datesOk =
    Boolean(input.display_from) &&
    Boolean(input.display_until) &&
    input.display_until >= input.display_from;
  const foundationOk =
    input.title.trim().length >= 3 && input.introduction.trim().length >= 12 && datesOk;
  const creativeOk = creativeMeetsSurfaceRequirements(input.creative, input.surfaces);

  return [
    {
      id: "foundation_ready",
      label: "Title, introduction and dates",
      pass: foundationOk,
      detail: foundationOk ? undefined : "Need a clear title, introduction and valid window",
    },
    {
      id: "has_items",
      label: "At least one Knowledge item",
      pass: items.length > 0,
    },
    {
      id: "published_knowledge",
      label: "All linked Knowledge published",
      pass: publishedOk,
      detail: publishedOk ? undefined : "Only published Knowledge can ship in a package",
    },
    {
      id: "tip_ready",
      label: "Tip wording ready",
      pass: tipsOk,
    },
    {
      id: "cta_ready",
      label: "CTA configuration valid",
      pass: ctasOk,
    },
    {
      id: "dates_valid",
      label: "Display window valid",
      pass: datesOk,
    },
    {
      id: "creative_ready",
      label: surfacesRequireCreative(input.surfaces)
        ? "Required creative approved"
        : "Creative (optional for selected surfaces)",
      pass: creativeOk,
      detail: surfacesRequireCreative(input.surfaces)
        ? "Knowledge library requires approved square or horizontal image + alt text"
        : undefined,
    },
  ];
}

export function canApproveSeasonalPackage(gates: SeasonalReleaseGate[]): boolean {
  return gates.every((g) => g.pass);
}

export function deriveSeasonalReleaseState(
  pkg: Pick<
    SeasonalPackageAdminRow,
    | "status"
    | "display_from"
    | "display_until"
    | "surfaces"
    | "creative"
    | "title"
    | "introduction"
    | "items"
    | "item_count"
    | "items_ready_count"
  >,
  today: Date = new Date()
): SeasonalDerivedReleaseState {
  const status = pkg.status as SeasonalPackageStatus;
  if (status === "archived") return "archived";

  const y = today.getUTCFullYear();
  const m = String(today.getUTCMonth() + 1).padStart(2, "0");
  const d = String(today.getUTCDate()).padStart(2, "0");
  const day = `${y}-${m}-${d}`;

  if (status === "approved") {
    if (day < pkg.display_from) return "scheduled";
    if (day > pkg.display_until) return "ended";
    return "live";
  }

  const surfaces = normalizeSurfaces(pkg.surfaces);
  const creative = normalizeCreative(pkg.creative);
  const items = pkg.items;

  if (items && items.length > 0) {
    const gates = evaluateSeasonalReleaseGates({
      title: pkg.title,
      introduction: pkg.introduction,
      display_from: pkg.display_from,
      display_until: pkg.display_until,
      surfaces,
      creative,
      items,
    });
    const contentPass = gates
      .filter((g) => g.id !== "creative_ready")
      .every((g) => g.pass);
    const creativePass = gates.find((g) => g.id === "creative_ready")?.pass ?? true;
    if (!contentPass) return "needs_content";
    if (!creativePass) return "needs_creative";
    if (canApproveSeasonalPackage(gates)) return "ready_for_review";
    return "draft";
  }

  const itemCount = pkg.item_count ?? 0;
  const readyCount = pkg.items_ready_count ?? 0;
  const foundationOk =
    pkg.title.trim().length >= 3 &&
    pkg.introduction.trim().length >= 12 &&
    pkg.display_until >= pkg.display_from;

  if (!foundationOk || itemCount === 0 || readyCount < itemCount) {
    return "needs_content";
  }
  if (!creativeMeetsSurfaceRequirements(creative, surfaces)) {
    return "needs_creative";
  }
  return "ready_for_review";
}

export function primarySeasonalAction(
  derived: SeasonalDerivedReleaseState,
  displayFrom: string,
  today: Date = new Date()
): { label: string; kind: "save_draft" | "approve_schedule" | "approve_publish" | "archive" | "none" } {
  if (derived === "archived" || derived === "ended") {
    return { label: "View package", kind: "none" };
  }
  if (derived === "live" || derived === "scheduled") {
    return { label: "Open package", kind: "none" };
  }
  if (derived === "ready_for_review") {
    const y = today.getUTCFullYear();
    const m = String(today.getUTCMonth() + 1).padStart(2, "0");
    const d = String(today.getUTCDate()).padStart(2, "0");
    const day = `${y}-${m}-${d}`;
    if (day < displayFrom) {
      return { label: "Approve and schedule", kind: "approve_schedule" };
    }
    return { label: "Approve and publish package", kind: "approve_publish" };
  }
  return { label: "Continue editing", kind: "save_draft" };
}

export function packageStoragePrefix(slug: string): string {
  const safe = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `packages/${safe || "untitled"}`;
}

export function audienceLabel(applicability: Record<string, unknown> | null | undefined): string {
  const audiences = Array.isArray(applicability?.audiences)
    ? (applicability?.audiences as unknown[]).filter((a): a is string => typeof a === "string")
    : [];
  if (audiences.length === 0) return "All audiences";
  return audiences
    .map((a) => a.charAt(0).toUpperCase() + a.slice(1))
    .join(" · ");
}
