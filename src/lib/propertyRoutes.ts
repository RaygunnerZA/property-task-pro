/** Query key for TaskPanel tab on the property workbench (`/?property=&panelTab=`). */
export const WORKBENCH_PANEL_TAB_QUERY = "panelTab";

/** Canonical URL for the property workbench (dashboard at / with property scope). */
export function propertyHubPath(propertyId: string, extra?: Record<string, string>): string {
  const q = new URLSearchParams();
  q.set("property", propertyId);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v) q.set(k, v);
    }
  }
  return `/?${q.toString()}`;
}

/** Property hub with the workbench Tasks tab selected (open tasks). */
export function propertyHubTasksPath(propertyId: string): string {
  return propertyHubPath(propertyId, { [WORKBENCH_PANEL_TAB_QUERY]: "tasks" });
}

export type PropertySubRoute =
  | "documents"
  | "compliance"
  | "photos"
  | "plans"
  | "spaces-organise";

export function propertySubPath(propertyId: string, segment: PropertySubRoute): string {
  switch (segment) {
    case "documents":
      return `/properties/${propertyId}/documents`;
    case "compliance":
      return `/properties/${propertyId}/compliance`;
    case "photos":
      return `/properties/${propertyId}/photos`;
    case "plans":
      return `/properties/${propertyId}/plans`;
    case "spaces-organise":
      return `/properties/${propertyId}/spaces/organise`;
  }
}
