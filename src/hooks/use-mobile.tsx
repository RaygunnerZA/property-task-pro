import * as React from "react";
import { LAYOUT_BREAKPOINTS } from "@/lib/layoutBreakpoints";

/** @deprecated Prefer LAYOUT_BREAKPOINTS.phone — kept for call-site clarity. */
const MOBILE_BREAKPOINT = LAYOUT_BREAKPOINTS.phone;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}

/** True below Tailwind `md` / {@link LAYOUT_BREAKPOINTS.phone} — mirrors `max-md:` utilities. */
export function useIsBelowMd() {
  const query = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

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
