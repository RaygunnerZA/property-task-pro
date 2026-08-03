/** Space mini-card banner art — catalog + match rules for space labels. */
import { resolveToCanonicalSpaceType } from "@/config/spaceTypeAliases";
import {
  isFuzzyMatchSimilarity,
  levenshteinDistance,
  normalizeString,
} from "@/services/ai/fuzzyMatch";

const MINI_CARD_BASE = "/spaces/mini-cards";

/** Generic indoor fallback when nothing matches — avoid office art for unknowns. */
const NEUTRAL_FALLBACK = `${MINI_CARD_BASE}/lobby.png`;
const OFFICE_FALLBACK = `${MINI_CARD_BASE}/office.png`;
const OFFICE_ALT = `${MINI_CARD_BASE}/office-2.png`;

export const SPACE_MINI_CARD_ILLUSTRATION: Record<string, string> = {
  "accessible-wc": `${MINI_CARD_BASE}/accessible-wc.png`,
  "air-compressor": `${MINI_CARD_BASE}/air-compressor.png`,
  "archive": `${MINI_CARD_BASE}/archive.png`,
  "archive-room": `${MINI_CARD_BASE}/archive-room.png`,
  "attic": `${MINI_CARD_BASE}/attic.png`,
  "balcony": `${MINI_CARD_BASE}/balcony.png`,
  "bar": `${MINI_CARD_BASE}/bar.png`,
  "basement": `${MINI_CARD_BASE}/basement.png`,
  "bathroom": `${MINI_CARD_BASE}/bathroom.png`,
  "bedroom": `${MINI_CARD_BASE}/bedroom.png`,
  "bike-store": `${MINI_CARD_BASE}/bike-store.png`,
  "bin-store": `${MINI_CARD_BASE}/bin-store.png`,
  "boiler-room": `${MINI_CARD_BASE}/boiler-room.png`,
  "boot-room": `${MINI_CARD_BASE}/boot-room.png`,
  "breakout-area": `${MINI_CARD_BASE}/breakout-area.png`,
  "building-exterior": `${MINI_CARD_BASE}/building-exterior.png`,
  "car-park": `${MINI_CARD_BASE}/car-park.png`,
  "chemical-storage": `${MINI_CARD_BASE}/chemical-storage.png`,
  "classroom": `${MINI_CARD_BASE}/classroom.png`,
  "cloak-room": `${MINI_CARD_BASE}/cloak-room.png`,
  "closet": `${MINI_CARD_BASE}/closet.png`,
  "copy-room": `${MINI_CARD_BASE}/copy-room.png`,
  "creative-studio": `${MINI_CARD_BASE}/creative-studio.png`,
  "cupboard": `${MINI_CARD_BASE}/cupboard.png`,
  "dining-room": `${MINI_CARD_BASE}/dining-room.png`,
  "dog-wash": `${MINI_CARD_BASE}/dog-wash.png`,
  "electrical-room": `${MINI_CARD_BASE}/electrical-room.png`,
  "elevator": `${MINI_CARD_BASE}/elevator.png`,
  "entrance": `${MINI_CARD_BASE}/entrance.png`,
  "entrance-hall": `${MINI_CARD_BASE}/entrance-hall.png`,
  "escalator": `${MINI_CARD_BASE}/escalator.png`,
  "exit": `${MINI_CARD_BASE}/exit.png`,
  "exterior-gate": `${MINI_CARD_BASE}/exterior-gate.png`,
  "fire-alarm-panel": `${MINI_CARD_BASE}/fire-alarm-panel.png`,
  "fire-escape": `${MINI_CARD_BASE}/fire-escape.png`,
  "fire-extinguisher": `${MINI_CARD_BASE}/fire-extinguisher.png`,
  "first-aid": `${MINI_CARD_BASE}/first-aid.png`,
  "games-room": `${MINI_CARD_BASE}/games-room.png`,
  "garage": `${MINI_CARD_BASE}/garage.png`,
  "garden": `${MINI_CARD_BASE}/garden.png`,
  "gym": `${MINI_CARD_BASE}/gym.png`,
  "hr-office": `${MINI_CARD_BASE}/hr-office.png`,
  "hvac-room": `${MINI_CARD_BASE}/hvac-room.png`,
  "kitchen": `${MINI_CARD_BASE}/kitchen.png`,
  "kitchen-terrace": `${MINI_CARD_BASE}/kitchen-terrace.png`,
  "laundry-room": `${MINI_CARD_BASE}/laundry-room.png`,
  "library": `${MINI_CARD_BASE}/library.png`,
  "lift": `${MINI_CARD_BASE}/lift.png`,
  "living-room": `${MINI_CARD_BASE}/living-room.png`,
  "loading-bay": `${MINI_CARD_BASE}/loading-bay.png`,
  "lobby": `${MINI_CARD_BASE}/lobby.png`,
  "locker-room": `${MINI_CARD_BASE}/locker-room.png`,
  "lounge": `${MINI_CARD_BASE}/lounge.png`,
  "mailroom": `${MINI_CARD_BASE}/mailroom.png`,
  "main-terrace": `${MINI_CARD_BASE}/main-terrace.png`,
  "mazot": `${MINI_CARD_BASE}/mazot.png`,
  "meeting-room": `${MINI_CARD_BASE}/meeting-room.png`,
  "meeting-room-2": `${MINI_CARD_BASE}/meeting-room-2.png`,
  "mezzanine": `${MINI_CARD_BASE}/mezzanine.png`,
  "muster-point": `${MINI_CARD_BASE}/muster-point.png`,
  "office": `${MINI_CARD_BASE}/office.png`,
  "office-2": `${MINI_CARD_BASE}/office-2.png`,
  "pantry": `${MINI_CARD_BASE}/pantry.png`,
  "pergola": `${MINI_CARD_BASE}/pergola.png`,
  "phone-booth": `${MINI_CARD_BASE}/phone-booth.png`,
  "playground": `${MINI_CARD_BASE}/playground.png`,
  "plant-room": `${MINI_CARD_BASE}/plant-room.png`,
  "print-room": `${MINI_CARD_BASE}/print-room.png`,
  "reception": `${MINI_CARD_BASE}/reception.png`,
  "retail-floor": `${MINI_CARD_BASE}/retail-floor.png`,
  "riser": `${MINI_CARD_BASE}/riser.png`,
  "roof": `${MINI_CARD_BASE}/roof.png`,
  "rooftop-plant": `${MINI_CARD_BASE}/rooftop-plant.png`,
  "security-code": `${MINI_CARD_BASE}/security-code.png`,
  "security-room": `${MINI_CARD_BASE}/security-room.png`,
  "server-room": `${MINI_CARD_BASE}/server-room.png`,
  "shower": `${MINI_CARD_BASE}/shower.png`,
  "spa": `${MINI_CARD_BASE}/spa.png`,
  "sprinkler-cabinet": `${MINI_CARD_BASE}/sprinkler-cabinet.png`,
  "staff-kitchen": `${MINI_CARD_BASE}/staff-kitchen.png`,
  "staircase": `${MINI_CARD_BASE}/staircase.png`,
  "storage-room": `${MINI_CARD_BASE}/storage-room.png`,
  "terrace": `${MINI_CARD_BASE}/terrace.png`,
  "ups-room": `${MINI_CARD_BASE}/ups-room.png`,
  "wc": `${MINI_CARD_BASE}/wc.png`,
  "workshop": `${MINI_CARD_BASE}/workshop.png`,
  "yoga-room": `${MINI_CARD_BASE}/yoga-room.png`,
};

/** Space type slugs without dedicated art → nearest mini-card slug. */
const SPACE_MINI_CARD_SLUG_ALIAS: Record<string, string> = {
  atrium: "lobby",
  boardroom: "meeting-room-2",
  "break-room": "breakout-area",
  "call-room": "phone-booth",
  canteen: "staff-kitchen",
  cellar: "basement",
  "changing-room": "locker-room",
  cinema: "games-room",
  cloakroom: "cloak-room",
  "collaboration-space": "breakout-area",
  "comms": "server-room",
  "comms-room": "server-room",
  "conference-room": "meeting-room",
  conservatory: "garden",
  corridor: "entrance-hall",
  courtyard: "garden",
  "courtyard-garden": "garden",
  "data-room": "server-room",
  deck: "terrace",
  "delivery-bay": "loading-bay",
  "disabled-toilet": "accessible-wc",
  "disabled-wc": "accessible-wc",
  driveway: "car-park",
  escalator: "escalator",
  "escape-stair": "staircase",
  "escape-stairs": "staircase",
  "ev-charging": "car-park",
  exterior: "building-exterior",
  facade: "building-exterior",
  "family-bathroom": "bathroom",
  "female-wc": "wc",
  "fire-exit": "exit",
  "fitness-room": "gym",
  "fitness-studio": "gym",
  "focus-room": "phone-booth",
  foyer: "entrance-hall",
  "front-door": "entrance",
  "front-gate": "exterior-gate",
  "back-entrance": "entrance",
  gate: "exterior-gate",
  gatehouse: "security-room",
  "generator-room": "electrical-room",
  "goods-in": "loading-bay",
  "guard-house": "security-room",
  "guest-room": "bedroom",
  "gym-studio": "gym",
  hallway: "entrance-hall",
  "home-office": "office-2",
  "hot-desk-area": "office-2",
  "hot-desking": "office-2",
  "internal-courtyard": "garden",
  "it-closet": "server-room",
  "it-room": "server-room",
  kitchenette: "staff-kitchen",
  laboratory: "creative-studio",
  landing: "staircase",
  "lift-lobby": "lobby",
  "lift-motor-room": "lift",
  loft: "attic",
  "main-stair": "staircase",
  "male-wc": "wc",
  "master-bedroom": "bedroom",
  "mechanical-room": "plant-room",
  "media-room": "games-room",
  "medical-room": "first-aid",
  mep: "plant-room",
  "mep-room": "plant-room",
  "mezzanine-floor": "mezzanine",
  mudroom: "boot-room",
  "mud-room": "boot-room",
  "nursing-room": "first-aid",
  "open-office": "office-2",
  "open-plan-office": "office-2",
  parking: "car-park",
  "parking-garage": "garage",
  patio: "terrace",
  plant: "plant-room",
  playroom: "games-room",
  pool: "spa",
  porch: "entrance",
  "powder-room": "wc",
  "prayer-room": "lounge",
  "quiet-room": "phone-booth",
  recycling: "bin-store",
  "riser-cupboard": "riser",
  "sales-floor": "retail-floor",
  sauna: "spa",
  "service-riser": "riser",
  "shower-block": "shower",
  "shower-room": "shower",
  "sitting-room": "lounge",
  stairwell: "staircase",
  "staff-room": "staff-kitchen",
  store: "storage-room",
  "store-room": "storage-room",
  "stock-room": "storage-room",
  study: "library",
  sunroom: "terrace",
  "switch-room": "electrical-room",
  "tea-point": "staff-kitchen",
  "toilet-block": "wc",
  toilet: "wc",
  "training-room": "classroom",
  utility: "laundry-room",
  "utility-room": "laundry-room",
  veranda: "pergola",
  vestibule: "entrance-hall",
  void: "mezzanine",
  "waiting-area": "reception",
  "war-room": "meeting-room-2",
  "waste-store": "bin-store",
  wellness: "spa",
  "wine-cellar": "basement",
  workspace: "office-2",
  yard: "garden",
  "yoga-studio": "yoga-room",
  "bike-parking": "bike-store",
  "cleaners-cupboard": "cupboard",
  "building-entrance": "entrance",
};

/**
 * Ordered keyword → slug rules for labels that miss exact / fuzzy match.
 * First match wins; keep more specific patterns first.
 */
const KEYWORD_ILLUSTRATION_RULES: Array<{ pattern: RegExp; slug: string }> = [
  { pattern: /\b(accessible|disabled|ada)\b.*\b(wc|toilet|loo|bathroom)\b|\b(wc|toilet)\b.*\b(accessible|disabled|ada)\b/, slug: "accessible-wc" },
  { pattern: /\b(male|female|unisex|staff|public)\b.*\b(wc|toilet|loo)\b|\b(wc|toilet|loo|restroom|lavatory)\b/, slug: "wc" },
  { pattern: /\b(shower|wet.?room)\b/, slug: "shower" },
  { pattern: /\b(bathroom|ensuite|en-suite)\b/, slug: "bathroom" },
  { pattern: /\b(stairwell|staircase|stairs|stair|escape.?stair)\b/, slug: "staircase" },
  { pattern: /\b(fire.?exit|emergency.?exit)\b/, slug: "exit" },
  { pattern: /\b(fire.?escape)\b/, slug: "fire-escape" },
  { pattern: /\b(elevator|lift)\b.*\b(lobby|hall)\b|\b(lift|elevator).?lobby\b/, slug: "lobby" },
  { pattern: /\b(elevator|lift)\b/, slug: "elevator" },
  { pattern: /\bescalator\b/, slug: "escalator" },
  { pattern: /\b(corridor|hallway|passage|passageway)\b/, slug: "entrance-hall" },
  { pattern: /\b(entrance|entry|front.?door|back.?door|back.?entrance)\b/, slug: "entrance" },
  { pattern: /\b(lobby|foyer|atrium|vestibule)\b/, slug: "lobby" },
  { pattern: /\b(reception|waiting)\b/, slug: "reception" },
  { pattern: /\b(plant|mep|mechanical|boiler|chiller)\b/, slug: "plant-room" },
  { pattern: /\b(electrical|switch.?room|distribution|db.?room)\b/, slug: "electrical-room" },
  { pattern: /\b(hvac|ahu|air.?handling)\b/, slug: "hvac-room" },
  { pattern: /\b(server|comms|data.?room|it.?closet|it.?room|rack.?room)\b/, slug: "server-room" },
  { pattern: /\b(ups)\b/, slug: "ups-room" },
  { pattern: /\b(riser)\b/, slug: "riser" },
  { pattern: /\b(chemical|hazmat)\b/, slug: "chemical-storage" },
  { pattern: /\b(bin|waste|refuse|recycling|rubbish)\b/, slug: "bin-store" },
  { pattern: /\b(bike|cycle).*(store|park|parking|shed)|\b(bike|cycle)\b/, slug: "bike-store" },
  { pattern: /\b(loading|delivery|goods.?in|goods.?out|dock)\b/, slug: "loading-bay" },
  { pattern: /\b(car.?park|parking|ev.?charg)/, slug: "car-park" },
  { pattern: /\b(garage)\b/, slug: "garage" },
  { pattern: /\b(gatehouse|guard.?house|security.?desk|security.?room)\b/, slug: "security-room" },
  { pattern: /\b(gate|gateway)\b/, slug: "exterior-gate" },
  { pattern: /\b(facade|façade|exterior|building.?envelope)\b/, slug: "building-exterior" },
  { pattern: /\b(garden|courtyard|yard|lawn)\b/, slug: "garden" },
  { pattern: /\b(roof.?terrace|main.?terrace|terrace|patio|deck)\b/, slug: "terrace" },
  { pattern: /\b(pergola|veranda|verandah)\b/, slug: "pergola" },
  { pattern: /\b(balcony)\b/, slug: "balcony" },
  { pattern: /\b(roof|rooftop)\b/, slug: "roof" },
  { pattern: /\b(kitchenette|tea.?point|break.?room|staff.?kitchen|canteen)\b/, slug: "staff-kitchen" },
  { pattern: /\b(kitchen)\b/, slug: "kitchen" },
  { pattern: /\b(pantry)\b/, slug: "pantry" },
  { pattern: /\b(laundry|utility)\b/, slug: "laundry-room" },
  { pattern: /\b(meeting|boardroom|conference|war.?room)\b/, slug: "meeting-room" },
  { pattern: /\b(collaboration|breakout|hot.?desk)\b/, slug: "breakout-area" },
  { pattern: /\b(phone.?booth|focus.?room|quiet.?room|call.?room)\b/, slug: "phone-booth" },
  { pattern: /\b(office|workspace|workstation)\b/, slug: "office-2" },
  { pattern: /\b(gym|fitness)\b/, slug: "gym" },
  { pattern: /\b(yoga)\b/, slug: "yoga-room" },
  { pattern: /\b(spa|sauna|wellness|pool|steam)\b/, slug: "spa" },
  { pattern: /\b(cinema|media.?room|games.?room|playroom)\b/, slug: "games-room" },
  { pattern: /\b(lounge|sitting|waiting.?lounge)\b/, slug: "lounge" },
  { pattern: /\b(library|study)\b/, slug: "library" },
  { pattern: /\b(bar|lounge.?bar)\b/, slug: "bar" },
  { pattern: /\b(dining|canteen.?dining)\b/, slug: "dining-room" },
  { pattern: /\b(bedroom|guest.?room)\b/, slug: "bedroom" },
  { pattern: /\b(living.?room)\b/, slug: "living-room" },
  { pattern: /\b(store|storage|stock.?room|cleaners)\b/, slug: "storage-room" },
  { pattern: /\b(cupboard|closet|locker)\b/, slug: "cupboard" },
  { pattern: /\b(archive|records)\b/, slug: "archive-room" },
  { pattern: /\b(workshop|maker|studio.?workshop)\b/, slug: "workshop" },
  { pattern: /\b(classroom|training)\b/, slug: "classroom" },
  { pattern: /\b(mezzanine)\b/, slug: "mezzanine" },
  { pattern: /\b(basement|cellar|wine)\b/, slug: "basement" },
  { pattern: /\b(attic|loft)\b/, slug: "attic" },
  { pattern: /\b(boot.?room|mud.?room|cloak)\b/, slug: "boot-room" },
  { pattern: /\b(dog.?wash|pet.?wash)\b/, slug: "dog-wash" },
  { pattern: /\b(mail|post.?room)\b/, slug: "mailroom" },
  { pattern: /\b(print|copy|repro)\b/, slug: "print-room" },
  { pattern: /\b(first.?aid|medical|nurse|nursing|mother.?room)\b/, slug: "first-aid" },
  { pattern: /\b(muster|assembly.?point)\b/, slug: "muster-point" },
  { pattern: /\b(sprinkler)\b/, slug: "sprinkler-cabinet" },
  { pattern: /\b(retail|sales.?floor|shop.?floor)\b/, slug: "retail-floor" },
];

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
  const aliasedBase = SPACE_MINI_CARD_SLUG_ALIAS[base] ?? base;
  return SPACE_MINI_CARD_ILLUSTRATION[aliasedBase] ?? SPACE_MINI_CARD_ILLUSTRATION[base];
}

function labelSimilarity(a: string, b: string): number {
  const na = normalizeString(a);
  const nb = normalizeString(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const longer = Math.max(na.length, nb.length);
  return 1 - levenshteinDistance(na, nb) / longer;
}

function illustrationFromKeywords(label: string): string | undefined {
  const text = label.trim().toLowerCase();
  if (!text) return undefined;
  for (const rule of KEYWORD_ILLUSTRATION_RULES) {
    if (rule.pattern.test(text)) {
      return SPACE_MINI_CARD_ILLUSTRATION[rule.slug];
    }
  }
  return undefined;
}

function isExplicitOfficeLabel(label: string | null | undefined): boolean {
  const slug = spaceTypeIllustrationSlug(label);
  if (!slug) return false;
  return (
    slug === "office" ||
    slug === "office-2" ||
    slug === "hr-office" ||
    slug === "home-office" ||
    slug === "open-plan-office" ||
    slug === "open-office" ||
    slug === "workspace" ||
    /(?:^|-)office(?:-|$)/.test(slug)
  );
}

/**
 * Pick the best mini-card thumbnail for a space label.
 * Exact / alias → keywords → fuzzy catalog match.
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

  const fromKeywords =
    illustrationFromKeywords(raw) ?? illustrationFromKeywords(canonical);
  if (fromKeywords) return fromKeywords;

  const query = normalizeString(canonical);
  const queryWords = query.split(/\s+/).filter((w) => w.length > 2);
  let bestSlug: string | null = null;
  let bestScore = 0.68;

  for (const slug of Object.keys(SPACE_MINI_CARD_ILLUSTRATION)) {
    // Prefer primary art (kitchen.png) over alternates (kitchen-2.png).
    if (/-\d+$/.test(slug)) continue;
    // Don't let weak fuzzy matches collapse everything onto office.
    if (slug === "office" || slug === "office-2" || slug === "hr-office") continue;
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

/** Resolved mini-card path, or a neutral indoor fallback when nothing matches. */
export function resolveSpaceMiniCardIllustration(
  spaceTypeName: string | null | undefined
): string {
  const matched = getSpaceMiniCardIllustration(spaceTypeName);
  if (matched) return matched;
  if (isExplicitOfficeLabel(spaceTypeName)) return OFFICE_FALLBACK;
  return NEUTRAL_FALLBACK;
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
 * Bare office art is treated as non-sticky when the space label is not clearly an office
 * (fixes older creates that stored the previous office fallback).
 */
export function getSpaceDisplayIllustration(space: {
  name?: string | null;
  type?: string | null;
  thumbnail_url?: string | null;
  spaceTypeName?: string | null;
}): string {
  const label = space.spaceTypeName ?? space.name ?? space.type;
  const resolved = resolveSpaceMiniCardIllustration(label);
  const override = space.thumbnail_url?.trim();
  if (!override) return resolved;

  const isGenericOffice =
    override === OFFICE_FALLBACK || override === OFFICE_ALT;
  if (isGenericOffice && !isExplicitOfficeLabel(label)) {
    return resolved;
  }

  return override;
}
