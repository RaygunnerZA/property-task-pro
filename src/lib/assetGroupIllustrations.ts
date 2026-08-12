/** Static PNGs in `public/spaces/group-cards/` — reused for asset group card banners. */
const ASSET_GROUP_TO_SPACE_ILLUSTRATION: Record<string, string> = {
  hvac: "technical",
  plumbing: "sanitary",
  electrical: "technical",
  appliances: "service",
  safety: "technical",
  structural: "habitable",
  exterior: "external",
  vehicles: "external",
  custom: "custom",
};

export function getAssetGroupCardIllustration(groupId: string): string | undefined {
  const spaceKey = ASSET_GROUP_TO_SPACE_ILLUSTRATION[groupId] ?? "custom";
  return `/spaces/group-cards/${spaceKey}.png`;
}
