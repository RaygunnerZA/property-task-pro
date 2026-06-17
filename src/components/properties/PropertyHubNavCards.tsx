import { Box, DoorOpen, FileStack, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { paperTexturedColorStyle } from "@/lib/paperTexture";

export type PropertyHubNavCardId = "spaces" | "assets" | "people" | "records";

type NavCard = {
  id: PropertyHubNavCardId;
  title: string;
  description: string;
  Icon: typeof DoorOpen;
  fill: string;
};

const NAV_CARDS: NavCard[] = [
  {
    id: "spaces",
    title: "Spaces",
    description: "Rooms, zones, and layout",
    Icon: DoorOpen,
    fill: "hsl(185 40% 88%)",
  },
  {
    id: "assets",
    title: "Assets",
    description: "Equipment and fittings",
    Icon: Box,
    fill: "hsl(16 83% 90%)",
  },
  {
    id: "people",
    title: "People",
    description: "Owners, contacts, and team",
    Icon: Users,
    fill: "hsl(43 100% 88%)",
  },
  {
    id: "records",
    title: "Records",
    description: "Documents and compliance",
    Icon: FileStack,
    fill: "hsl(248 15% 90%)",
  },
];

type PropertyHubNavCardsProps = {
  onOpen: (id: PropertyHubNavCardId) => void;
  className?: string;
};

export function PropertyHubNavCards({ onOpen, className }: PropertyHubNavCardsProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      {NAV_CARDS.map(({ id, title, description, Icon, fill }) => (
        <button
          key={id}
          type="button"
          onClick={() => onOpen(id)}
          className={cn(
            "group flex min-h-[88px] flex-col items-start gap-2 rounded-[12px] border border-border/25 p-2.5 text-left shadow-e1",
            "transition-[transform,box-shadow] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          )}
          style={paperTexturedColorStyle(fill)}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white/55 shadow-sm">
            <Icon className="h-[18px] w-[18px] text-foreground/75" strokeWidth={1.75} aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">{title}</p>
            <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
