import { useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  CENTRE_WORKBENCH_TABS,
  CENTRE_WORKBENCH_TAB_META,
  centreWorkbenchTasksPath,
  type CentreWorkbenchTab,
} from "@/lib/centreWorkbenchTabs";

type PropertySummaryCentreNavProps = {
  activeTab: CentreWorkbenchTab;
  onTabChange?: (tab: CentreWorkbenchTab) => void;
  /** Hide this row from this breakpoint up (centre column tab strip takes over). */
  hideFrom?: "sm" | "md";
  /** Hub home mobile: deep-link to `/tasks` instead of in-place tab change. */
  linkToTasksRoute?: boolean;
  className?: string;
};

function workbenchSearchParamsFromBrowser(fallback: URLSearchParams): URLSearchParams {
  if (typeof window === "undefined") {
    return new URLSearchParams(fallback);
  }
  return new URLSearchParams(window.location.search);
}

/**
 * Illustrated Inflow · Tasks · Calendar row on property cards (narrow layouts).
 */
export function PropertySummaryCentreNav({
  activeTab,
  onTabChange,
  hideFrom = "sm",
  linkToTasksRoute = false,
  className,
}: PropertySummaryCentreNavProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleTabClick = useCallback(
    (tab: CentreWorkbenchTab) => {
      if (linkToTasksRoute) {
        const params = workbenchSearchParamsFromBrowser(searchParams);
        navigate(centreWorkbenchTasksPath(tab, params));
        return;
      }
      if (onTabChange) {
        onTabChange(tab);
        return;
      }
      const params = workbenchSearchParamsFromBrowser(searchParams);
      navigate(centreWorkbenchTasksPath(tab, params));
    },
    [linkToTasksRoute, navigate, onTabChange, searchParams]
  );

  return (
    <div
      className={cn(
        "flex h-[75px] w-full min-w-0 items-end justify-between gap-1 border-b-2 border-white/50 px-1 pb-[15px] pt-0",
        hideFrom === "md" ? "md:hidden" : "sm:hidden",
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
            onClick={() => handleTabClick(tabId)}
            className={cn(
              "inline-flex min-w-0 flex-1 flex-row items-center justify-start gap-1.5 text-[18px] font-semibold tracking-tight transition-colors sm:text-[17px]",
              isActive ? "text-primary" : "text-primary hover:text-primary/80"
            )}
          >
            <img
              src={meta.illustrationSrc}
              alt=""
              draggable={false}
              decoding="async"
              className={cn(
                "h-[58px] w-[50px] shrink-0 object-contain drop-shadow-sm transition-opacity sm:h-[70px] sm:w-[81px]",
                isActive ? "opacity-100" : "opacity-75"
              )}
            />
            <span className="truncate">{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}
