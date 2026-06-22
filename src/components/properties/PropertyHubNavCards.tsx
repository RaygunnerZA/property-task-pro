import { useMemo } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { paperTexturedColorStyle } from "@/lib/paperTexture";
import { useSpaces } from "@/hooks/useSpaces";
import { useAssetsQuery } from "@/hooks/useAssetsQuery";
import { usePropertyDocuments } from "@/hooks/property/usePropertyDocuments";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { UserAvatar } from "@/components/tasks/UserAvatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type PropertyHubNavCardId = "spaces" | "assets" | "people" | "records";

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
    description: "Rooms, zones, and layout",
    iconSrc: `${PROPERTY_HUB_ICON_BASE}/spaces-icon.png`,
    fill: "hsl(185 40% 88%)",
  },
  {
    id: "assets",
    title: "Assets",
    description: "Equipment and fittings",
    iconSrc: `${PROPERTY_HUB_ICON_BASE}/assets-icon.png`,
    fill: "hsl(16 83% 90%)",
  },
  {
    id: "people",
    title: "People",
    description: "Owners, contacts, and team",
    iconSrc: `${PROPERTY_HUB_ICON_BASE}/people-icon.png`,
    fill: "hsl(43 100% 88%)",
  },
  {
    id: "records",
    title: "Records",
    description: "Documents and compliance",
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

const recentLabelClass =
  "w-[50px] shrink-0 text-center font-mono text-[9px] font-medium uppercase tracking-wider text-muted-foreground";

function RecentChip({ label }: { label: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] max-w-[92px] items-center justify-center truncate rounded-[5px] bg-background/55 px-2",
        "font-mono text-[10px] font-medium uppercase tracking-wider text-foreground/75 shadow-sm"
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
  onOpen: (id: PropertyHubNavCardId) => void;
  onAdd?: (id: PropertyHubNavCardId) => void;
  className?: string;
};

export function PropertyHubNavCards({
  propertyId,
  ownerName,
  contactName,
  onOpen,
  onAdd,
  className,
}: PropertyHubNavCardsProps) {
  const { spaces } = useSpaces(propertyId);
  const { data: assets = [] } = useAssetsQuery(propertyId);
  const { documents = [] } = usePropertyDocuments(propertyId, undefined, { limit: 20 });
  const { members } = useOrgMembers();

  const recentByCard = useMemo(() => {
    const recentSpaces = sortByRecent(spaces)
      .slice(0, MAX_RECENT)
      .map((s) => s.name || "Unnamed space");

    const recentAssets = sortByRecent(assets)
      .slice(0, MAX_RECENT)
      .map((a) => a.name || a.serial_number || "Unnamed asset");

    const recentRecords = sortByRecent(documents)
      .slice(0, MAX_RECENT)
      .map((d) => d.title || d.file_name || "Untitled");

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

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn("grid grid-cols-1 gap-[11px]", className)}>
        {NAV_CARDS.map(({ id, title, description, iconSrc, fill }) => {
          const recentItems = recentByCard[id];
          const hasRecent =
            id === "people"
              ? (recentItems as PersonPreview[]).length > 0
              : (recentItems as string[]).length > 0;

          return (
            <div
              key={id}
              role="button"
              tabIndex={0}
              onClick={() => onOpen(id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpen(id);
                }
              }}
              className={cn(
                "group flex cursor-pointer flex-col gap-0 align-top rounded-[12px] border border-border/25 px-1.5 py-2.5 text-left shadow-e1",
                "transition-[transform,box-shadow] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              )}
              style={paperTexturedColorStyle(fill)}
            >
              <div className="flex flex-row items-center justify-center gap-2">
                <img
                  src={iconSrc}
                  alt=""
                  draggable={false}
                  width={60}
                  height={76}
                  decoding="async"
                  className="pointer-events-none h-[76px] w-[60px] shrink-0 select-none object-contain px-[3px] pb-3 align-top"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-lg font-semibold text-foreground">{title}</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAdd(id);
                      }}
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px]",
                        "text-muted-foreground transition-colors hover:bg-background/50 hover:text-foreground",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      )}
                      aria-label={`Add ${title.toLowerCase()}`}
                    >
                      <Plus className="h-4 w-4" strokeWidth={2.25} />
                    </button>
                  </div>
                  <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{description}</p>
                </div>
              </div>

              {hasRecent ? (
                <div className="flex h-9 items-center gap-2 border-t-2 border-t-white/47 pt-1.5">
                  <p className={recentLabelClass}>Recent</p>
                  {id === "people" ? (
                    <div className="flex min-h-[24px] min-w-0 flex-1 flex-wrap items-center gap-1.5">
                      {(recentItems as PersonPreview[]).map((person) => (
                        <RecentPersonAvatar key={person.id} person={person} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex min-h-[22px] min-w-0 flex-1 flex-wrap gap-1">
                      {(recentItems as string[]).map((label, index) => (
                        <RecentChip key={`${id}-${index}`} label={label} />
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
