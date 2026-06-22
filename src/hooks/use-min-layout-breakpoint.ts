import * as React from "react";
import { LAYOUT_BREAKPOINTS } from "@/lib/layoutBreakpoints";

/**
 * True at the app `layout` breakpoint (1480px+) — three-column workbench + right rail.
 * Mirrors Tailwind `layout:` and {@link DualPaneLayout} third column visibility.
 */
export function useMinLayoutBreakpoint() {
  const bp = LAYOUT_BREAKPOINTS.layout;
  const query = `(min-width: ${bp}px)`;

  const [matches, setMatches] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  React.useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
