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
  "meeting-room": `${MINI_CARD_BASE}/meeting-room.png`,
  "office": `${MINI_CARD_BASE}/office.png`,
  "pantry": `${MINI_CARD_BASE}/pantry.png`,
  "phone-booth": `${MINI_CARD_BASE}/phone-booth.png`,
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
  if (SPACE_MINI_CARD_ILLUSTRATION[slug]) return SPACE_MINI_CARD_ILLUSTRATION[slug];
  const base = slug.replace(/-\d+$/, '');
  return SPACE_MINI_CARD_ILLUSTRATION[base];
}
