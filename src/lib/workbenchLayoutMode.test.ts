import { describe, expect, it } from "vitest";
import {
  resolveWorkbenchLayout,
  shouldRouteCentreTabsToWorkSurface,
} from "@/lib/workbenchLayoutMode";

describe("resolveWorkbenchLayout", () => {
  it("treats / + home panel as home-hub (phone collapses centre, property nav routes to work)", () => {
    const layout = resolveWorkbenchLayout({ pathname: "/", workbenchPanel: "home" });
    expect(layout.surfaceRole).toBe("home-hub");
    expect(layout.collapseCentreOnPhone).toBe(true);
    expect(layout.hideCentreTabStripOnPhone).toBe(true);
    expect(layout.propertyCentreNav).toEqual({
      showBelowPhone: true,
      routeToWorkSurface: true,
    });
  });

  it("treats /tasks + home panel as work-surface (centre stays primary on phone)", () => {
    const layout = resolveWorkbenchLayout({ pathname: "/tasks", workbenchPanel: "home" });
    expect(layout.surfaceRole).toBe("work-surface");
    expect(layout.collapseCentreOnPhone).toBe(false);
    expect(layout.hideCentreTabStripOnPhone).toBe(false);
    expect(layout.propertyCentreNav.showBelowPhone).toBe(false);
  });

  it("routes centre tabs to work surface only on home-hub phone viewports", () => {
    const home = resolveWorkbenchLayout({ pathname: "/", workbenchPanel: "home" });
    const tasks = resolveWorkbenchLayout({ pathname: "/tasks", workbenchPanel: "home" });
    expect(shouldRouteCentreTabsToWorkSurface(home, true)).toBe(true);
    expect(shouldRouteCentreTabsToWorkSurface(home, false)).toBe(false);
    expect(shouldRouteCentreTabsToWorkSurface(tasks, true)).toBe(false);
  });
});
