/** Static PNGs in `public/spaces/group-cards/` — space group card banners. */
export const SPACE_GROUP_CARD_ILLUSTRATION: Record<string, string> = {
  circulation: "/spaces/group-cards/circulation.png",
  habitable: "/spaces/group-cards/habitable.png",
  service: "/spaces/group-cards/service.png",
  sanitary: "/spaces/group-cards/sanitary.png",
  storage: "/spaces/group-cards/storage.png",
  technical: "/spaces/group-cards/technical.png",
  external: "/spaces/group-cards/external.png",
};

export function getSpaceGroupCardIllustration(groupId: string): string | undefined {
  return SPACE_GROUP_CARD_ILLUSTRATION[groupId];
}
