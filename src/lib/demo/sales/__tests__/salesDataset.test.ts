import { describe, expect, it } from "vitest";
import { buildSalesDataset } from "@/lib/demo/sales/buildSalesDataset";
import { addDays, londonDateOnly, rankPropertySuggestions } from "@/lib/demo/sales/rankSalesSuggestions";
import {
  LINDEN_SLUG_PREFIX,
  PRODUCTION_SUPABASE_REF,
  assertSalesSeedTarget,
  salesResetWouldTouch,
} from "@/lib/demo/sales/resetScope";
import { DOCUMENT_CATEGORIES, type SalesProperty, type SalesTask } from "@/lib/demo/sales/types";

const dataset = buildSalesDataset();
const home = dataset.orgs.find((org) => org.slug === "demo-sales-home")!;
const ops = dataset.orgs.find((org) => org.slug === "demo-sales-ops")!;
const willowHome = home.properties[0]!;
const harbour = ops.properties.find((property) => property.key === "prop.ops.willow")!;

const PLACEHOLDER = /\b(sample|demo|fixture|placeholder|lorem|tbd)\b|\[onboarding_demo\]/i;

function visibleStrings(property: SalesProperty): string[] {
  const values: string[] = [
    property.nickname,
    property.address,
    ...property.spaces.flatMap((row) => [row.name]),
    ...property.assets.flatMap((row) => [row.name, row.notes, row.category]),
    ...property.tasks.flatMap((row) => [row.title, row.description]),
    ...property.records.flatMap((row) => [row.title, row.notes, row.category, row.document_type]),
    ...property.compliance_documents.flatMap((row) => [row.title, row.notes, row.document_type]),
    ...property.conversations.flatMap((row) => row.messages.map((message) => message.body)),
    ...property.signals.flatMap((row) => [row.title, row.body]),
    ...property.contacts.flatMap((row) => [row.name, row.notes, row.role_label]),
    ...property.activity.map((row) => row.summary),
  ];
  return values.filter(Boolean);
}

function countStatus(tasks: SalesTask[], status: SalesTask["status"]): number {
  return tasks.filter((task) => task.status === status).length;
}

describe("sales demo reset scope", () => {
  it("resets one account without the other or Linden", () => {
    expect(salesResetWouldTouch("demo-sales-home", "home")).toBe(true);
    expect(salesResetWouldTouch("demo-sales-ops", "home")).toBe(false);
    expect(salesResetWouldTouch("demo-sales-ops", "ops")).toBe(true);
    expect(salesResetWouldTouch("demo-sales-home", "ops")).toBe(false);
    expect(salesResetWouldTouch("demo-sales-home", "both")).toBe(true);
    expect(salesResetWouldTouch("demo-sales-ops", "both")).toBe(true);
    expect(salesResetWouldTouch(`${LINDEN_SLUG_PREFIX}home`, "both")).toBe(false);
    expect(salesResetWouldTouch("demo-linden-portfolio", "both")).toBe(false);
  });

  it("refuses production and unlisted hosted projects", () => {
    expect(() => assertSalesSeedTarget("http://127.0.0.1:54321", [])).not.toThrow();
    expect(() =>
      assertSalesSeedTarget(`https://${PRODUCTION_SUPABASE_REF}.supabase.co`, [PRODUCTION_SUPABASE_REF])
    ).toThrow(/production/i);
    expect(() => assertSalesSeedTarget("https://otherproject.supabase.co", ["allowed"])).toThrow(/allowlisted/i);
    expect(() => assertSalesSeedTarget("https://allowed.supabase.co", ["allowed"])).not.toThrow();
  });
});

describe("My Home hero", () => {
  const leak = willowHome.tasks.find((task) => task.key === "task.home.pipe-leak")!;
  const boiler = willowHome.tasks.find((task) => task.key === "task.home.boiler-service")!;
  const gas = willowHome.compliance_documents.find((row) => row.key === "comp.home.gas-safety")!;

  it("keeps the leak as the first recommendation", () => {
    const ranked = rankPropertySuggestions({
      dataset,
      orgKey: "org.sales-home",
      propertyKey: "prop.home.willow",
      userKey: "user.home.owner",
    });
    expect(ranked[0]?.kind).toBe("waiting_access");
    expect(ranked[0]?.taskId).toBe("task.home.pipe-leak");
    expect(ranked.some((row) => row.kind === "certificate_expiry" && row.action.recordId === "comp.home.gas-safety")).toBe(
      true
    );
  });

  it("matches the audited leak, boiler service and gas record", () => {
    expect(leak.status).toBe("open");
    expect(leak.priority).toBe("urgent");
    expect(leak.due_offset_days).toBe(2);
    expect(leak.assigned_user_key).toBe("user.home.owner");
    expect(leak.space_keys).toContain("space.home.kitchen");
    expect(leak.asset_keys).toContain("asset.home.supply-pipe");
    expect(`${leak.title} ${leak.description}`).toMatch(/Hale Plumbing/);
    expect(`${leak.title} ${leak.description}`).toMatch(/waiting for access/i);
    expect(boiler.due_offset_days).toBe(8);
    expect(boiler.status).toBe("open");
    expect(gas.expiry_offset_days).toBe(45);
    const renewal = willowHome.tasks.some(
      (task) =>
        task.status !== "completed" &&
        task.status !== "archived" &&
        /\b(renew|renewal|certificate|expiry|expire|compliance)\b/i.test(`${task.title} ${task.description}`)
    );
    expect(renewal).toBe(false);
    const thread = willowHome.conversations.find((row) => row.key === "conv.home.pipe-leak")!;
    expect(thread.messages.map((message) => message.created_offset_hours)).toEqual([-30, -6]);
    expect(willowHome.records.some((row) => row.key === "record.home.leak-photo" && row.parent === "task")).toBe(true);
  });
});

describe("Property Operations hero", () => {
  const leak = harbour.tasks.find((task) => task.key === "task.ops.willow.pipe-leak")!;

  it("keeps the Harbour House leak first when that property is selected", () => {
    const ranked = rankPropertySuggestions({
      dataset,
      orgKey: "org.sales-ops",
      propertyKey: "prop.ops.willow",
      userKey: "user.ops.manager",
    });
    expect(ranked[0]?.kind).toBe("waiting_access");
    expect(ranked[0]?.taskId).toBe("task.ops.willow.pipe-leak");
  });

  it("does not raise waiting-access on the other properties", () => {
    for (const property of ops.properties.filter((row) => row.key !== "prop.ops.willow")) {
      const ranked = rankPropertySuggestions({
        dataset,
        orgKey: "org.sales-ops",
        propertyKey: property.key,
        userKey: "user.ops.manager",
      });
      expect(ranked.some((row) => row.kind === "waiting_access")).toBe(false);
    }
  });

  it("matches the audited riser job, thread, invoice and gas record", () => {
    expect(leak.status).toBe("open");
    expect(leak.priority).toBe("urgent");
    expect(leak.due_offset_days).toBe(2);
    expect(leak.assigned_user_key).toBe("user.ops.manager");
    expect(leak.space_keys).toContain("space.ops.willow.riser");
    expect(leak.asset_keys).toContain("asset.ops.willow.riser-pipe");
    const thread = harbour.conversations.find((row) => row.key === "conv.ops.willow.pipe-leak")!;
    expect(thread.messages.map((message) => message.created_offset_hours)).toEqual([-30, -8, -2]);
    expect(thread.messages[0]?.body).toMatch(/riser cupboard/i);
    expect(thread.messages[1]?.body).toMatch(/Hale is booked/);
    expect(thread.messages[2]?.body).toMatch(/Waiting for access/);
    expect(harbour.records.some((row) => row.key === "record.ops.leak-photo" && row.parent === "task")).toBe(true);
    expect(harbour.records.some((row) => row.key === "record.ops.willow.invoice" && row.parent === "property")).toBe(
      true
    );
    expect(harbour.compliance_documents.find((row) => row.key === "comp.ops.willow.gas-safety")?.expiry_offset_days).toBe(
      45
    );
    expect(ops.properties.find((row) => row.key === "prop.ops.chalet")?.tasks.some((row) => row.key === "task.ops.chalet.turnover")).toBe(true);
    expect(ops.properties.find((row) => row.key === "prop.ops.hotel")?.tasks.some((row) => row.key === "task.ops.hotel.alarm-check")).toBe(true);
    expect(ops.properties.find((row) => row.key === "prop.ops.office")?.tasks.some((row) => row.key === "task.ops.office.light-repair")).toBe(true);
  });
});

describe("sales demo density", () => {
  it("fills My Home within the expected ranges", () => {
    expect(willowHome.spaces.length).toBeGreaterThanOrEqual(12);
    expect(willowHome.assets.length).toBeGreaterThanOrEqual(30);
    expect(willowHome.assets.length).toBeLessThanOrEqual(40);
    expect(willowHome.tasks.length).toBeGreaterThanOrEqual(40);
    expect(willowHome.tasks.length).toBeLessThanOrEqual(55);
    expect(willowHome.tasks.filter((task) => task.recurrence).length).toBeGreaterThanOrEqual(8);
    expect(willowHome.records.length + willowHome.compliance_documents.length).toBeGreaterThanOrEqual(35);
    expect(willowHome.signals.length).toBeGreaterThanOrEqual(25);
    expect(willowHome.contacts.length).toBeGreaterThanOrEqual(8);
    expect(willowHome.conversations.length).toBeGreaterThanOrEqual(12);
    expect(willowHome.activity.length).toBeGreaterThanOrEqual(20);
  });

  it("fills Property Operations within the expected ranges", () => {
    const tasks = ops.properties.flatMap((property) => property.tasks);
    const spaces = ops.properties.flatMap((property) => property.spaces);
    const assetRows = ops.properties.flatMap((property) => property.assets);
    const records = ops.properties.flatMap((property) => property.records);
    const compliance = ops.properties.flatMap((property) => property.compliance_documents);
    const signals = ops.properties.flatMap((property) => property.signals);
    const conversations = ops.properties.flatMap((property) => property.conversations);
    const activity = ops.properties.flatMap((property) => property.activity);
    const contacts = ops.properties.flatMap((property) => property.contacts);
    expect(ops.properties.map((property) => property.nickname)).toEqual([
      "Harbour House",
      "Birch Chalet",
      "The Lantern Rooms",
      "Northline Studio",
    ]);
    expect(spaces.length).toBeGreaterThanOrEqual(40);
    expect(spaces.length).toBeLessThanOrEqual(60);
    expect(assetRows.length).toBeGreaterThanOrEqual(80);
    expect(assetRows.length).toBeLessThanOrEqual(120);
    expect(tasks.length).toBeGreaterThanOrEqual(100);
    expect(tasks.length).toBeLessThanOrEqual(140);
    expect(tasks.filter((task) => task.recurrence).length).toBeGreaterThanOrEqual(20);
    expect(tasks.filter((task) => task.recurrence).length).toBeLessThanOrEqual(30);
    expect(records.length + compliance.length).toBeGreaterThanOrEqual(70);
    expect(records.length + compliance.length).toBeLessThanOrEqual(100);
    expect(signals.length).toBeGreaterThanOrEqual(40);
    expect(signals.length).toBeLessThanOrEqual(55);
    expect(ops.members.length + contacts.length).toBeGreaterThanOrEqual(18);
    expect(ops.members.length + contacts.length).toBeLessThanOrEqual(25);
    expect(conversations.length).toBeGreaterThanOrEqual(25);
    expect(conversations.length).toBeLessThanOrEqual(40);
    expect(activity.length).toBeGreaterThanOrEqual(40);
  });

  it("uses every task status and a spread of record categories", () => {
    for (const org of dataset.orgs) {
      const tasks = org.properties.flatMap((property) => property.tasks);
      for (const status of ["open", "in_progress", "waiting_review", "completed", "archived"] as const) {
        expect(countStatus(tasks, status)).toBeGreaterThan(0);
      }
      const categories = new Set(org.properties.flatMap((property) => property.records.map((row) => row.category)));
      for (const category of DOCUMENT_CATEGORIES) {
        expect(categories.has(category)).toBe(true);
      }
    }
  });

  it("covers the asset groups the stories depend on", () => {
    const homeGroups = new Set(willowHome.assets.map((asset) => asset.group));
    for (const group of ["heating", "plumbing", "electrical", "alarms", "roof", "doors", "appliances", "security", "internet", "exterior"]) {
      expect(homeGroups.has(group)).toBe(true);
    }
    const byProperty = Object.fromEntries(ops.properties.map((property) => [property.key, new Set(property.assets.map((asset) => asset.group))]));
    for (const group of ["safety", "heating", "water", "access"]) expect(byProperty["prop.ops.willow"]?.has(group)).toBe(true);
    for (const group of ["boiler", "chimney", "hot tub", "snow", "seasonal"]) expect(byProperty["prop.ops.chalet"]?.has(group)).toBe(true);
    for (const group of ["rooms", "alarms", "emergency lighting", "guest"]) expect(byProperty["prop.ops.hotel"]?.has(group)).toBe(true);
    for (const group of ["hvac", "fire doors", "lighting", "meeting", "common"]) expect(byProperty["prop.ops.office"]?.has(group)).toBe(true);
  });

  it("keeps urgent signals off the hero properties", () => {
    for (const property of [willowHome, harbour]) {
      expect(property.signals.some((row) => row.severity === "urgent" || row.disposition === "urgent")).toBe(false);
    }
    const themes = new Set(dataset.orgs.flatMap((org) => org.properties.flatMap((property) => property.signals.map((row) => row.theme))));
    for (const theme of ["safety", "maintenance", "compliance", "seasonal", "efficiency", "opportunity", "monitoring"]) {
      expect(themes.has(theme)).toBe(true);
    }
    const states = new Set(dataset.orgs.flatMap((org) => org.properties.flatMap((property) => property.signals.map((row) => row.state))));
    for (const state of ["open", "snoozed", "resolved", "dismissed"]) expect(states.has(state)).toBe(true);
  });

  it("shifts dates from the reset clock and hides placeholder language", () => {
    const asOf = new Date("2026-10-08T00:00:00.000Z");
    const later = addDays(asOf, 10);
    expect(londonDateOnly(addDays(asOf, 2))).not.toBe(londonDateOnly(addDays(later, 2)));
    expect(londonDateOnly(addDays(later, 0))).toBe(londonDateOnly(addDays(asOf, 10)));
    for (const property of dataset.orgs.flatMap((org) => org.properties)) {
      for (const value of visibleStrings(property)) {
        expect(value).not.toMatch(PLACEHOLDER);
      }
    }
  });

  it("links the hero task to its space, asset, photo and conversation", () => {
    for (const [property, taskKey, spaceKey, assetKey] of [
      [willowHome, "task.home.pipe-leak", "space.home.kitchen", "asset.home.supply-pipe"],
      [harbour, "task.ops.willow.pipe-leak", "space.ops.willow.riser", "asset.ops.willow.riser-pipe"],
    ] as const) {
      const row = property.tasks.find((task) => task.key === taskKey)!;
      expect(property.spaces.some((space) => space.key === spaceKey)).toBe(true);
      expect(property.assets.some((asset) => asset.key === assetKey && asset.spaceKey === spaceKey)).toBe(true);
      expect(row.space_keys).toContain(spaceKey);
      expect(row.asset_keys).toContain(assetKey);
      expect(property.records.some((record) => record.taskKey === taskKey && record.assetKey === assetKey)).toBe(true);
      expect(property.conversations.some((conversation) => conversation.taskKey === taskKey)).toBe(true);
    }
  });
});
