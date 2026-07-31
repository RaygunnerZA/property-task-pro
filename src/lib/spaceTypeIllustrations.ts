/** Auto-generated from public/spaces/_manifest.json — space mini-card banner art. */
import { resolveToCanonicalSpaceType } from "@/config/spaceTypeAliases";
import {
  isFuzzyMatchSimilarity,
  levenshteinDistance,
  normalizeString,
} from "@/services/ai/fuzzyMatch";

const MINI_CARD_BASE = "/spaces/mini-cards";

export const SPACE_MINI_CARD_ILLUSTRATION: Record<string, string> = {
  "accessible-wc": `${MINI_CARD_BASE}/accessible-wc.png`,
  "archive": `${MINI_CARD_BASE}/archive.png`,
  "archive-room": `${MINI_CARD_BASE}/archive-room.png`,
  "attic": `${MINI_CARD_BASE}/attic.png`,
  "balcony": `${MINI_CARD_BASE}/balcony.png`,
  "bathroom": `${MINI_CARD_BASE}/bathroom.png`,
  "bedroom": `${MINI_CARD_BASE}/bedroom.png`,
  "bike-store": `${MINI_CARD_BASE}/bike-store.png`,
  "bin-store": `${MINI_CARD_BASE}/bin-store.png`,
  "boiler-room": `${MINI_CARD_BASE}/boiler-room.png`,
  "breakout-area": `${MINI_CARD_BASE}/breakout-area.png`,
  "car-park": `${MINI_CARD_BASE}/car-park.png`,
  "classroom": `${MINI_CARD_BASE}/classroom.png`,
  "closet": `${MINI_CARD_BASE}/closet.png`,
  "copy-room": `${MINI_CARD_BASE}/copy-room.png`,
  "creative-studio": `${MINI_CARD_BASE}/creative-studio.png`,
  "cupboard": `${MINI_CARD_BASE}/cupboard.png`,
  "dining-room": `${MINI_CARD_BASE}/dining-room.png`,
  "electrical-room": `${MINI_CARD_BASE}/electrical-room.png`,
  "elevator": `${MINI_CARD_BASE}/elevator.png`,
  "entrance": `${MINI_CARD_BASE}/entrance.png`,
  "exit": `${MINI_CARD_BASE}/exit.png`,
  "fire-escape": `${MINI_CARD_BASE}/fire-escape.png`,
  "first-aid": `${MINI_CARD_BASE}/first-aid.png`,
  "garage": `${MINI_CARD_BASE}/garage.png`,
  "garden": `${MINI_CARD_BASE}/garden.png`,
  "hr-office": `${MINI_CARD_BASE}/hr-office.png`,
  "hvac-room": `${MINI_CARD_BASE}/hvac-room.png`,
  "kitchen": `${MINI_CARD_BASE}/kitchen.png`,
  "laundry-room": `${MINI_CARD_BASE}/laundry-room.png`,
  "lift": `${MINI_CARD_BASE}/lift.png`,
  "living-room": `${MINI_CARD_BASE}/living-room.png`,
  "loading-bay": `${MINI_CARD_BASE}/loading-bay.png`,
  "lobby": `${MINI_CARD_BASE}/lobby.png`,
  "locker-room": `${MINI_CARD_BASE}/locker-room.png`,
  "mailroom": `${MINI_CARD_BASE}/mailroom.png`,
  "meeting-room": `${MINI_CARD_BASE}/meeting-room.png`,
  "meeting-room-2": `${MINI_CARD_BASE}/meeting-room-2.png`,
  "office": `${MINI_CARD_BASE}/office.png`,
  "office-2": `${MINI_CARD_BASE}/office-2.png`,
  "pantry": `${MINI_CARD_BASE}/pantry.png`,
  "phone-booth": `${MINI_CARD_BASE}/phone-booth.png`,
  "playground": `${MINI_CARD_BASE}/playground.png`,
  "plant-room": `${MINI_CARD_BASE}/plant-room.png`,
  "print-room": `${MINI_CARD_BASE}/print-room.png`,
  "reception": `${MINI_CARD_BASE}/reception.png`,
  "retail-floor": `${MINI_CARD_BASE}/retail-floor.png`,
  "riser": `${MINI_CARD_BASE}/riser.png`,
  "rooftop-plant": `${MINI_CARD_BASE}/rooftop-plant.png`,
  "security-room": `${MINI_CARD_BASE}/security-room.png`,
  "server-room": `${MINI_CARD_BASE}/server-room.png`,
  "shower": `${MINI_CARD_BASE}/shower.png`,
  "staff-kitchen": `${MINI_CARD_BASE}/staff-kitchen.png`,
  "staircase": `${MINI_CARD_BASE}/staircase.png`,
  "storage-room": `${MINI_CARD_BASE}/storage-room.png`,
  "terrace": `${MINI_CARD_BASE}/terrace.png`,
  "ups-room": `${MINI_CARD_BASE}/ups-room.png`,
  "wc": `${MINI_CARD_BASE}/wc.png`,
  "workshop": `${MINI_CARD_BASE}/workshop.png`,
};

/** Space type slugs without dedicated art → nearest mini-card slug. */
const SPACE_MINI_CARD_SLUG_ALIAS: Record<string, string> = {
  basement: "storage-room",
  boardroom: "meeting-room-2",
  "break-room": "breakout-area",
  "call-room": "phone-booth",
  canteen: "staff-kitchen",
  cellar: "storage-room",
  "changing-room": "locker-room",
  "comms-room": "server-room",
  "conference-room": "meeting-room",
  conservatory: "garden",
  corridor: "entrance",
  courtyard: "garden",
  "data-room": "server-room",
  "disabled-wc": "accessible-wc",
  "family-bathroom": "bathroom",
  "generator-room": "electrical-room",
  "guest-room": "bedroom",
  hallway: "entrance",
  "home-office": "office",
  "it-room": "server-room",
  laboratory: "creative-studio",
  landing: "staircase",
  library: "archive-room",
  "lift-motor-room": "lift",
  loft: "attic",
  lounge: "living-room",
  "master-bedroom": "bedroom",
  "mechanical-room": "plant-room",
  "medical-room": "first-aid",
  "open-plan-office": "office-2",
  parking: "car-park",
  playroom: "playground",
  "powder-room": "wc",
  roof: "rooftop-plant",
  "sales-floor": "retail-floor",
  "service-riser": "riser",
  "shower-block": "shower",
  "shower-room": "shower",
  "sitting-room": "living-room",
  "staff-room": "staff-kitchen",
  "stock-room": "storage-room",
  study: "office",
  sunroom: "terrace",
  "switch-room": "electrical-room",
  toilet: "wc",
  "training-room": "classroom",
  utility: "laundry-room",
  "utility-room": "laundry-room",
  yard: "garden",
};

export function spaceTypeIllustrationSlug(name: string | null | undefined): string {
  if (!name?.trim()) return "";
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function illustrationForSlug(slug: string): string | undefined {
  if (!slug) return undefined;
  const targetSlug = SPACE_MINI_CARD_SLUG_ALIAS[slug] ?? slug;
  if (SPACE_MINI_CARD_ILLUSTRATION[targetSlug]) return SPACE_MINI_CARD_ILLUSTRATION[targetSlug];
  const base = targetSlug.replace(/-\d+$/, "");
  return SPACE_MINI_CARD_ILLUSTRATION[base];
}

function labelSimilarity(a: string, b: string): number {
  const na = normalizeString(a);
  const nb = normalizeString(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const longer = Math.max(na.length, nb.length);
  return 1 - levenshteinDistance(na, nb) / longer;
}

/**
 * Pick the best mini-card thumbnail for a space label.
 * Exact / alias first, then fuzzy match against the spaces image catalog.
 */
export function getSpaceMiniCardIllustration(
  spaceTypeName: string | null | undefined
): string | undefined {
  const raw = spaceTypeName?.trim();
  if (!raw) return undefined;

  const canonical = resolveToCanonicalSpaceType(raw) ?? raw;
  const exact =
    illustrationForSlug(spaceTypeIllustrationSlug(raw)) ??
    illustrationForSlug(spaceTypeIllustrationSlug(canonical));
  if (exact) return exact;

  const query = normalizeString(canonical);
  const queryWords = query.split(/\s+/).filter((w) => w.length > 2);
  let bestSlug: string | null = null;
  let bestScore = 0.68;

  for (const slug of Object.keys(SPACE_MINI_CARD_ILLUSTRATION)) {
    // Prefer primary art (kitchen.png) over alternates (kitchen-2.png).
    if (/-\d+$/.test(slug)) continue;
    const label = slug.replace(/-/g, " ");
    if (!isFuzzyMatchSimilarity(query, label, 0.62)) continue;

    const overlap = queryWords.filter((w) => label.includes(w)).length;
    const score = labelSimilarity(query, label) + overlap * 0.06;
    if (score > bestScore) {
      bestScore = score;
      bestSlug = slug;
    }
  }

  return bestSlug ? SPACE_MINI_CARD_ILLUSTRATION[bestSlug] : undefined;
}

/** Resolved mini-card path, or a neutral fallback when nothing matches. */
export function resolveSpaceMiniCardIllustration(
  spaceTypeName: string | null | undefined
): string {
  return (
    getSpaceMiniCardIllustration(spaceTypeName) ??
    `${MINI_CARD_BASE}/office.png`
  );
}

export type SpaceMiniCardOption = {
  slug: string;
  src: string;
  label: string;
};

/** Catalog of pickable space mini-card thumbnails. */
export function listSpaceMiniCardIllustrations(): SpaceMiniCardOption[] {
  return Object.entries(SPACE_MINI_CARD_ILLUSTRATION)
    .map(([slug, src]) => ({
      slug,
      src,
      label: slug
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Display art for a space: persisted thumbnail override, else auto-matched mini-card.
 */
export function getSpaceDisplayIllustration(space: {
  name?: string | null;
  type?: string | null;
  thumbnail_url?: string | null;
  spaceTypeName?: string | null;
}): string {
  const override = space.thumbnail_url?.trim();
  if (override) return override;
  return resolveSpaceMiniCardIllustration(
    space.spaceTypeName ?? space.name ?? space.type
  );
}
