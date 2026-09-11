import { describe, expect, it } from "vitest";
import {
  resolveWorkbenchLayout,
  shouldRouteCentreTabsToWorkSurface,
  shouldShowPortfolioCarousel,
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

describe("shouldShowPortfolioCarousel", () => {
  it("shows the All Properties card on portfolio home", () => {
    expect(
      shouldShowPortfolioCarousel({
        pathname: "/",
        workbenchPanel: "home",
        isAllProperties: true,
      })
    ).toBe(true);
  });

  it("keeps the All Properties card when scope is All Properties on /home", () => {
    expect(
      shouldShowPortfolioCarousel({
        pathname: "/home",
        workbenchPanel: "issues",
        isAllProperties: true,
      })
    ).toBe(true);
  });

  it("does not replace a focused property home with the portfolio carousel", () => {
    expect(
      shouldShowPortfolioCarousel({
        pathname: "/home",
        workbenchPanel: "issues",
        isAllProperties: false,
      })
    ).toBe(false);
  });

  it("shows the All Properties card on /tasks when scope is All Properties", () => {
    expect(
      shouldShowPortfolioCarousel({
        pathname: "/tasks",
        workbenchPanel: "home",
        isAllProperties: true,
      })
    ).toBe(true);
  });

  it("does not show the portfolio carousel on records or schedule", () => {
    expect(
      shouldShowPortfolioCarousel({
        pathname: "/records",
        workbenchPanel: "records",
        isAllProperties: true,
      })
    ).toBe(false);
    expect(
      shouldShowPortfolioCarousel({
        pathname: "/agenda",
        workbenchPanel: "schedule",
        isAllProperties: true,
      })
    ).toBe(false);
  });
});
