import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ACCESS_PATTERN,
  FAULT_PATTERN,
  INSPECTION_PATTERN,
  TENANT_NOTIFY_SENT_PATTERN,
  VISIT_PATTERN,
  isFaultLike,
  isInspectionLike,
  sharedFaultTokens,
  sharedTokenCount,
  taskText,
} from "@/lib/signals/suggestionMatching";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../fixtures/demo-linden/dataset.json"
);

type DemoTask = {
  key: string;
  title: string;
  description?: string;
  status: string;
  type?: string;
  is_compliance?: boolean;
  created_offset_days?: number;
  due_offset_days?: number;
  completed_offset_days?: number;
  contractor_key?: string;
  asset_keys?: string[];
};

type DemoConversation = {
  taskKey?: string;
  messages: Array<{ body: string; direction: string; source: string }>;
};

type DemoProperty = {
  key: string;
  tasks: DemoTask[];
  records: unknown[];
  conversations: DemoConversation[];
  compliance_documents: Array<{
    key: string;
    title: string;
    document_type?: string;
    expiry_offset_days?: number;
  }>;
};

type DemoDataset = {
  orgs: Array<{ key: string; slug: string; properties: DemoProperty[] }>;
};

const dataset = JSON.parse(readFileSync(fixturePath, "utf8")) as DemoDataset;

function org(key: string) {
  const found = dataset.orgs.find((row) => row.key === key);
  if (!found) throw new Error(`missing org ${key}`);
  return found;
}

function property(orgKey: string, propertyKey: string) {
  const found = org(orgKey).properties.find((row) => row.key === propertyKey);
  if (!found) throw new Error(`missing property ${propertyKey}`);
  return found;
}

function task(orgKey: string, propertyKey: string, taskKey: string) {
  const found = property(orgKey, propertyKey).tasks.find((row) => row.key === taskKey);
  if (!found) throw new Error(`missing task ${taskKey}`);
  return found;
}

function suggestionTask(row: DemoTask) {
  return {
    id: row.key,
    title: row.title,
    description: row.description ?? null,
    status: row.status,
    type: row.type ?? null,
    is_compliance: row.is_compliance ?? null,
  };
}

describe("Linden demo dataset recommendation stories", () => {
  it("keeps demo slugs and fictional emails", () => {
    for (const row of dataset.orgs) {
      expect(row.slug.startsWith("demo-linden-")).toBe(true);
    }
    const raw = readFileSync(fixturePath, "utf8");
    expect(raw).not.toMatch(/\[onboarding_demo\]/);
    expect(raw).not.toMatch(/\(sample\)/i);
    expect(raw).not.toMatch(/gbtexoyvfpnduykmxunc/);
  });

  it("home Linden boiler repair is waiting for access", () => {
    const row = task("org.linden-home", "prop.linden-home", "task.home.boiler-access");
    const corpus = `${row.title} ${row.description}`;
    expect(row.status).toBe("open");
    expect(row.contractor_key).toBeTruthy();
    expect(ACCESS_PATTERN.test(corpus)).toBe(true);
    expect(/\bwait(ing)?\b/i.test(corpus)).toBe(true);
  });

  it("home Linden has three boiler faults on one asset within six months", () => {
    const home = property("org.linden-home", "prop.linden-home");
    const boilerTasks = home.tasks.filter(
      (row) =>
        (row.asset_keys ?? []).includes("asset.linden-home.boiler") &&
        isFaultLike(suggestionTask(row)) &&
        (row.created_offset_days ?? 0) >= -182
    );
    expect(boilerTasks.length).toBeGreaterThanOrEqual(3);
  });

  it("home gas certificate expires inside 60 days without a renewal task", () => {
    const home = property("org.linden-home", "prop.linden-home");
    const cert = home.compliance_documents.find((row) => row.key === "comp.home.gas-safety");
    expect(cert?.expiry_offset_days).toBeGreaterThan(0);
    expect(cert?.expiry_offset_days).toBeLessThanOrEqual(60);
    const renewal = home.tasks.some((row) =>
      /\b(renew|renewal|re-?inspect|certificate|expiry|expire|compliance)\b/i.test(
        `${row.title} ${row.description ?? ""}`
      )
    );
    expect(renewal).toBe(false);
  });

  it("portfolio Linden has two open kitchen boiler leak reports", () => {
    const a = task(
      "org.linden-portfolio",
      "prop.linden-portfolio",
      "task.portfolio.linden-boiler-leak-1"
    );
    const b = task(
      "org.linden-portfolio",
      "prop.linden-portfolio",
      "task.portfolio.linden-boiler-leak-2"
    );
    expect(a.status).toBe("open");
    expect(b.status).toBe("open");
    expect(a.created_offset_days ?? 0).toBeLessThan(b.created_offset_days ?? 0);
    expect((b.created_offset_days ?? 0) >= -14).toBe(true);
    expect(sharedTokenCount(taskText(suggestionTask(a)), taskText(suggestionTask(b)))).toBeGreaterThanOrEqual(2);
    expect(sharedFaultTokens(taskText(suggestionTask(a)), taskText(suggestionTask(b)))).toBe(true);
    expect(FAULT_PATTERN.test(taskText(suggestionTask(a)))).toBe(true);
  });

  it("Rowan visit is due within a week without a recorded tenant update", () => {
    const rowan = property("org.linden-portfolio", "prop.rowan");
    const visit = task("org.linden-portfolio", "prop.rowan", "task.rowan.contractor-visit");
    expect(VISIT_PATTERN.test(taskText(suggestionTask(visit)))).toBe(true);
    expect(visit.due_offset_days).toBeGreaterThanOrEqual(0);
    expect(visit.due_offset_days).toBeLessThanOrEqual(7);
    const bodies = rowan.conversations.flatMap((conversation) =>
      conversation.messages.map((message) => message.body)
    );
    expect(bodies.some((body) => TENANT_NOTIFY_SENT_PATTERN.test(body))).toBe(false);
  });

  it("Harbour fire inspection is complete without a certificate record", () => {
    const harbour = property("org.linden-portfolio", "prop.harbour");
    const inspection = task(
      "org.linden-portfolio",
      "prop.harbour",
      "task.harbour.fire-risk-inspection"
    );
    expect(inspection.status).toBe("completed");
    expect(isInspectionLike(suggestionTask(inspection))).toBe(true);
    expect(INSPECTION_PATTERN.test(taskText(suggestionTask(inspection)))).toBe(true);
    expect(harbour.compliance_documents).toHaveLength(0);
    expect(harbour.records).toHaveLength(0);
  });

  it("Castle EICR expires inside 60 days", () => {
    const castle = property("org.linden-portfolio", "prop.castle");
    const eicr = castle.compliance_documents[0];
    expect(eicr?.document_type).toMatch(/eicr/i);
    expect(eicr?.expiry_offset_days).toBe(45);
  });

  it("Tyne visit records an outbound tenant notification", () => {
    const tyne = property("org.linden-portfolio", "prop.tyne");
    const visit = task("org.linden-portfolio", "prop.tyne", "task.tyne.service-visit");
    expect(VISIT_PATTERN.test(taskText(suggestionTask(visit)))).toBe(true);
    const notify = tyne.conversations
      .flatMap((conversation) => conversation.messages)
      .find((message) => TENANT_NOTIFY_SENT_PATTERN.test(message.body));
    expect(notify?.direction).toBe("outbound");
    expect(notify?.source).toBe("email");
  });

  it("Orchard is ordinary completed maintenance without a recommendation cue", () => {
    const orchard = property("org.linden-portfolio", "prop.orchard");
    const gutter = task("org.linden-portfolio", "prop.orchard", "task.orchard.gutter-clean");
    expect(gutter.status).toBe("completed");
    expect(isInspectionLike(suggestionTask(gutter))).toBe(false);
    expect(isFaultLike(suggestionTask(gutter))).toBe(false);
    expect(orchard.compliance_documents).toHaveLength(0);
    expect(orchard.conversations).toHaveLength(0);
  });
});
