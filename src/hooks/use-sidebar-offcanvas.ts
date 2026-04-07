import * as React from "react";
import { LAYOUT_BREAKPOINTS } from "@/lib/layoutBreakpoints";

/**
 * True when the app should use the offcanvas sidebar (sheet) instead of the persistent left rail.
 * Uses {@link LAYOUT_BREAKPOINTS.sidebarRail} (1024px) — wider than `useIsMobile` (768px) so tablets
 * can keep the hub two-column layout while the nav stays a drawer.
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
