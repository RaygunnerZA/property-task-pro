import { Tags } from "lucide-react";
import { Link } from "react-router-dom";
import { WorkspaceSurfaceCard } from "@/components/property-workspace";
import { cn } from "@/lib/utils";

export type ManageTagsSurface = "spaces" | "assets" | "people";

const COPY: Record<
  ManageTagsSurface,
  { title: string; description: string; tip: string }
> = {
  spaces: {
    title: "Manage Tags",
    description:
      "Tags group spaces for routines and reporting — e.g. guest-facing vs plant rooms.",
    tip: "Teams-as-tags also route space work to the right people.",
  },
  assets: {
    title: "Manage Tags",
    description:
      "Tag assets by system, trade, or criticality so maintenance work stays findable.",
    tip: "Teams-as-tags help assign asset jobs without rebuilding lists.",
  },
  people: {
    title: "Manage Tags",
    description:
      "Tags (including Teams) organise who covers which properties, trades, and shifts.",
    tip: "Use teams to filter People and match them to Spaces and Assets.",
  },
};

type ManageTagsPanelProps = {
  surface: ManageTagsSurface;
  className?: string;
};

/**
 * Compact “Manage Tags” stub under Property action columns.
 * Tags stay out of primary nav; this panel explains context per surface.
 */
export function ManageTagsPanel({ surface, className }: ManageTagsPanelProps) {
  const copy = COPY[surface];

  return (
    <WorkspaceSurfaceCard
      className={cn("opacity-95", className)}
      title={copy.title}
      titleAccessory={<Tags className="h-4 w-4 text-muted-foreground" aria-hidden />}
      description={copy.description}
    >
      <p className="text-2xs text-muted-foreground leading-relaxed mb-3">{copy.tip}</p>
      <Link
        to="/tags"
        className="text-xs font-medium text-primary hover:underline underline-offset-2"
      >
        Open Tags
      </Link>
    </WorkspaceSurfaceCard>
  );
}
