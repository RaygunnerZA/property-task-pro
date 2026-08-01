import { useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { List } from "lucide-react";
import { useSpacesWithTypes, type SpaceWithType } from "@/hooks/useSpacesWithTypes";
import {
  ONBOARDING_SPACE_GROUPS,
  getGroupIdFromDefaultUiGroup,
  getSpaceGroupById,
} from "@/components/onboarding/onboardingSpaceGroups";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toSentenceCaseSpaceName } from "@/lib/spaceNameUtils";
import { cn } from "@/lib/utils";

export type AllSpacesSort =
  | "name-asc"
  | "name-desc"
  | "group"
  | "recent"
  | "open-tasks";

const SORT_OPTIONS: { id: AllSpacesSort; label: string }[] = [
  { id: "name-asc", label: "A–Z" },
  { id: "name-desc", label: "Z–A" },
  { id: "group", label: "By group" },
  { id: "recent", label: "Recently updated" },
  { id: "open-tasks", label: "Open tasks first" },
];

const GROUP_ORDER = new Map(
  ONBOARDING_SPACE_GROUPS.map((g, index) => [g.id, index])
);

const EMPTY_OPEN_IDS = new Set<string>();
const EMPTY_COUNTS: Record<string, number> = {};

const COLUMN_STYLE: CSSProperties = {
  columnGap: "2.75rem",
  columnRule: "1px solid hsl(var(--border) / 0.35)",
};

type AllSpacesDirectoryProps = {
  propertyId: string;
  /** Case-insensitive name filter (shared with groups search). */
  spaceFilter?: string;
  /** Space IDs linked to at least one open task. */
  openTaskSpaceIds?: Set<string>;
  /** Open (non-done) task counts keyed by space id. */
  openTaskCountsBySpaceId?: Record<string, number>;
  className?: string;
};

function spaceName(space: SpaceWithType): string {
  return toSentenceCaseSpaceName(space.name);
}

function spaceNameRaw(space: SpaceWithType): string {
  return (space.name ?? "").trim() || "Unnamed";
}

function compareNameAsc(a: SpaceWithType, b: SpaceWithType): number {
  return spaceNameRaw(a).localeCompare(spaceNameRaw(b), undefined, { sensitivity: "base" });
}

function groupIdForSpace(space: SpaceWithType): string | undefined {
  const defaultUiGroup = space.space_types?.default_ui_group;
  if (!defaultUiGroup) return undefined;
  return getGroupIdFromDefaultUiGroup(defaultUiGroup);
}

function groupLabelForSpace(space: SpaceWithType): string {
  const id = groupIdForSpace(space);
  if (!id) return "Ungrouped";
  return getSpaceGroupById(id)?.label ?? "Ungrouped";
}

function sortSpaces(
  spaces: SpaceWithType[],
  sort: AllSpacesSort,
  openTaskSpaceIds: Set<string>
): SpaceWithType[] {
  const list = [...spaces];

  switch (sort) {
    case "name-desc":
      return list.sort((a, b) => compareNameAsc(b, a));
    case "group":
      return list.sort((a, b) => {
        const aId = groupIdForSpace(a);
        const bId = groupIdForSpace(b);
        const aOrder = aId != null ? (GROUP_ORDER.get(aId) ?? 999) : 1000;
        const bOrder = bId != null ? (GROUP_ORDER.get(bId) ?? 999) : 1000;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return compareNameAsc(a, b);
      });
    case "recent":
      return list.sort((a, b) => {
        const aDate = new Date(a.updated_at || a.created_at || 0).getTime();
        const bDate = new Date(b.updated_at || b.created_at || 0).getTime();
        if (bDate !== aDate) return bDate - aDate;
        return compareNameAsc(a, b);
      });
    case "open-tasks":
      return list.sort((a, b) => {
        const aOpen = openTaskSpaceIds.has(a.id) ? 0 : 1;
        const bOpen = openTaskSpaceIds.has(b.id) ? 0 : 1;
        if (aOpen !== bOpen) return aOpen - bOpen;
        return compareNameAsc(a, b);
      });
    case "name-asc":
    default:
      return list.sort(compareNameAsc);
  }
}

/**
 * Dense alphabetical directory of every space on the property.
 * Sits below space groups — text-only, multi-column, no icons.
 */
export function AllSpacesDirectory({
  propertyId,
  spaceFilter = "",
  openTaskSpaceIds,
  openTaskCountsBySpaceId,
  className,
}: AllSpacesDirectoryProps) {
  const navigate = useNavigate();
  const { spaces, loading } = useSpacesWithTypes(propertyId);
  const [sort, setSort] = useState<AllSpacesSort>("name-asc");
  const openIds = openTaskSpaceIds ?? EMPTY_OPEN_IDS;
  const taskCounts = openTaskCountsBySpaceId ?? EMPTY_COUNTS;

  const filtered = useMemo(() => {
    const q = spaceFilter.trim().toLowerCase();
    if (!q) return spaces;
    return spaces.filter((s) => spaceNameRaw(s).toLowerCase().includes(q));
  }, [spaces, spaceFilter]);

  const sorted = useMemo(
    () => sortSpaces(filtered, sort, openIds),
    [filtered, sort, openIds]
  );

  const groupSections = useMemo(() => {
    if (sort !== "group") return null;
    const sections: { key: string; label: string; spaces: SpaceWithType[] }[] = [];
    for (const space of sorted) {
      const label = groupLabelForSpace(space);
      const last = sections[sections.length - 1];
      if (last && last.label === label) {
        last.spaces.push(space);
      } else {
        sections.push({ key: groupIdForSpace(space) ?? "ungrouped", label, spaces: [space] });
      }
    }
    return sections;
  }, [sorted, sort]);

  const openSpace = (space: SpaceWithType) => {
    navigate(`/properties/${propertyId}/spaces/${space.id}`);
  };

  const renderLink = (space: SpaceWithType) => {
    const name = spaceName(space);
    const taskCount = taskCounts[space.id] ?? 0;
    const hasOpen = taskCount > 0 || openIds.has(space.id);
    return (
      <li key={space.id} className="break-inside-avoid">
        <button
          type="button"
          onClick={() => openSpace(space)}
          className={cn(
            "flex w-full items-baseline gap-2 py-0.5 text-left text-xs leading-snug",
            "transition-colors hover:text-primary focus-visible:outline-none focus-visible:text-primary",
            hasOpen ? "font-medium text-foreground" : "text-foreground/90"
          )}
          title={taskCount > 0 ? `${name} · ${taskCount} open task${taskCount === 1 ? "" : "s"}` : name}
        >
          <span className="min-w-0 flex-1 truncate">{name}</span>
          {taskCount > 0 ? (
            <span className="shrink-0 tabular-nums text-caption text-muted-foreground">
              {taskCount}
            </span>
          ) : null}
        </button>
      </li>
    );
  };

  return (
    <section className={cn("space-y-3", className)} aria-labelledby="all-spaces-heading">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className="rounded-xl bg-primary p-2.5"
            style={{
              boxShadow: "3px 3px 8px rgba(0,0,0,0.1), -2px -2px 6px rgba(255,255,255,0.3)",
            }}
          >
            <List className="h-5 w-5 text-white" aria-hidden />
          </div>
          <h2 id="all-spaces-heading" className="text-lg font-semibold text-foreground">
            All spaces
          </h2>
          {!loading && (
            <span
              className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-white px-1.5 text-caption font-medium tabular-nums text-muted-foreground shadow-e1"
              aria-label={`${sorted.length} spaces`}
            >
              {sorted.length}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-2xs font-mono uppercase text-muted-foreground">Sort</span>
          <Select value={sort} onValueChange={(v) => setSort(v as AllSpacesSort)}>
            <SelectTrigger
              className="h-7 w-[148px] border-0 bg-background/80 text-xs shadow-[inset_1px_2px_4px_rgba(0,0,0,0.06)] focus:ring-1 focus:ring-primary/40 focus:ring-offset-0"
              aria-label="Sort spaces"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.id} value={opt.id} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <p className="py-4 text-xs text-muted-foreground">Loading spaces…</p>
      ) : sorted.length === 0 ? (
        <p className="py-4 text-xs text-muted-foreground">
          {spaceFilter.trim() ? "No spaces match your search." : "No spaces yet."}
        </p>
      ) : groupSections ? (
        <div className="columns-2 sm:columns-3" style={COLUMN_STYLE}>
          {groupSections.map((section) => (
            <div key={section.key} className="mb-3 break-inside-avoid">
              <p className="mb-0.5 text-2xs font-mono uppercase text-muted-foreground">
                {section.label}
              </p>
              <ul className="list-none">{section.spaces.map(renderLink)}</ul>
            </div>
          ))}
        </div>
      ) : (
        <ul className="columns-2 list-none sm:columns-3" style={COLUMN_STYLE}>
          {sorted.map(renderLink)}
        </ul>
      )}
    </section>
  );
}
