import {
  createCustomCollectionId,
  isCustomCollectionGroupId,
  type OnboardingCustomCollection,
} from "@/components/onboarding/onboardingSpaceGroups";

export type PropertyCustomSpaceGroupsState = {
  collections: OnboardingCustomCollection[];
  /** Lowercase space name → custom collection id */
  spaceToCollection: Record<string, string>;
};

const storageKey = (propertyId: string) => `filla:property-custom-space-groups:${propertyId}`;

export function loadPropertyCustomSpaceGroups(
  propertyId: string
): PropertyCustomSpaceGroupsState {
  if (typeof window === "undefined") {
    return { collections: [], spaceToCollection: {} };
  }
  try {
    const raw = window.localStorage.getItem(storageKey(propertyId));
    if (!raw) return { collections: [], spaceToCollection: {} };
    const parsed = JSON.parse(raw) as PropertyCustomSpaceGroupsState;
    return {
      collections: Array.isArray(parsed.collections) ? parsed.collections : [],
      spaceToCollection:
        parsed.spaceToCollection && typeof parsed.spaceToCollection === "object"
          ? parsed.spaceToCollection
          : {},
    };
  } catch {
    return { collections: [], spaceToCollection: {} };
  }
}

export function savePropertyCustomSpaceGroups(
  propertyId: string,
  state: PropertyCustomSpaceGroupsState
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(propertyId), JSON.stringify(state));
  } catch {
    /* ignore quota errors */
  }
}

export function createPropertyCustomCollection(name: string): OnboardingCustomCollection {
  return { id: createCustomCollectionId(), name: name.trim() };
}

export { isCustomCollectionGroupId };
