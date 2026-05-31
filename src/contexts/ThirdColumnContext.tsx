/**
 * ThirdColumnContext — Indicates when the third column (concertina) is visible.
 * When true, AssistantPanel renders null and the concertina owns the assistant.
 */
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { LAYOUT_BREAKPOINTS } from "@/lib/layoutBreakpoints";

const LG_BREAKPOINT = LAYOUT_BREAKPOINTS.layout;

const ThirdColumnContext = createContext<boolean>(false);

/** Pages that show the third column concertina at `layout` breakpoint */
function isThirdColumnPage(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === "/calendar") return true;
  if (/^\/properties\/[^/]+$/.test(pathname)) return true;
  return false;
}

export function ThirdColumnProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [hasThirdColumn, setHasThirdColumn] = useState(false);

  useEffect(() => {
    const check = () => {
      const wide = window.innerWidth >= LG_BREAKPOINT;
      const onPage = isThirdColumnPage(location.pathname);
      setHasThirdColumn(wide && onPage);
    };

    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [location.pathname]);

  return (
    <ThirdColumnContext.Provider value={hasThirdColumn}>
      {children}
    </ThirdColumnContext.Provider>
  );
}

export function useThirdColumn() {
  return useContext(ThirdColumnContext);
}
