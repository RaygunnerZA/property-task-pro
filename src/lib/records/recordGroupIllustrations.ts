import type { RecordGroupId } from "@/lib/records/recordGroups";

/**
 * Thematic banners for record category cards in `public/records/group-cards/`.
 * Suggested canvas: ~400×230 landscape; cards crop with `object-cover`.
 */
export const RECORD_GROUP_CARD_FILENAMES: Record<RecordGroupId, string> = {
  compliance: "compliance.png",
  Plans: "plans.png",
  Legal: "legal.png",
  "Fire Safety": "fire-safety.png",
  Electrical: "electrical.png",
  Mechanical: "mechanical.png",
  Water: "water.png",
  Insurance: "insurance.png",
  Contractors: "contractors.png",
  Warranties: "warranties.png",
  "O&M Manuals": "om-manuals.png",
  Misc: "misc.png",
  uncategorised: "uncategorised.png",
};

/** Groups that currently have dedicated paper-cut art shipped. */
const DEDICATED_GROUP_ART = new Set<RecordGroupId>([
  "compliance",
  "Plans",
  "Legal",
  "Fire Safety",
  "Electrical",
  "Mechanical",
  "Water",
  "Insurance",
  "Contractors",
  "Warranties",
  "O&M Manuals",
  "Misc",
  "uncategorised",
]);

/** Interim stand-ins from `public/spaces/group-cards/` for groups without dedicated art. */
const SPACE_GROUP_FALLBACK: Partial<Record<RecordGroupId, string>> = {};


/** Path for the thematic asset (design handoff / upload target). */
export function recordGroupCardDedicatedPath(groupId: RecordGroupId): string {
  return `/records/group-cards/${RECORD_GROUP_CARD_FILENAMES[groupId]}`;
}

export function recordGroupCardHasDedicatedArt(groupId: RecordGroupId): boolean {
  return DEDICATED_GROUP_ART.has(groupId);
}

/** Banner image for a record group card. */
export function getRecordGroupCardIllustration(groupId: RecordGroupId): string {
  if (DEDICATED_GROUP_ART.has(groupId)) {
    return `${recordGroupCardDedicatedPath(groupId)}?v=3`;
  }
  const spaceKey = SPACE_GROUP_FALLBACK[groupId] ?? "custom";
  return `/spaces/group-cards/${spaceKey}.png`;
}
