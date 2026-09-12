import { useNavigate, useSearchParams } from "react-router-dom";
import {
  propertyActivityAssetsPath,
  propertyActivityPeoplePath,
  propertyActivitySpacesPath,
} from "@/lib/propertyRoutes";
import { cn } from "@/lib/utils";

export type PropertyActivityTab = "spaces" | "assets" | "people";

/** Same pressed treatment as CentreWorkbenchTabStrip (Tasks · Calendar · Records). */
const ACTIVE_TAB_SHADOW = [
  "-1px -1px 1px rgba(0, 0, 0, 0.05)",
  "inset -1px -1px 2px 0px rgba(255, 255, 255, 0.90)",
  "inset 3px 3px 4px 0px rgba(0, 0, 0, 0.17)",
].join(", ");

const TABS: {
  id: PropertyActivityTab;
  label: string;
  illustrationSrc: string;
}[] = [
  {
    id: "spaces",
    label: "Spaces",
    illustrationSrc: "/centre-workbench/spaces.png",
  },
  {
    id: "assets",
    label: "Assets",
    illustrationSrc: "/centre-workbench/assets.png",
  },
  {
    id: "people",
    label: "People",
    illustrationSrc: "/centre-workbench/people.png",
  },
];

function pathForTab(tab: PropertyActivityTab, propertyId?: string | null): string {
  switch (tab) {
    case "assets":
      return propertyActivityAssetsPath(propertyId);
    case "people":
      return propertyActivityPeoplePath(propertyId);
    case "spaces":
    default:
      return propertyActivitySpacesPath(propertyId);
  }
}

type PropertyActivityTabStripProps = {
  activeTab: PropertyActivityTab;
  /** Prefer explicit scope; falls back to current `?property=`. */
  propertyId?: string | null;
  className?: string;
};

/**
 * Centre tabs for the Property activity area — Spaces · Assets · People.
 * Matches Tasks · Calendar · Records strip chrome and illustration treatment.
 */
export function PropertyActivityTabStrip({
  activeTab,
  propertyId,
  className,
}: PropertyActivityTabStripProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const scopeId = propertyId ?? searchParams.get("property");

  return (
    <div className={cn("w-full min-w-0", className)}>
      <div
        className={cn(
          "relative flex w-full min-w-0 max-w-full items-stretch justify-stretch gap-1 rounded-none px-1.5 py-1.5",
          "md:-ml-[10px] md:h-[142px] md:items-start md:justify-start md:px-2 md:py-0"
        )}
        role="tablist"
        aria-label="Property sections"
      >
        {TABS.map(({ id, label, illustrationSrc }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                if (id === activeTab) return;
                navigate(pathForTab(id, scopeId));
              }}
              className={cn(
                "relative flex min-w-0 flex-1 flex-col flex-nowrap items-center justify-center gap-1 rounded-xl px-1.5 py-2 transition-all duration-200",
                "md:h-[142px] md:w-[120px] md:flex-none md:shrink-0 md:flex-col md:items-center md:justify-start md:gap-2 md:px-2 md:pb-[22px] md:pt-3",
                isActive
                  ? "bg-black/[0.04]"
                  : "hover:scale-[1.01] active:scale-[0.99]"
              )}
              style={isActive ? { boxShadow: ACTIVE_TAB_SHADOW } : undefined}
            >
              <img
                src={illustrationSrc}
                alt=""
                className={cn(
                  "mx-auto shrink-0 object-contain drop-shadow-sm transition-opacity",
                  "h-10 w-10",
                  "md:h-[80px] md:w-[100px]",
                  isActive ? "opacity-100" : "opacity-70"
                )}
                decoding="async"
              />
              <span
                className={cn(
                  "min-w-0 w-full truncate text-center font-semibold tracking-tight text-shadow-neu-pressed",
                  "text-sm leading-tight",
                  "md:w-full md:overflow-visible md:whitespace-normal md:text-xl md:leading-none",
                  isActive ? "text-foreground" : "text-primary"
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
      <div
        className="perforation-section pointer-events-none mt-[22px] md:-ml-4 md:w-[calc(100%+1rem)]"
        aria-hidden
      />
    </div>
  );
}
