import { cn } from "@/lib/utils";
import {
  CENTRE_WORKBENCH_TABS,
  CENTRE_WORKBENCH_TAB_META,
  type CentreWorkbenchTab,
} from "@/lib/centreWorkbenchTabs";

type CentreWorkbenchTabStripProps = {
  activeTab: CentreWorkbenchTab;
  onTabChange: (tab: CentreWorkbenchTab) => void;
  className?: string;
};

/** Pressed tab: bright inner highlight (bottom/right) + thin outer lip (top/left). */
const ACTIVE_TAB_SHADOW = [
  "-1px -1px 1px rgba(0, 0, 0, 0.05)",
  "inset -1px -1px 2px 0px rgba(255, 255, 255, 0.90)",
  "inset 3px 3px 4px 0px rgba(0, 0, 0, 0.17)",
].join(", ");

/**
 * Three-tab strip for the centre work column — Inflow · Tasks · Calendar.
 *
 * Phone (&lt; md): compact horizontal bar — icon left of title, equal-width tabs.
 * Desktop (md+): illustrated tabs — icon above title.
 * The perforation lives in CentreWorkbench so it can align to the property-image column.
 */
export function CentreWorkbenchTabStrip({
  activeTab,
  onTabChange,
  className,
}: CentreWorkbenchTabStripProps) {
  return (
    <div
      className={cn(
        "relative flex w-full min-w-0 max-w-full items-stretch justify-stretch gap-1 rounded-none px-1.5 py-1.5",
        "md:-ml-[10px] md:h-[142px] md:items-start md:justify-start md:px-2 md:py-0",
        className
      )}
      role="tablist"
      aria-label="Work sections"
    >
      {CENTRE_WORKBENCH_TABS.map((tabId) => {
        const meta = CENTRE_WORKBENCH_TAB_META[tabId];
        const isActive = activeTab === tabId;
        return (
          <button
            key={tabId}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tabId)}
            className={cn(
              "relative flex min-w-0 flex-1 flex-row flex-nowrap items-center justify-center gap-1.5 rounded-xl px-2 py-2 transition-all duration-200",
              "md:h-[142px] md:w-[120px] md:flex-none md:shrink-0 md:flex-col md:items-center md:justify-start md:gap-2 md:px-2 md:pb-[22px] md:pt-3",
              isActive
                ? "bg-black/[0.04]"
                : "hover:scale-[1.01] active:scale-[0.99]"
            )}
            style={isActive ? { boxShadow: ACTIVE_TAB_SHADOW } : undefined}
          >
            <img
              src={meta.illustrationSrc}
              alt=""
              className={cn(
                "mx-auto shrink-0 object-contain drop-shadow-sm transition-opacity",
                "h-8 w-8",
                "md:h-[80px] md:w-[100px]",
                isActive ? "opacity-100" : "opacity-70"
              )}
              decoding="async"
            />
            <span
              className={cn(
                "min-w-0 truncate text-center font-semibold tracking-tight",
                "text-sm leading-tight",
                "md:w-full md:overflow-visible md:whitespace-normal md:text-xl md:leading-none",
                isActive ? "text-foreground" : "text-primary"
              )}
            >
              {meta.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
