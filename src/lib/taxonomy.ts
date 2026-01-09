/**
 * Property DNA - Taxonomy Definitions
 * 
 * This file is the single source of truth for all property structure,
 * themes, and seeding logic. It defines the default taxonomy that gets
 * applied to every property in the system.
 * 
 * Source: @Docs/03_Data_Model.md
 */

// ============================================================================
// SPACE TAXONOMY
// ============================================================================

/**
 * Space Templates by Category
 * Defines all possible spaces organized by functional category
 */
export const SPACE_TEMPLATES = {
  Circulation: [
    "Corridor",
    "Hallway",
    "Staircase",
    "Landing",
    "Lobby",
  ],
  Habitable: [
    "Bedroom",
    "Living Room",
    "Office",
    "Meeting Room",
    "Classroom",
    "Sales Floor",
    "Workshop",
    "Studio",
  ],
  Service: [
    "Kitchen",
    "Break Area",
    "Utility Room",
    "Print Room",
    "Tea Point",
    "Staff Room",
  ],
  Sanitary: [
    "Bathroom",
    "Shower",
    "WC",
    "Disabled WC",
    "Changing Rooms",
  ],
  Storage: [
    "General Store",
    "Stock Room",
    "Archive",
    "Cupboard",
  ],
  Technical: [
    "Plant Room",
    "Server Room",
    "Electrical Room",
    "Boiler Room",
    "UPS Room",
    "Riser",
    "HVAC Room",
    "Lift Motor Room",
  ],
  External: [
    "Garden",
    "Terrace",
    "Car Park",
    "Loading Bay",
    "Yard",
    "Roof",
  ],
} as const;

/**
 * Space Category Type
 */
export type SpaceCategory = keyof typeof SPACE_TEMPLATES;

/**
 * All Space Names (flattened)
 */
export type SpaceName = typeof SPACE_TEMPLATES[SpaceCategory][number];

/**
 * Get all spaces for a category
 */
export function getSpacesForCategory(category: SpaceCategory): readonly string[] {
  return SPACE_TEMPLATES[category];
}

/**
 * Get all space names (flattened)
 */
export function getAllSpaceNames(): string[] {
  return Object.values(SPACE_TEMPLATES).flat();
}

// ============================================================================
// THEME TAXONOMY
// ============================================================================

/**
 * Default Themes by Group
 * Defines all themes organized by functional group
 */
export const DEFAULT_THEMES = {
  "Ownership & Legal": [
    "Lease",
    "Deeds",
    "Insurance",
    "Licences",
  ],
  Compliance: [
    "Fire Safety",
    "Electrical Safety",
    "Mechanical Safety",
    "Water Hygiene",
    "Asbestos",
    "Accessibility",
    "Energy (EPC)",
  ],
  "Asset Register": [
    "Mechanical",
    "Electrical",
    "Safety Systems",
    "Water Systems",
    "Lifts & Transport",
    "IT/AV",
    "Fabric",
  ],
  Utilities: [
    "Electricity",
    "Gas",
    "Water",
    "Broadband",
    "Solar",
  ],
  Contractors: [
    "Fire",
    "HVAC",
    "Electrical",
    "Plumbing",
    "Cleaning",
    "Waste",
    "Security",
    "Lifts",
    "Roofing",
    "Landscaping",
  ],
} as const;

/**
 * Theme Group Type
 */
export type ThemeGroup = keyof typeof DEFAULT_THEMES;

/**
 * Theme Name Type (all sub-themes flattened)
 */
export type ThemeName = typeof DEFAULT_THEMES[ThemeGroup][number];

/**
 * Get themes for a specific type
 * @param type - 'compliance' or 'assets'
 * @returns Flat array of theme names
 */
export function getThemesForType(
  type: 'compliance' | 'assets'
): readonly string[] {
  if (type === 'compliance') {
    return DEFAULT_THEMES.Compliance;
  }
  if (type === 'assets') {
    return DEFAULT_THEMES["Asset Register"];
  }
  return [];
}

/**
 * Get all themes for a group
 */
export function getThemesForGroup(group: ThemeGroup): readonly string[] {
  return DEFAULT_THEMES[group];
}

/**
 * Get all theme names (flattened)
 */
export function getAllThemeNames(): string[] {
  return Object.values(DEFAULT_THEMES).flat();
}

/**
 * Get all theme groups
 */
export function getAllThemeGroups(): ThemeGroup[] {
  return Object.keys(DEFAULT_THEMES) as ThemeGroup[];
}

// ============================================================================
// LEGACY EXPORTS (for backward compatibility)
// ============================================================================

/**
 * @deprecated Use SPACE_TEMPLATES instead
 * Default spaces for basic property seeding
 */
export const DEFAULT_SPACES = [
  {
    name: "Kitchen",
    space_type: "interior" as const,
  },
  {
    name: "Living Room",
    space_type: "interior" as const,
  },
  {
    name: "Bedroom",
    space_type: "interior" as const,
  },
  {
    name: "Bathroom",
    space_type: "interior" as const,
  },
  {
    name: "Exterior",
    space_type: "exterior" as const,
  },
  {
    name: "Basement",
    space_type: "interior" as const,
  },
  {
    name: "Attic",
    space_type: "interior" as const,
  },
] as const;

/**
 * @deprecated Use DEFAULT_THEMES instead
 * Default theme groups for basic property seeding
 */
export const DEFAULT_THEME_GROUPS = [
  {
    name: "Compliance",
    type: "group" as const,
    color: "#EB6834", // Coral (destructive color)
    icon: "shield-check",
  },
  {
    name: "Utilities",
    type: "group" as const,
    color: "#8EC9CE", // Teal (primary color)
    icon: "zap",
  },
  {
    name: "Maintenance",
    type: "group" as const,
    color: "#4ECDC4", // Teal variant
    icon: "wrench",
  },
  {
    name: "Safety",
    type: "group" as const,
    color: "#FF6B6B", // Red
    icon: "alert-triangle",
  },
  {
    name: "Assets",
    type: "group" as const,
    color: "#96CEB4", // Sage
    icon: "package",
  },
] as const;
