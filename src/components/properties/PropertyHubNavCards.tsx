import spacesIcon from "@/assets/property-hub/spaces-icon.png";
import assetsIcon from "@/assets/property-hub/assets-icon.png";
import peopleIcon from "@/assets/property-hub/people-icon.png";
import recordsIcon from "@/assets/property-hub/records-icon.png";
import { cn } from "@/lib/utils";
import { paperTexturedColorStyle } from "@/lib/paperTexture";

export type PropertyHubNavCardId = "spaces" | "assets" | "people" | "records";

type NavCard = {
  id: PropertyHubNavCardId;
  title: string;
  description: string;
  iconSrc: string;
  fill: string;
};

const NAV_CARDS: NavCard[] = [
  {
    id: "spaces",
    title: "Spaces",
    description: "Rooms, zones, and layout",
    iconSrc: spacesIcon,
    fill: "hsl(185 40% 88%)",
  },
  {
    id: "assets",
    title: "Assets",
    description: "Equipment and fittings",
    iconSrc: assetsIcon,
    fill: "hsl(16 83% 90%)",
  },
  {
    id: "people",
    title: "People",
    description: "Owners, contacts, and team",
    iconSrc: peopleIcon,
    fill: "hsl(43 100% 88%)",
  },
  {
    id: "records",
    title: "Records",
    description: "Documents and compliance",
    iconSrc: recordsIcon,
    fill: "hsl(248 15% 90%)",
  },
];

type PropertyHubNavCardsProps = {
  onOpen: (id: PropertyHubNavCardId) => void;
  className?: string;
};

export function PropertyHubNavCards({ onOpen, className }: PropertyHubNavCardsProps) {
  return (
    <div className={cn("grid grid-cols-2 grid-rows-2 gap-2", className)}>
      {NAV_CARDS.map(({ id, title, description, iconSrc, fill }) => (
        <button
          key={id}
          type="button"
          onClick={() => onOpen(id)}
          className={cn(
            "group flex h-[100px] flex-row items-center justify-start gap-2 rounded-[12px] border border-border/25 px-1.5 py-2.5 text-left shadow-e1",
            "transition-[transform,box-shadow] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          )}
          style={paperTexturedColorStyle(fill)}
        >
          <img
            src={iconSrc}
            alt=""
            draggable={false}
            width={50}
            height={76}
            decoding="async"
            className="pointer-events-none h-[76px] w-[50px] shrink-0 select-none object-contain pb-[30px]"
          />
          <div className="min-w-0">
            <p className="text-lg font-semibold text-foreground">{title}</p>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
