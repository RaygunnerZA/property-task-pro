import { compileActionableSuggestions } from "@/lib/signals/compileActionableSuggestions";
import type { SuggestionCompileContext } from "@/lib/signals/actionableSuggestionTypes";
import type { SalesDataset, SalesOrg, SalesProperty } from "@/lib/demo/sales/types";

export function londonStartOfDay(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  const utcMidnight = new Date(`${year}-${month}-${day}T00:00:00Z`);
  const londonHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(utcMidnight)
  );
  return new Date(utcMidnight.getTime() - londonHour * 3600 * 1000);
}

export function addDays(asOf: Date, days: number): Date {
  return new Date(asOf.getTime() + days * 24 * 3600 * 1000);
}

export function londonDateOnly(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

export function rankPropertySuggestions(input: {
  dataset: SalesDataset;
  orgKey: string;
  propertyKey: string;
  userKey: string;
  asOf?: Date;
}) {
  const asOf = input.asOf ?? londonStartOfDay(new Date("2026-10-08T12:00:00Z"));
  const org = input.dataset.orgs.find((row) => row.key === input.orgKey);
  if (!org) throw new Error(`Missing org ${input.orgKey}`);
  const property = org.properties.find((row) => row.key === input.propertyKey);
  if (!property) throw new Error(`Missing property ${input.propertyKey}`);
  const user = input.dataset.users.find((row) => row.key === input.userKey);
  const member = org.members.find((row) => row.userKey === input.userKey);
  const ctx = compileContext(org, property, user?.key ?? input.userKey, member?.role ?? "owner", asOf);
  return compileActionableSuggestions(ctx);
}

function compileContext(
  org: SalesOrg,
  property: SalesProperty,
  userKey: string,
  role: string,
  asOf: Date
): SuggestionCompileContext {
  const tasks = property.tasks.map((row) => ({
    id: row.key,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    property_id: property.key,
    property_name: property.nickname,
    assigned_user_id: row.assigned_user_key ?? null,
    assigned_vendor_name: vendorName(org, row.contractor_key),
    due_date: row.due_offset_days != null ? addDays(asOf, row.due_offset_days).toISOString() : null,
    due_at: row.due_offset_days != null ? addDays(asOf, row.due_offset_days).toISOString() : null,
    created_at: addDays(asOf, row.created_offset_days).toISOString(),
    updated_at: addDays(asOf, row.updated_offset_days).toISOString(),
    completed_at:
      row.completed_offset_days != null ? addDays(asOf, row.completed_offset_days).toISOString() : null,
    is_compliance: row.is_compliance,
    type: row.type,
    images: property.records
      .filter((record) => record.parent === "task" && record.taskKey === row.key)
      .map((record) => ({ file_name: record.file_name, file_type: "image/svg+xml" })),
    asset_ids: row.asset_keys,
  }));
  const documents = property.compliance_documents.map((row) => ({
    id: row.key,
    title: row.title,
    document_type: row.document_type,
    expiry_date: londonDateOnly(addDays(asOf, row.expiry_offset_days)),
    next_due_date: londonDateOnly(addDays(asOf, row.expiry_offset_days)),
    property_id: property.key,
    property_name: property.nickname,
    linked_asset_ids: row.linked_asset_keys,
  }));
  const messagesByTaskId: SuggestionCompileContext["messagesByTaskId"] = {};
  for (const conversation of property.conversations) {
    messagesByTaskId[conversation.taskKey] = conversation.messages.map((message) => ({
      taskId: conversation.taskKey,
      body: message.body,
      createdAt: new Date(asOf.getTime() + message.created_offset_hours * 3600 * 1000).toISOString(),
      direction: message.direction,
      source: message.source,
    }));
  }
  return {
    now: asOf,
    currentUserId: userKey,
    role,
    assignedPropertyIds: null,
    scopedPropertyIds: new Set([property.key]),
    tasks,
    documents,
    signals: property.signals.map((row) => ({
      id: row.key,
      property_id: property.key,
      kind: "system",
      subtype: "monitoring.note",
      severity: row.severity,
      title: row.title,
      body: row.body,
      disposition: row.state === "dismissed" ? "dismissed" : "recent",
      payload: {},
      created_at: addDays(asOf, row.created_offset_days).toISOString(),
      resolved_at: row.state === "resolved" || row.state === "dismissed" ? asOf.toISOString() : null,
    })),
    taskAssetLinks: property.tasks.flatMap((row) =>
      row.asset_keys.map((assetId) => ({ taskId: row.key, assetId }))
    ),
    assets: property.assets.map((row) => ({
      id: row.key,
      name: row.name,
      property_id: property.key,
    })),
    messagesByTaskId,
    membersByUserId: Object.fromEntries(
      org.members.map((member) => [member.userKey, { name: member.userKey, role: member.role }])
    ),
    userState: {},
  };
}

function vendorName(org: SalesOrg, contractorKey?: string): string | null {
  if (!contractorKey) return null;
  for (const property of org.properties) {
    const contact = property.contacts.find((row) => row.key === contractorKey);
    if (contact) return contact.name;
  }
  return null;
}
