/**
 * Static config for property Assets group cards → ghost chip flow.
 * No DB; used for hover-reveal suggestion chips on asset group cards.
 */

export type AssetGroup = {
  id: string;
  label: string;
  description: string;
  color: string;
  suggestedAssets: string[];
  /** Maps asset_type values (lowercase) to this group. */
  assetTypes?: string[];
};

export const CUSTOM_ASSET_COLLECTION_ID_PREFIX = "custom-asset-";

export const CUSTOM_ASSET_COLLECTION_DEFAULT_LABEL = "Custom Collection";

export const CUSTOM_ASSET_COLLECTION_DESCRIPTION =
  "Create your own group of assets.";

export type OnboardingAssetCustomCollection = {
  id: string;
  name: string;
  imageSrc?: string;
};

export function createAssetCustomCollectionId(): string {
  return `${CUSTOM_ASSET_COLLECTION_ID_PREFIX}${crypto.randomUUID()}`;
}

export function isCustomAssetCollectionGroupId(groupId: string): boolean {
  return groupId.startsWith(CUSTOM_ASSET_COLLECTION_ID_PREFIX);
}

export type GroupExtraAsset = {
  name: string;
  insertAfter?: string;
};

export type AssetSuggestionLabelOverrides = Record<string, string>;

export function getAssetGroupById(id: string): AssetGroup | undefined {
  return ONBOARDING_ASSET_GROUPS.find((g) => g.id === id);
}

export function getAssetGroupColor(groupId: string): string {
  return getAssetGroupById(groupId)?.color ?? "#8EC9CE";
}

export function getGroupIdFromAssetType(assetType: string): string | undefined {
  const key = assetType.toLowerCase().trim();
  for (const group of ONBOARDING_ASSET_GROUPS) {
    if (group.assetTypes?.some((t) => t.toLowerCase() === key)) {
      return group.id;
    }
  }
  return undefined;
}

export const ONBOARDING_ASSET_GROUPS: AssetGroup[] = [
  {
    id: "hvac",
    label: "HVAC & Heating",
    description:
      "Boilers, air conditioning, heat pumps, ventilation, and other climate-control plant.",
    color: "#6C757D",
    assetTypes: ["hvac", "boiler"],
    suggestedAssets: ["Boiler", "Air Conditioning", "Heat Pump", "Ventilation Unit", "Chiller"],
  },
  {
    id: "plumbing",
    label: "Plumbing",
    description: "Water heaters, pumps, pipework, taps, and sanitary fittings tied to water systems.",
    color: "#E76F51",
    assetTypes: ["plumbing"],
    suggestedAssets: ["Water Heater", "Pump", "Tap", "Toilet", "Pipework"],
  },
  {
    id: "electrical",
    label: "Electrical",
    description: "Switchgear, distribution boards, generators, lighting panels, and power infrastructure.",
    color: "#F4A261",
    assetTypes: ["electrical"],
    suggestedAssets: ["Fuse Board", "Switchgear", "Generator", "Lighting Panel", "EV Charger"],
  },
  {
    id: "appliances",
    label: "Appliances",
    description: "Kitchen, laundry, and commercial appliances installed in habitable or service spaces.",
    color: "#A8D5BA",
    assetTypes: ["appliance"],
    suggestedAssets: ["Fridge", "Oven", "Dishwasher", "Washer", "Dryer"],
  },
  {
    id: "safety",
    label: "Safety & Security",
    description: "Fire alarms, extinguishers, emergency lighting, CCTV, and life-safety equipment.",
    color: "#EB6834",
    suggestedAssets: ["Fire Alarm", "Extinguisher", "Emergency Lighting", "CCTV", "Sprinkler"],
  },
  {
    id: "structural",
    label: "Building Fabric",
    description: "Roofs, windows, doors, lifts, and other structural or envelope elements.",
    color: "#D4A574",
    suggestedAssets: ["Roof", "Window", "Door", "Lift", "Staircase"],
  },
  {
    id: "exterior",
    label: "External",
    description: "Gates, fencing, external lighting, car park barriers, and outdoor equipment.",
    color: "#95A5A6",
    suggestedAssets: ["Gates", "Fencing", "External Lighting", "Car Park Barrier", "Irrigation"],
  },
  {
    id: "vehicles",
    label: "Vehicles",
    description: "Company vans, forklifts, trailers, and other mobile assets.",
    color: "#8EC9CE",
    assetTypes: ["vehicle"],
    suggestedAssets: ["Van", "Forklift", "Trailer", "Company Car", "Golf Cart"],
  },
];
