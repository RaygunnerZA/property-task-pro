import {
  createCustomCollectionId,
  isCustomCollectionGroupId,
  type OnboardingCustomCollection,
  type SuggestionLabelOverrides,
} from "@/components/onboarding/onboardingSpaceGroups";

export type PropertyCustomSpaceGroupsState = {
  collections: OnboardingCustomCollection[];
  /** Lowercase space name → group / custom collection id */
  spaceToCollection: Record<string, string>;
  /** Lowercase original suggestion → current display label (renamed chips). */
  suggestionLabelOverrides: SuggestionLabelOverrides;
};

const storageKey = (propertyId: string) => `filla:property-custom-space-groups:${propertyId}`;

export function loadPropertyCustomSpaceGroups(
  propertyId: string
): PropertyCustomSpaceGroupsState {
  if (typeof window === "undefined") {
    return { collections: [], spaceToCollection: {}, suggestionLabelOverrides: {} };
  }
  try {
    const raw = window.localStorage.getItem(storageKey(propertyId));
    if (!raw) {
      return { collections: [], spaceToCollection: {}, suggestionLabelOverrides: {} };
    }
    const parsed = JSON.parse(raw) as Partial<PropertyCustomSpaceGroupsState>;
    return {
      collections: Array.isArray(parsed.collections) ? parsed.collections : [],
      spaceToCollection:
        parsed.spaceToCollection && typeof parsed.spaceToCollection === "object"
          ? parsed.spaceToCollection
          : {},
      suggestionLabelOverrides:
        parsed.suggestionLabelOverrides &&
        typeof parsed.suggestionLabelOverrides === "object"
          ? parsed.suggestionLabelOverrides
          : {},
    };
  } catch {
    return { collections: [], spaceToCollection: {}, suggestionLabelOverrides: {} };
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
