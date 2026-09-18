import { cn } from "@/lib/utils";
import {
  WORKBENCH_CENTRE_TAB_ACTIVE_COLOR,
  WORKBENCH_CENTRE_TAB_INACTIVE_COLOR,
  workbenchCentreTabActiveClassName,
  workbenchCentreTabInactiveClassName,
} from "@/lib/workbenchSectionTitle";

export type OrganiseViewTab<Id extends string = string> = {
  id: Id;
  label: string;
  subtitle: string;
};

type OrganiseViewTabsProps<Id extends string> = {
  tabs: readonly OrganiseViewTab<Id>[];
  active: Id;
  onChange: (id: Id) => void;
  ariaLabel: string;
  className?: string;
};

/**
 * Workbench view tabs — the Calendar "Planner | Schedule" pattern shared by
 * the organise surfaces (Spaces · Assets · Records). Fraunces tabs separated
 * by a light "|", one-line descriptor beneath (@Docs/04_UI_System.md).
 */
export function OrganiseViewTabs<Id extends string>({
  tabs,
  active,
  onChange,
  ariaLabel,
  className,
}: OrganiseViewTabsProps<Id>) {
  const activeMeta = tabs.find((tab) => tab.id === active) ?? tabs[0];
  return (
    <div className={cn("min-w-0", className)}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex min-w-0 flex-nowrap items-center gap-x-1.5 md:gap-x-2"
      >
        {tabs.map((tab, index) => {
          const selected = active === tab.id;
          return (
            <div key={tab.id} className="flex shrink-0 items-center gap-x-1.5 md:gap-x-2">
              {index > 0 ? (
                <span
                  className="font-display text-2xl font-light leading-tight text-muted-foreground/35"
                  aria-hidden
                >
                  |
                </span>
              ) : null}
              <button
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onChange(tab.id)}
                className={cn(
                  "inline-flex items-center gap-1 whitespace-nowrap transition-colors md:gap-1.5",
                  selected
                    ? workbenchCentreTabActiveClassName
                    : workbenchCentreTabInactiveClassName
                )}
                style={{
                  color: selected
                    ? WORKBENCH_CENTRE_TAB_ACTIVE_COLOR
                    : WORKBENCH_CENTRE_TAB_INACTIVE_COLOR,
                }}
              >
                {tab.label}
              </button>
            </div>
          );
        })}
      </div>
      {activeMeta?.subtitle ? (
        <p className="mt-2 whitespace-pre-line text-sm leading-snug text-muted-foreground md:whitespace-normal">
          {activeMeta.subtitle}
        </p>
      ) : null}
    </div>
  );
}
