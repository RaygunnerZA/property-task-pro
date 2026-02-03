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
  suggestedSpaces: string[];
};

export const ONBOARDING_SPACE_GROUPS: SpaceGroup[] = [
  {
    id: "circulation",
    label: "Circulation",
    description: "Corridors, hallways, staircases, and other movement areas that connect spaces throughout the property.",
    suggestedSpaces: ["Corridor", "Hallway", "Staircase", "Lobby", "Entrance"],
  },
  {
    id: "habitable",
    label: "Habitable / Working",
    description: "Living, working, and activity spaces including bedrooms, offices, meeting rooms, and sales floors.",
    suggestedSpaces: ["Living Room", "Bedroom", "Office", "Kitchen", "Meeting Room", "Sales Floor"],
  },
  {
    id: "service",
    label: "Service Areas",
    description: "Support spaces like kitchens, break areas, utility rooms, and staff facilities.",
    suggestedSpaces: ["Kitchen", "Break Room", "Utility Room", "Staff Room", "Pantry"],
  },
  {
    id: "sanitary",
    label: "Sanitary Spaces",
    description: "Bathrooms, WCs, showers, changing rooms, and other hygiene facilities.",
    suggestedSpaces: ["Bathroom", "WC", "Shower", "Changing Room", "Toilet"],
  },
  {
    id: "storage",
    label: "Storage",
    description: "Storage rooms, stock rooms, archives, cupboards, and other spaces for keeping items.",
    suggestedSpaces: ["Storage Room", "Closet", "Cupboard", "Archive", "Stock Room"],
  },
  {
    id: "technical",
    label: "Technical / Plant",
    description: "Plant rooms, server rooms, electrical rooms, boiler rooms, and mechanical infrastructure spaces.",
    suggestedSpaces: ["Server Room", "Plant Room", "Electrical Room", "Boiler Room", "Mechanical Room"],
  },
  {
    id: "external",
    label: "External Areas",
    description: "Outdoor spaces including gardens, terraces, car parks, loading bays, yards, and roof areas.",
    suggestedSpaces: ["Garden", "Terrace", "Car Park", "Loading Bay", "Yard", "Roof"],
  },
];
