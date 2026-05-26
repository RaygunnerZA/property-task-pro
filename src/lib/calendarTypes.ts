/**
 * Automatic calendar types — surfaced as "Calendars" filters (tag-like).
 */

export type CalendarTypeId =
  | "all"
  | "compliance"
  | "maintenance"
  | "inspections"
  | "projects";

export type CalendarTypeDef = {
  id: CalendarTypeId;
  label: string;
  color: string;
  checkboxColor: string;
};

export const CALENDAR_TYPES: CalendarTypeDef[] = [
  { id: "all", label: "All tasks", color: "#5A9A9E", checkboxColor: "#5A9A9E" },
  { id: "compliance", label: "Compliance", color: "#E8A04A", checkboxColor: "#E8A04A" },
  { id: "maintenance", label: "Maintenance", color: "#8EC9CE", checkboxColor: "#8EC9CE" },
  { id: "inspections", label: "Inspections", color: "#9B8EC9", checkboxColor: "#9B8EC9" },
  { id: "projects", label: "Projects", color: "#6B9FD4", checkboxColor: "#6B9FD4" },
];

export const CALENDAR_TYPE_MAP = Object.fromEntries(
  CALENDAR_TYPES.map((t) => [t.id, t])
) as Record<CalendarTypeId, CalendarTypeDef>;

const CATEGORY_HINTS: { id: CalendarTypeId; patterns: string[] }[] = [
  { id: "compliance", patterns: ["compliance", "certificate", "regulatory", "fire safety"] },
  { id: "inspections", patterns: ["inspection", "inspect", "audit", "walkthrough"] },
  { id: "projects", patterns: ["project", "renovation", "refurb", "capital"] },
  { id: "maintenance", patterns: ["maintenance", "repair", "service", "fix", "hvac", "plumb"] },
];

function normalize(s: string) {
  return s.trim().toLowerCase();
}

/** Infer calendar type from task themes/categories and title. */
export function inferCalendarType(task: {
  title?: string | null;
  themes?: Array<{ name?: string; type?: string }> | string;
}): CalendarTypeId {
  const title = normalize(task.title ?? "");
  const themeNames: string[] = [];

  if (Array.isArray(task.themes)) {
    task.themes.forEach((t) => {
      if (t?.name) themeNames.push(normalize(t.name));
    });
  } else if (typeof task.themes === "string") {
    try {
      const parsed = JSON.parse(task.themes) as Array<{ name?: string }>;
      if (Array.isArray(parsed)) {
        parsed.forEach((t) => t?.name && themeNames.push(normalize(t.name)));
      }
    } catch {
      /* ignore */
    }
  }

  const haystack = [title, ...themeNames].join(" ");
  for (const { id, patterns } of CATEGORY_HINTS) {
    if (patterns.some((p) => haystack.includes(p))) return id;
  }
  return "maintenance";
}

export function getCalendarTypeColor(typeId: CalendarTypeId): string {
  return CALENDAR_TYPE_MAP[typeId]?.color ?? CALENDAR_TYPE_MAP.maintenance.color;
}

/** Hex calendar chip color at a given alpha (e.g. 0.51 for translucent chips). */
export function calendarTypeColorWithAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return hex;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function taskMatchesCalendarFilters(
  task: Parameters<typeof inferCalendarType>[0],
  selected: Set<CalendarTypeId>
): boolean {
  if (selected.size === 0 || selected.has("all")) return true;
  const type = inferCalendarType(task);
  return selected.has(type);
}
