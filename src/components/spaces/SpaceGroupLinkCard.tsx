import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { SpaceGroup } from "@/components/onboarding/onboardingSpaceGroups";

interface SpaceGroupLinkCardProps {
  group: SpaceGroup;
  to: string;
}

/**
 * Clickable card that links to a space group screen.
 * Same visual style as front of OnboardingSpaceGroupCard.
 */
export function SpaceGroupLinkCard({ group, to }: SpaceGroupLinkCardProps) {
  return (
    <Link
      to={to}
      className="w-[200px] flex-shrink-0 rounded-[8px] overflow-hidden bg-card shadow-e1 flex flex-col transition-all duration-200 hover:shadow-md hover:scale-[1.02] active:scale-[0.99] group/card"
    >
      <div className="flex-1 pt-4 pb-3 px-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-lg text-foreground leading-tight">
            {group.label}
          </h3>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover/card:text-primary transition-colors" />
        </div>
        <div
          className="-ml-1 -mr-1 pt-1"
          style={{
            height: "1px",
            backgroundImage:
              "repeating-linear-gradient(to right, #E2DBCB 0px, #E2DBCB 4px, transparent 4px, transparent 7px)",
            backgroundSize: "7px 1px",
            backgroundRepeat: "repeat-x",
          }}
        />
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
          {group.description}
        </p>
      </div>
    </Link>
  );
}
