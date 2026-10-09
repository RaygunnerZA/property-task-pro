import { useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { displayNameWithoutSampleCue } from "@/lib/onboardingEducation";
import { paperTexturedDiagonalFadeStyle } from "@/lib/paperTexture";
import {
  PropertyHubTab,
  scaleTabWidthsToContainer,
  tabWidthsFromTitles,
  type PropertyHubNavCardId,
} from "@/components/properties/PropertyHubTab";
import { useSpaces } from "@/hooks/useSpaces";
import { useAssetsQuery } from "@/hooks/useAssetsQuery";
import { usePropertyDocuments } from "@/hooks/property/usePropertyDocuments";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { listedBenchSpaces } from "@/lib/spaces/partitionPropertySpaces";
import { UserAvatar } from "@/components/tasks/UserAvatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type { PropertyHubNavCardId } from "@/components/properties/PropertyHubTab";

const MAX_RECENT = 3;

type NavCard = {
  id: PropertyHubNavCardId;
  title: string;
  description: string;
  iconSrc: string;
  fill: string;
};

const PROPERTY_HUB_ICON_BASE = "/property-hub";

const NAV_CARDS: NavCard[] = [
  {
    id: "spaces",
    title: "Spaces",
    description:
      "Organize rooms, zones, and floor layout so tasks and assets always land in the right place.",
    iconSrc: `${PROPERTY_HUB_ICON_BASE}/spaces-icon.png`,
    fill: "hsl(185 40% 88%)",
  },
  {
    id: "assets",
    title: "Assets",
    description:
      "Equipment, fittings, and plant — track what you have, where it lives, and when it needs attention.",
    iconSrc: `${PROPERTY_HUB_ICON_BASE}/assets-icon.png`,
    fill: "hsl(16 83% 90%)",
  },
  {
    id: "people",
    title: "People",
    description: "Owners, contacts, and team members assigned to this property.",
    iconSrc: `${PROPERTY_HUB_ICON_BASE}/people-icon.png`,
    fill: "hsl(43 100% 88%)",
  },
  {
    id: "records",
    title: "Records",
    description:
      "Insurance, certificates, leases, and compliance documents linked to this property.",
    iconSrc: `${PROPERTY_HUB_ICON_BASE}/records-icon.png`,
    fill: "hsl(248 15% 90%)",
  },
];

type PersonPreview = {
  id: string;
  name: string;
  avatarUrl?: string | null;
};

function sortByRecent<T extends { updated_at?: string | null; created_at?: string | null }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const aDate = new Date(a.updated_at || a.created_at || 0).getTime();
    const bDate = new Date(b.updated_at || b.created_at || 0).getTime();
    return bDate - aDate;
  });
}

function buildRecentPeople(
  propertyId: string,
  ownerName?: string | null,
  contactName?: string | null,
  members: { user_id: string; display_name: string; avatar_url: string | null; assigned_properties: string[] | null }[] = []
): PersonPreview[] {
  const people: PersonPreview[] = [];
  const owner = ownerName?.trim();
  const contact = contactName?.trim();

  if (owner) {
    people.push({ id: "owner", name: owner });
  }
  if (contact && contact !== owner) {
    people.push({ id: "contact", name: contact });
  }

  for (const member of members) {
    if (people.length >= MAX_RECENT) break;
    const assigned = member.assigned_properties;
    const appliesToProperty =
      !assigned?.length || assigned.includes(propertyId);
    if (!appliesToProperty) continue;
    if (people.some((p) => p.id === member.user_id)) continue;
    people.push({
      id: member.user_id,
      name: member.display_name,
      avatarUrl: member.avatar_url,
    });
  }

  return people.slice(0, MAX_RECENT);
}

export function countPropertyPeople(
  propertyId: string,
  ownerName?: string | null,
  contactName?: string | null,
  members: { user_id: string; display_name: string; avatar_url: string | null; assigned_properties: string[] | null }[] = []
): number {
  const owner = ownerName?.trim();
  const contact = contactName?.trim();
  let count = 0;
  const seen = new Set<string>();

  if (owner) {
    count++;
    seen.add("owner");
  }
  if (contact && contact !== owner) {
    count++;
    seen.add("contact");
  }

  for (const member of members) {
    const assigned = member.assigned_properties;
    const appliesToProperty = !assigned?.length || assigned.includes(propertyId);
    if (!appliesToProperty || seen.has(member.user_id)) continue;
    seen.add(member.user_id);
    count++;
  }

  return count;
}

type HubStatusCountTone = "urgent" | "warning" | "neutral";

type PanelMetric = {
  id: string;
  count: number;
  label: string;
  tone: HubStatusCountTone;
};

const statusCountBoxClass: Record<HubStatusCountTone, string> = {
  urgent:
    "inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-card bg-white px-1 text-2xs font-bold tabular-nums leading-none text-destructive",
  warning:
    "inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-card bg-white px-1 text-2xs font-bold tabular-nums leading-none text-warning-foreground",
  neutral:
    "inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-card bg-white px-1 text-2xs font-bold tabular-nums leading-none text-muted-foreground",
};

const statusCountLabelClass: Record<HubStatusCountTone, string> = {
  urgent: "font-mono text-2xs font-bold uppercase tracking-[0.04em] text-destructive",
  warning: "font-mono text-2xs font-bold uppercase tracking-[0.04em] text-warning-foreground",
  neutral: "font-mono text-2xs font-bold uppercase tracking-[0.04em] text-muted-foreground",
};

function PanelMetricItem({ item }: { item: PanelMetric }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5" aria-label={`${item.count} ${item.label}`}>
      <span className={statusCountBoxClass[item.tone]}>{item.count}</span>
      <span className={statusCountLabelClass[item.tone]}>{item.label}</span>
    </span>
  );
}

function linkedSpaceIds(spaces: unknown): string[] {
  const linked = typeof spaces === "string" ? safeJsonArray(spaces) : spaces;
  if (!Array.isArray(linked)) return [];
  return linked.flatMap((space) => {
    if (!space || typeof space !== "object" || !("id" in space)) return [];
    const id = String((space as { id?: string }).id ?? "");
    return id ? [id] : [];
  });
}

function safeJsonArray(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isOpenTaskStatus(status: string | null | undefined): boolean {
  const value = String(status ?? "").toLowerCase();
  return value !== "completed" && value !== "archived" && value !== "done";
}

const hubCardActionClass = cn(
  "inline-flex h-6 shrink-0 items-center gap-0.5 rounded-sharp px-1.5",
  "font-mono text-2xs font-medium uppercase tracking-wider text-muted-foreground",
  "transition-colors hover:bg-background/50 hover:text-foreground",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
);

function hubAddActionLabel(tab: PropertyHubNavCardId): string {
  return tab === "people" ? "Invite" : "New";
}

const recentLabelClass =
  "w-[50px] shrink-0 pl-[14px] text-center font-mono text-2xs font-medium uppercase tracking-wider text-muted-foreground";

const recentChipsScrollClass =
  "flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

function formatRecentChipLabel(name: string): string {
  const trimmed = name.trim();
  if (/^sample:\s*/i.test(trimmed) || /\(\s*sample(?:\s*[-–—][^)]*)?\s*\)/i.test(trimmed)) {
    const withoutSampleCue = displayNameWithoutSampleCue(trimmed);
    return `*${withoutSampleCue || trimmed}`;
  }
  return trimmed;
}

function RecentChip({ label }: { label: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] max-w-[120px] shrink-0 items-center justify-center truncate rounded-sharp bg-background/55 px-2",
        "font-mono text-2xs font-medium uppercase tracking-wider text-foreground/75 shadow-sm"
      )}
      title={label}
    >
      {label}
    </span>
  );
}

function RecentPersonAvatar({ person }: { person: PersonPreview }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex shrink-0 rounded-full ring-2 ring-background">
          <UserAvatar
            imageUrl={person.avatarUrl}
            name={person.name}
            size={24}
            shape="circle"
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{person.name}</TooltipContent>
    </Tooltip>
  );
}

type PropertyHubNavCardsProps = {
  propertyId: string;
  ownerName?: string | null;
  contactName?: string | null;
  counts?: Partial<Record<PropertyHubNavCardId, number>>;
  onOpen: (id: PropertyHubNavCardId) => void;
  onAdd?: (id: PropertyHubNavCardId) => void;
  className?: string;
};

export function PropertyHubNavCards({
  propertyId,
  ownerName,
  contactName,
  counts: _counts,
  onOpen,
  onAdd,
  className,
}: PropertyHubNavCardsProps) {
  const [activeTab, setActiveTab] = useState<PropertyHubNavCardId>("spaces");
  const tabRowRef = useRef<HTMLDivElement>(null);
  const [tabRowWidth, setTabRowWidth] = useState(0);
  const { spaces } = useSpaces(propertyId);
  const { data: assets = [] } = useAssetsQuery(propertyId);
  const { documents = [] } = usePropertyDocuments(propertyId, undefined, { limit: 500 });
  const { data: tasks = [] } = useTasksQuery(propertyId);
  const { members } = useOrgMembers();

  const activeCard = NAV_CARDS.find((card) => card.id === activeTab) ?? NAV_CARDS[0];
  const activeIndex = NAV_CARDS.findIndex((card) => card.id === activeTab);

  useEffect(() => {
    const node = tabRowRef.current;
    if (!node) return;

    const measure = () => setTabRowWidth(node.clientWidth);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const baseTabWidths = useMemo(
    () => tabWidthsFromTitles(NAV_CARDS.map((card) => card.title)),
    []
  );

  const tabWidths = useMemo(
    () =>
      scaleTabWidthsToContainer(
        tabRowWidth,
        activeIndex >= 0 ? activeIndex : 0,
        NAV_CARDS.length,
        baseTabWidths
      ),
    [tabRowWidth, activeIndex, baseTabWidths]
  );

  const recentByCard = useMemo(() => {
    const recentSpaces = sortByRecent(spaces)
      .slice(0, MAX_RECENT)
      .map((s) => formatRecentChipLabel(s.name || "Unnamed space"));

    const recentAssets = sortByRecent(assets)
      .slice(0, MAX_RECENT)
      .map((a) => formatRecentChipLabel(a.name || a.serial_number || "Unnamed asset"));

    const recentRecords = sortByRecent(documents)
      .slice(0, MAX_RECENT)
      .map((d) => formatRecentChipLabel(d.title || d.file_name || "Untitled"));

    const recentPeople = buildRecentPeople(propertyId, ownerName, contactName, members);

    return {
      spaces: recentSpaces,
      assets: recentAssets,
      people: recentPeople,
      records: recentRecords,
    };
  }, [spaces, assets, documents, members, propertyId, ownerName, contactName]);

  const handleAdd = (id: PropertyHubNavCardId) => {
    (onAdd ?? onOpen)(id);
  };

  const panelMetrics = useMemo((): PanelMetric[] => {
    if (activeTab === "spaces") {
      const listed = listedBenchSpaces(spaces);
      const issueIds = new Set<string>();
      for (const task of tasks) {
        if (!isOpenTaskStatus(task.status)) continue;
        for (const spaceId of linkedSpaceIds(task.spaces)) issueIds.add(spaceId);
      }
      const issues = listed.filter((space) => issueIds.has(space.id)).length;
      return [
        { id: "active", count: listed.length, label: "Active", tone: "neutral" },
        { id: "issue", count: issues, label: "Issue", tone: issues > 0 ? "urgent" : "neutral" },
      ];
    }

    if (activeTab === "assets") {
      const active = assets.filter((asset) => (asset.status || "active") === "active");
      const attention = active.filter(
        (asset) => (asset.condition_score ?? 100) < 60 || (asset.open_tasks_count ?? 0) > 0
      ).length;
      return [
        { id: "active", count: active.length, label: "Active", tone: "neutral" },
        {
          id: "attention",
          count: attention,
          label: "Need attention",
          tone: attention > 0 ? "warning" : "neutral",
        },
      ];
    }

    if (activeTab === "people") {
      const inScope = countPropertyPeople(propertyId, ownerName, contactName, members);
      const openAssigneeIds = new Set<string>();
      for (const task of tasks) {
        if (!isOpenTaskStatus(task.status) || !task.assigned_user_id) continue;
        openAssigneeIds.add(task.assigned_user_id);
      }
      const withWork = members.filter((member) => {
        const assigned = member.assigned_properties;
        const applies = !assigned?.length || assigned.includes(propertyId);
        return applies && openAssigneeIds.has(member.user_id);
      }).length;
      return [
        { id: "scope", count: inScope, label: "In scope", tone: "neutral" },
        {
          id: "work",
          count: withWork,
          label: "With work",
          tone: withWork > 0 ? "warning" : "neutral",
        },
      ];
    }

    const today = new Date().toISOString().split("T")[0];
    const expired = documents.filter((doc) => doc.expiry_date != null && doc.expiry_date < today).length;
    return [
      { id: "filed", count: documents.length, label: "Filed", tone: "neutral" },
      { id: "expired", count: expired, label: "Expired", tone: expired > 0 ? "urgent" : "neutral" },
    ];
  }, [activeTab, spaces, assets, documents, members, tasks, propertyId, ownerName, contactName]);
  const recentItems = recentByCard[activeTab];
  const hasRecent =
    activeTab === "people"
      ? (recentItems as PersonPreview[]).length > 0
      : (recentItems as string[]).length > 0;

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn("w-full", className)}
        role="tablist"
        aria-label="Property hub sections"
      >
        <div
          ref={tabRowRef}
          className="relative h-[37px] w-full overflow-visible px-0 pt-0"
        >
          {NAV_CARDS.map(({ id, title, fill }, index) => (
            <PropertyHubTab
              key={id}
              id={id}
              title={title}
              fill={fill}
              isActive={activeTab === id}
              isFirst={index === 0}
              stackIndex={index}
              stackSize={NAV_CARDS.length}
              activeIndex={activeIndex >= 0 ? activeIndex : 0}
              tabWidths={tabWidths}
              onSelect={() => setActiveTab(id)}
            />
          ))}
        </div>

        <div
          role="tabpanel"
          aria-labelledby={`hub-tab-${activeTab}`}
          tabIndex={0}
          onClick={() => onOpen(activeTab)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpen(activeTab);
            }
          }}
          className={cn(
            "group relative -mt-px flex h-auto min-h-[132px] cursor-pointer flex-col gap-3 rounded-[0_12px_12px_12px] px-1.5 pb-[10px] pt-1 text-left",
            "shadow-[inset_1px_1px_1px_0px_rgba(255,255,255,1),2px_2px_2px_-1px_rgba(0,0,0,0.15),0px_2px_4px_-2px_rgba(0,0,0,0.1)]",
            "transition-[transform,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          )}
          style={paperTexturedDiagonalFadeStyle(activeCard.fill)}
        >
          <div className="flex items-center justify-between gap-2 py-[5px]">
            <div className="flex min-w-0 flex-1 items-center justify-start gap-3 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {panelMetrics.map((item, index) => (
                <span key={item.id} className="inline-flex shrink-0 items-center gap-3">
                  {index > 0 ? (
                    <span className="font-mono text-2xs text-muted-foreground/50" aria-hidden>
                      |
                    </span>
                  ) : null}
                  <PanelMetricItem item={item} />
                </span>
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen(activeTab);
                }}
                className={hubCardActionClass}
                aria-label={`View ${activeCard.title.toLowerCase()}`}
              >
                View
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAdd(activeTab);
                }}
                className={hubCardActionClass}
                aria-label={
                  activeTab === "people"
                    ? "Invite"
                    : `New ${activeCard.title.toLowerCase().replace(/s$/, "")}`
                }
              >
                <Plus className="h-4 w-4" strokeWidth={2.25} />
                {hubAddActionLabel(activeTab)}
              </button>
            </div>
          </div>
          <div className="flex flex-row items-center justify-start gap-2">
            <img
              src={activeCard.iconSrc}
              alt=""
              draggable={false}
              width={52}
              height={52}
              decoding="async"
              className="pointer-events-none h-[52px] w-[52px] shrink-0 select-none object-contain align-top"
            />
            <p className="min-w-0 flex-1 text-sm leading-relaxed text-muted-foreground">
              {activeCard.description}
            </p>
          </div>

          {hasRecent ? (
            <div className="shrink-0">
              <div className="perforation-list" aria-hidden />
              <div className="flex h-[31px] items-center gap-[11px] pt-2">
                <p className={recentLabelClass}>Recent</p>
                {activeTab === "people" ? (
                  <div className={cn(recentChipsScrollClass, "min-h-[24px] gap-1.5")}>
                    {(recentItems as PersonPreview[]).map((person) => (
                      <RecentPersonAvatar key={person.id} person={person} />
                    ))}
                  </div>
                ) : (
                  <div className={recentChipsScrollClass}>
                    {(recentItems as string[]).map((label, index) => (
                      <RecentChip key={`${activeTab}-${index}`} label={label} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  );
}
