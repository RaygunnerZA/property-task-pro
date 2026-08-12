import {
  createAssetCustomCollectionId,
  isCustomAssetCollectionGroupId,
  type OnboardingAssetCustomCollection,
  type AssetSuggestionLabelOverrides,
} from "@/components/onboarding/onboardingAssetGroups";

export type PropertyCustomAssetGroupsState = {
  collections: OnboardingAssetCustomCollection[];
  /** Lowercase asset name → group / custom collection id */
  assetToCollection: Record<string, string>;
  suggestionLabelOverrides: AssetSuggestionLabelOverrides;
};

const storageKey = (propertyId: string) => `filla:property-custom-asset-groups:${propertyId}`;

export function loadPropertyCustomAssetGroups(
  propertyId: string
): PropertyCustomAssetGroupsState {
  if (typeof window === "undefined") {
    return { collections: [], assetToCollection: {}, suggestionLabelOverrides: {} };
  }
  try {
    const raw = window.localStorage.getItem(storageKey(propertyId));
    if (!raw) {
      return { collections: [], assetToCollection: {}, suggestionLabelOverrides: {} };
    }
    const parsed = JSON.parse(raw) as Partial<PropertyCustomAssetGroupsState>;
    return {
      collections: Array.isArray(parsed.collections) ? parsed.collections : [],
      assetToCollection:
        parsed.assetToCollection && typeof parsed.assetToCollection === "object"
          ? parsed.assetToCollection
          : {},
      suggestionLabelOverrides:
        parsed.suggestionLabelOverrides &&
        typeof parsed.suggestionLabelOverrides === "object"
          ? parsed.suggestionLabelOverrides
          : {},
    };
  } catch {
    return { collections: [], assetToCollection: {}, suggestionLabelOverrides: {} };
  }
}

export function savePropertyCustomAssetGroups(
  propertyId: string,
  state: PropertyCustomAssetGroupsState
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(propertyId), JSON.stringify(state));
  } catch {
    /* ignore quota errors */
  }
}

export function createPropertyAssetCustomCollection(
  name: string
): OnboardingAssetCustomCollection {
  return { id: createAssetCustomCollectionId(), name: name.trim() };
}

export { isCustomAssetCollectionGroupId };
