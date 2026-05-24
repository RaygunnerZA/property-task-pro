/** Auto-generated from public/spaces/_manifest.json — space mini-card banner art. */
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

export function getSpaceMiniCardIllustration(
  spaceTypeName: string | null | undefined
): string | undefined {
  const slug = spaceTypeIllustrationSlug(spaceTypeName);
  if (!slug) return undefined;
  const targetSlug = SPACE_MINI_CARD_SLUG_ALIAS[slug] ?? slug;
  if (SPACE_MINI_CARD_ILLUSTRATION[targetSlug]) return SPACE_MINI_CARD_ILLUSTRATION[targetSlug];
  const base = targetSlug.replace(/-\d+$/, "");
  return SPACE_MINI_CARD_ILLUSTRATION[base];
}
