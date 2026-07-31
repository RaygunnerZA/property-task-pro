import * as React from "react";
import { LAYOUT_BREAKPOINTS } from "@/lib/layoutBreakpoints";

/**
 * True when the app should use the offcanvas sidebar (sheet) instead of the persistent left rail.
 * Uses {@link LAYOUT_BREAKPOINTS.sidebarRail} (768px) — phones use offcanvas + bottom nav;
 * tablet and desktop keep the condensed hover-expand icon rail.
 */
export function useSidebarOffcanvas() {
  const bp = LAYOUT_BREAKPOINTS.sidebarRail;
  const [offcanvas, setOffcanvas] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${bp - 1}px)`);
    const onChange = () => {
      setOffcanvas(window.innerWidth < bp);
    };
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, [bp]);

  return !!offcanvas;
}
