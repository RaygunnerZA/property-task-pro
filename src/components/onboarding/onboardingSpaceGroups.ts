/**
 * Static config for Add Spaces onboarding card → ghost chip flow.
 * No DB; used only for hover-reveal suggestion chips on space group cards.
 */

/** Shorten "room" to "rm" for space chip display (e.g. "Living Room" → "Living Rm"). */
export function shortSpaceLabel(name: string): string {
  return name.replace(/\broom\b/gi, (m) => (m[0] === "R" ? "Rm" : "rm"));
}

export type SpaceGroup = {
  id: string;
  label: string;
  description: string;
  color: string;
  suggestedSpaces: string[];
};

/** Get a space group by id (for routing). */
export function getSpaceGroupById(id: string): SpaceGroup | undefined {
  return ONBOARDING_SPACE_GROUPS.find((g) => g.id === id);
}

/** Get group color by id. Falls back to primary teal if not found. */
export function getGroupColor(groupId: string): string {
  return getSpaceGroupById(groupId)?.color ?? "#8EC9CE";
}

/** Map default_ui_group (DB) to group id. Used for filtering spaces by group. */
export function getGroupIdFromDefaultUiGroup(defaultUiGroup: string): string | undefined {
  const group = ONBOARDING_SPACE_GROUPS.find(
    (g) => g.label.toLowerCase() === defaultUiGroup?.toLowerCase()
  );
  return group?.id;
}

/** Map group label/name to URL slug (e.g. "Circulation" -> "circulation"). */
export function groupLabelToSlug(label: string): string {
  const group = ONBOARDING_SPACE_GROUPS.find(
    (g) => g.label.toLowerCase() === label.toLowerCase()
  );
  return group?.id ?? label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export const ONBOARDING_SPACE_GROUPS: SpaceGroup[] = [
  {
    id: "circulation",
    label: "Circulation",
    description: "Corridors, hallways, staircases, and other movement areas that connect spaces throughout the property.",
    color: "#8EC9CE",
    suggestedSpaces: ["Corridor", "Hallway", "Staircase", "Lobby", "Entrance"],
  },
  {
    id: "habitable",
    label: "Habitable / Working",
    description: "Living, working, and activity spaces including bedrooms, offices, meeting rooms, and sales floors.",
    color: "#A8D5BA",
    suggestedSpaces: ["Living Room", "Bedroom", "Office", "Kitchen", "Meeting Room", "Sales Floor"],
  },
  {
    id: "service",
    label: "Service Areas",
    description: "Support spaces like kitchens, break areas, utility rooms, and staff facilities.",
    color: "#F4A261",
    suggestedSpaces: ["Kitchen", "Break Room", "Utility Room", "Staff Room", "Pantry"],
  },
  {
    id: "sanitary",
    label: "Sanitary Spaces",
    description: "Bathrooms, WCs, showers, changing rooms, and other hygiene facilities.",
    color: "#E76F51",
    suggestedSpaces: ["Bathroom", "WC", "Shower", "Changing Room", "Toilet"],
  },
  {
    id: "storage",
    label: "Storage",
    description: "Storage rooms, stock rooms, archives, cupboards, and other spaces for keeping items.",
    color: "#D4A574",
    suggestedSpaces: ["Storage Room", "Closet", "Cupboard", "Archive", "Stock Room"],
  },
  {
    id: "technical",
    label: "Technical / Plant",
    description: "Plant rooms, server rooms, electrical rooms, boiler rooms, and mechanical infrastructure spaces.",
    color: "#6C757D",
    suggestedSpaces: ["Server Room", "Plant Room", "Electrical Room", "Boiler Room", "Mechanical Room"],
  },
  {
    id: "external",
    label: "External Areas",
    description: "Outdoor spaces including gardens, terraces, car parks, loading bays, yards, and roof areas.",
    color: "#95A5A6",
    suggestedSpaces: ["Garden", "Terrace", "Car Park", "Loading Bay", "Yard", "Roof"],
  },
];
