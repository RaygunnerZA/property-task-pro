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

const TAB_ILLUSTRATION_CLASS =
  "h-[80px] w-[100px] shrink-0 object-contain pt-0 pl-3 drop-shadow-sm transition-opacity";

const TAB_LABEL_CLASS =
  "grid w-[100px] grid-flow-col auto-cols-auto items-start pr-0 text-center text-xl font-semibold leading-none tracking-tight";

const ACTIVE_TAB_SHADOW = "inset 0 4px 12px rgba(255, 255, 255, 0.27)";

/**
 * Three-tab strip for the centre work column — Inflow · Tasks · Calendar.
 */
export function CentreWorkbenchTabStrip({
  activeTab,
  onTabChange,
  className,
}: CentreWorkbenchTabStripProps) {
  return (
    <div
      className={cn(
        "flex h-[160px] w-full min-w-0 max-w-full items-start justify-start gap-1 rounded-none border-b-2 border-white/50 bg-white/35 px-2 pb-0 pt-0",
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
              "relative flex h-[160px] w-[120px] shrink-0 flex-col flex-nowrap items-center justify-start gap-0 rounded-t-[12px] rounded-b-none px-2 pb-2 pt-[25px] transition-all duration-200",
              "hover:scale-[1.01] active:scale-[0.99]",
              isActive && "bg-white/50"
            )}
            style={isActive ? { boxShadow: ACTIVE_TAB_SHADOW } : undefined}
          >
            <img
              src={meta.illustrationSrc}
              alt=""
              className={cn(TAB_ILLUSTRATION_CLASS, isActive ? "opacity-100" : "opacity-70")}
              decoding="async"
            />
            <span className={cn(TAB_LABEL_CLASS, isActive ? "text-foreground" : "text-primary")}>
              {meta.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
