import { ReactNode } from "react";

export function AppInitializer({ children }: { children: ReactNode }) {
  // AppBootLoader now handles all routing logic
  // This component is kept for backwards compatibility but is mostly a passthrough
  return <>{children}</>;
}
