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

const ACTIVE_PHONE_SHADOW = "inset 0 2px 6px rgba(255, 255, 255, 0.35)";
const ACTIVE_DESKTOP_SHADOW = "inset 0 4px 12px rgba(255, 255, 255, 0.27)";

/**
 * Three-tab strip for the centre work column — Inflow · Tasks · Calendar.
 *
 * Phone (&lt; md): compact horizontal bar — icon left of title, equal-width tabs.
 * Desktop (md+): tall illustrated tabs — icon above title.
 */
export function CentreWorkbenchTabStrip({
  activeTab,
  onTabChange,
  className,
}: CentreWorkbenchTabStripProps) {
  return (
    <div
      className={cn(
        "flex w-full min-w-0 max-w-full items-stretch justify-stretch gap-1 rounded-none border-b-2 border-white/50 bg-white/35 px-1.5 py-1.5",
        "md:h-[160px] md:items-start md:justify-start md:px-2 md:pb-0 md:pt-0",
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
              "hover:scale-[1.01] active:scale-[0.99]",
              "md:h-[160px] md:w-[120px] md:flex-none md:shrink-0 md:flex-col md:items-center md:justify-start md:gap-0 md:rounded-t-xl md:rounded-b-none md:px-2 md:pb-2 md:pt-[25px]",
              isActive && "bg-white/50"
            )}
          >
            {isActive ? (
              <>
                <span
                  className="pointer-events-none absolute inset-0 rounded-[inherit] md:hidden"
                  style={{ boxShadow: ACTIVE_PHONE_SHADOW }}
                  aria-hidden
                />
                <span
                  className="pointer-events-none absolute inset-0 hidden rounded-[inherit] md:block"
                  style={{ boxShadow: ACTIVE_DESKTOP_SHADOW }}
                  aria-hidden
                />
              </>
            ) : null}
            <img
              src={meta.illustrationSrc}
              alt=""
              className={cn(
                "shrink-0 object-contain drop-shadow-sm transition-opacity",
                "h-8 w-8",
                "md:h-[80px] md:w-[100px] md:pt-0 md:pl-3",
                isActive ? "opacity-100" : "opacity-70"
              )}
              decoding="async"
            />
            <span
              className={cn(
                "min-w-0 truncate font-semibold tracking-tight",
                "text-[13px] leading-tight",
                "md:w-[100px] md:overflow-visible md:whitespace-normal md:text-center md:text-xl md:leading-none",
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
