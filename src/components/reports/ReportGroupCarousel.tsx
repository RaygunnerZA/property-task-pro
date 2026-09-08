import { BarChart3 } from "lucide-react";
import { SpaceGroupCardBanner } from "@/components/spaces/SpaceGroupCardBanner";
import { SpaceGroupCarousel } from "@/components/spaces/SpaceGroupCarousel";
import {
  REPORT_GROUPS,
  type ReportGroupId,
} from "@/lib/reports/reportGroups";
import { REPORT_TEMPLATE_ILLUSTRATION } from "@/lib/reportIllustrations";
import { cn } from "@/lib/utils";

const DASHED_LINE_STYLE = {
  height: "1px",
  backgroundImage:
    "repeating-linear-gradient(to right, #E2DBCB 0px, #E2DBCB 4px, transparent 4px, transparent 7px)",
  backgroundSize: "7px 1px",
  backgroundRepeat: "repeat-x" as const,
};

type ReportGroupCarouselProps = {
  selectedGroupId: ReportGroupId | null;
  onSelectGroup: (groupId: ReportGroupId | null) => void;
  className?: string;
};

export function ReportGroupCarousel({
  selectedGroupId,
  onSelectGroup,
  className,
}: ReportGroupCarouselProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className="rounded-xl bg-primary p-2.5"
            style={{
              boxShadow:
                "3px 3px 8px rgba(0,0,0,0.1), -2px -2px 6px rgba(255,255,255,0.3)",
            }}
          >
            <BarChart3 className="h-5 w-5 text-white" aria-hidden />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Report packs</h2>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Browse by pack — select one to focus templates below.
      </p>
      <SpaceGroupCarousel>
        {REPORT_GROUPS.map((group) => {
          const selected = selectedGroupId === group.id;
          const leadTemplate = group.templateIds[0];
          const countLabel =
            group.templateIds.length === 1
              ? "1 template"
              : `${group.templateIds.length} templates`;
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => onSelectGroup(selected ? null : group.id)}
              aria-pressed={selected}
              className={cn(
                "flex h-[295px] w-[230px] shrink-0 flex-col overflow-hidden rounded-card bg-card text-left shadow-e1",
                "transition-all duration-200 hover:shadow-md hover:scale-[1.02] active:scale-[0.99]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                selected && "ring-2 ring-primary/50"
              )}
            >
              <SpaceGroupCardBanner
                imageSrc={REPORT_TEMPLATE_ILLUSTRATION[leadTemplate]}
                alt={group.label}
                color={group.color}
              />
              <div className="flex flex-1 flex-col space-y-3 px-3 pb-3 pt-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-semibold leading-tight text-foreground">
                    {group.label}
                  </h3>
                  <span
                    className="mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-2xs font-mono uppercase tracking-wider text-white"
                    style={{ backgroundColor: group.color }}
                  >
                    {group.templateIds.length}
                  </span>
                </div>
                <div className="-mx-1 pt-0.5" style={DASHED_LINE_STYLE} aria-hidden />
                <p className="line-clamp-4 text-xs leading-relaxed text-muted-foreground">
                  {group.description}
                </p>
                <p className="mt-auto text-2xs font-mono uppercase tracking-wider text-muted-foreground">
                  {countLabel}
                </p>
              </div>
            </button>
          );
        })}
      </SpaceGroupCarousel>
    </div>
  );
}
