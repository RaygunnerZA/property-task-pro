/**
 * Partition property spaces into Areas (parent containers) vs rooms.
 * Areas persist as spaces with parent_space_id null; rooms nest via parent_space_id.
 * @see onboardingPropertyAreas / AddSpaceScreen save path.
 */

import {
  ONBOARDING_PROPERTY_AREAS,
  getSuggestedAreaColor,
  type OnboardingArea,
} from "@/components/onboarding/onboardingPropertyAreas";

export type SpaceLike = {
  id: string;
  name: string | null;
  parent_space_id?: string | null;
  created_at?: string | null;
  icon_name?: string | null;
  floor_level?: string | null;
};

export function isKnownAreaName(name: string | null | undefined): boolean {
  const key = (name ?? "").toLowerCase().trim();
  if (!key) return false;
  return ONBOARDING_PROPERTY_AREAS.some((a) => a.label.toLowerCase() === key);
}

/** Area = root space that has children, matches a known area label, or was created as an area. */
export function isAreaSpace(space: SpaceLike, all: SpaceLike[]): boolean {
  if (space.parent_space_id) return false;
  if (all.some((s) => s.parent_space_id === space.id)) return true;
  if (isKnownAreaName(space.name)) return true;
  // Property Areas card inserts use icon_name "layers" + floor_level = name.
  const nameKey = (space.name ?? "").trim().toLowerCase();
  const floorKey = (space.floor_level ?? "").trim().toLowerCase();
  if (space.icon_name === "layers" && nameKey && floorKey === nameKey) {
    return true;
  }
  return false;
}

export function partitionPropertySpaces<T extends SpaceLike>(spaces: T[]) {
  const areas = spaces
    .filter((s) => isAreaSpace(s, spaces))
    .slice()
    .sort(
      (a, b) =>
        new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
    );

  const areaIds = new Set(areas.map((a) => a.id));

  const rooms = spaces.filter((s) => !areaIds.has(s.id));

  const roomsByAreaId: Record<string, T[]> = {};
  for (const area of areas) {
    roomsByAreaId[area.id] = [];
  }

  const unassigned: T[] = [];
  for (const room of rooms) {
    const parentId = room.parent_space_id ?? null;
    if (parentId && areaIds.has(parentId)) {
      roomsByAreaId[parentId].push(room);
    } else {
      unassigned.push(room);
    }
  }

  for (const areaId of Object.keys(roomsByAreaId)) {
    roomsByAreaId[areaId].sort(
      (a, b) =>
        new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
    );
  }

  return { areas, rooms, roomsByAreaId, unassigned };
}

export function toOnboardingAreas(areas: SpaceLike[]): OnboardingArea[] {
  return areas.map((a) => ({
    id: a.id,
    name: (a.name ?? "").trim() || "Area",
    color: getSuggestedAreaColor(a.name ?? "Area"),
  }));
}

export function spaceAreaByNameKeyFromPartition<T extends SpaceLike>(
  roomsByAreaId: Record<string, T[]>,
  areas: OnboardingArea[]
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const area of areas) {
    for (const room of roomsByAreaId[area.id] ?? []) {
      const key = (room.name ?? "").toLowerCase().trim();
      if (key) map[key] = area.id;
    }
  }
  return map;
}

export function selectedSpaceColorsFromPartition(
  spaceAreaByNameKey: Record<string, string>,
  areas: OnboardingArea[]
): Record<string, string> {
  const byId = new Map(areas.map((a) => [a.id, a.color]));
  const colors: Record<string, string> = {};
  for (const [nameKey, areaId] of Object.entries(spaceAreaByNameKey)) {
    const color = byId.get(areaId);
    if (color) colors[nameKey] = color;
  }
  return colors;
}
