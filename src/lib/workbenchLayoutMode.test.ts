import { describe, expect, it } from "vitest";
import {
  resolveWorkbenchLayout,
  shouldRouteCentreTabsToWorkSurface,
} from "@/lib/workbenchLayoutMode";

describe("resolveWorkbenchLayout", () => {
  it("treats portfolio home as home-hub (phone: left only; summary routes to /tasks)", () => {
    const layout = resolveWorkbenchLayout({ pathname: "/", workbenchPanel: "home" });
    expect(layout.surfaceRole).toBe("home-hub");
    expect(layout.collapseCentreOnPhone).toBe(true);
    expect(layout.collapseLeftOnPhone).toBe(false);
    expect(layout.stackOnPhone).toBe(false);
    expect(layout.hideCentreTabStripOnPhone).toBe(true);
    expect(layout.propertyCentreNav).toEqual({
      showBelowPhone: true,
      routeToWorkSurface: true,
    });
  });

  it("treats property home as home-hub (phone: left only through Spaces…Records)", () => {
    const layout = resolveWorkbenchLayout({ pathname: "/home", workbenchPanel: "issues" });
    expect(layout.surfaceRole).toBe("home-hub");
    expect(layout.collapseCentreOnPhone).toBe(true);
    expect(layout.collapseLeftOnPhone).toBe(false);
    expect(layout.stackOnPhone).toBe(false);
    expect(layout.propertyCentreNav).toEqual({
      showBelowPhone: true,
      routeToWorkSurface: true,
    });
  });

  it("treats /tasks + home panel as work-surface (phone hides left; centre is primary)", () => {
    const layout = resolveWorkbenchLayout({ pathname: "/tasks", workbenchPanel: "home" });
    expect(layout.surfaceRole).toBe("work-surface");
    expect(layout.collapseCentreOnPhone).toBe(false);
    expect(layout.collapseLeftOnPhone).toBe(true);
    expect(layout.stackOnPhone).toBe(false);
    expect(layout.hideCentreTabStripOnPhone).toBe(false);
    expect(layout.propertyCentreNav.showBelowPhone).toBe(false);
  });

  it("routes centre tabs to work surface from phone home only", () => {
    const home = resolveWorkbenchLayout({ pathname: "/", workbenchPanel: "home" });
    const propertyHome = resolveWorkbenchLayout({ pathname: "/home", workbenchPanel: "issues" });
    const tasks = resolveWorkbenchLayout({ pathname: "/tasks", workbenchPanel: "home" });
    expect(shouldRouteCentreTabsToWorkSurface(home, true)).toBe(true);
    expect(shouldRouteCentreTabsToWorkSurface(home, false)).toBe(false);
    expect(shouldRouteCentreTabsToWorkSurface(propertyHome, true)).toBe(true);
    expect(shouldRouteCentreTabsToWorkSurface(tasks, true)).toBe(false);
  });
});
