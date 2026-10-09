#!/usr/bin/env node
/**
 * Seed the sales-demo organisations from src/lib/demo/sales.
 *
 * Local Supabase, or a hosted project whose ref is listed in
 * SALES_DEMO_PROJECT_IDS. Refuses production unless --allow-live-demo is
 * passed for an explicit live install. Replaces only demo-sales-home and
 * demo-sales-ops.
 * Does not delete other @filla-demo.test users (including Linden).
 * Does not call AI, Stripe, email, or notification APIs.
 *
 *   npm run seed:demo-sales
 *   npm run seed:demo-sales:home
 *   npm run seed:demo-sales:ops
 *
 * Requires SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY,
 * and DEMO_PASSWORD. Org inserts use psql (SUPABASE_DB_URL or local 54322)
 * so handle_new_organisation does not run with a null auth.uid().
 */
import { createClient } from "@supabase/supabase-js";
import { Resvg } from "@resvg/resvg-js";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { register } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

if (existsSync(join(root, ".env.local"))) {
  dotenv.config({ path: join(root, ".env.local") });
} else if (existsSync(join(root, ".env"))) {
  dotenv.config({ path: join(root, ".env") });
}

await register(pathToFileURL(join(__dirname, "sales-ts-loader.mjs")).href, {
  parentURL: import.meta.url,
  data: { root },
});

const { buildSalesDataset } = await import("../src/lib/demo/sales/buildSalesDataset.ts");
const { renderLeakPhotoSvg, renderRecordSvg } = await import("../src/lib/demo/sales/documentSvg.ts");
const { addDays, londonDateOnly, londonStartOfDay, rankPropertySuggestions } = await import(
  "../src/lib/demo/sales/rankSalesSuggestions.ts"
);
const { assertSalesSeedTarget, salesSlugsFor } = await import("../src/lib/demo/sales/resetScope.ts");

const reset = process.argv.includes("--reset");
const allowLiveDemo = process.argv.includes("--allow-live-demo");
const accountArg = process.argv.find((arg) => arg.startsWith("--account="));
const account = accountArg ? accountArg.slice("--account=".length) : "both";
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const service =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || "";
function resolveDbUrl(projectUrl) {
  if (process.env.SUPABASE_DB_URL || process.env.DB_URL) {
    return process.env.SUPABASE_DB_URL || process.env.DB_URL;
  }
  const poolerPath = join(root, "supabase", ".temp", "pooler-url");
  const password = process.env.SUPABASE_DB_PASSWORD || "";
  if (projectUrl.includes("gbtexoyvfpnduykmxunc") && existsSync(poolerPath) && password) {
    const pooler = new URL(readFileSync(poolerPath, "utf8").trim());
    pooler.password = password;
    pooler.searchParams.set("sslmode", "require");
    return pooler.toString();
  }
  return "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
}
const allowlist = (process.env.SALES_DEMO_PROJECT_IDS || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const HEROES = [
  {
    slug: "demo-sales-home",
    orgKey: "org.sales-home",
    propertyKey: "prop.home.willow",
    userKey: "user.home.owner",
    taskKey: "task.home.pipe-leak",
  },
  {
    slug: "demo-sales-ops",
    orgKey: "org.sales-ops",
    propertyKey: "prop.ops.willow",
    userKey: "user.ops.manager",
    taskKey: "task.ops.willow.pipe-leak",
  },
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (account !== "home" && account !== "ops" && account !== "both") {
  fail("--account must be home, ops, or both.");
}
if (!url || !service) {
  fail("Need SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.");
}
try {
  assertSalesSeedTarget(url, allowlist, allowLiveDemo);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

const dbUrl = resolveDbUrl(url);

function redact(text) {
  const secret = process.env.SUPABASE_DB_PASSWORD || "";
  if (!secret) return text;
  return String(text).split(secret).join("[redacted]").split(encodeURIComponent(secret)).join("[redacted]");
}

const admin = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function sqlLit(value) {
  if (value == null) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function adminSql(sql) {
  const result = spawnSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-At", "-c", sql], {
    encoding: "utf8",
  });
  if (result.error) {
    throw new Error(
      `psql failed (${redact(result.error.message)}). Set SUPABASE_DB_URL or start local Postgres on 54322.`
    );
  }
  if (result.status !== 0) {
    throw new Error(redact(result.stderr || result.stdout || "psql failed"));
  }
  return (result.stdout || "").trim();
}

function throwIfError(error, context) {
  if (error) throw new Error(`${context}: ${error.message || error}`);
}

function isoAt(asOf, days) {
  return addDays(asOf, days ?? 0).toISOString();
}

function isoHours(asOf, hours) {
  return new Date(asOf.getTime() + (hours ?? 0) * 3600 * 1000).toISOString();
}

function dateOnly(asOf, days) {
  return londonDateOnly(addDays(asOf, days ?? 0));
}

function complianceStatus(expiryDate, asOf) {
  if (!expiryDate) return "valid";
  const today = londonDateOnly(asOf);
  if (expiryDate < today) return "expired";
  const horizon = londonDateOnly(addDays(asOf, 30));
  if (expiryDate <= horizon) return "expiring";
  return "valid";
}

function nextRunIso(dueIso, rule) {
  const next = new Date(dueIso || Date.now());
  const interval = Math.max(1, rule.interval || 1);
  if (rule.type === "weekly") next.setUTCDate(next.getUTCDate() + 7 * interval);
  else if (rule.type === "monthly") next.setUTCMonth(next.getUTCMonth() + interval);
  else if (rule.type === "yearly") next.setUTCFullYear(next.getUTCFullYear() + interval);
  else next.setUTCDate(next.getUTCDate() + interval);
  return next.toISOString();
}

function resolvePassword(spec) {
  const raw = spec.password || "";
  if (!raw.startsWith("env:")) return raw;
  const name = raw.slice(4);
  const named = process.env[name];
  if (named) return named;
  if (process.env.DEMO_PASSWORD) return process.env.DEMO_PASSWORD;
  throw new Error(`Missing ${name} for ${spec.email}. Set that variable or DEMO_PASSWORD.`);
}

function vendorName(org, contractorKey) {
  if (!contractorKey) return null;
  for (const property of org.properties) {
    const contact = property.contacts.find((row) => row.key === contractorKey);
    if (contact) return contact.name;
  }
  return null;
}

function visibleDateLabel(file, record, asOf) {
  const raw = file.dateLabel || "";
  if (!raw || /offset/i.test(raw)) {
    return record?.expiry_offset_days != null ? dateOnly(asOf, record.expiry_offset_days) : "Filed";
  }
  return raw;
}

function svgBytes(file, record, asOf) {
  const svg =
    file.kind === "leak"
      ? renderLeakPhotoSvg(file.caption || file.title || "Leak")
      : renderRecordSvg({
          eyebrow: file.eyebrow || record?.category || "Record",
          title: file.title || record?.title || "Record",
          issuer: file.issuer || record?.issuer || "",
          reference: file.reference || record?.reference || "",
          dateLabel: visibleDateLabel(file, record, asOf),
          lines: file.lines?.length ? file.lines : [record?.notes || "Filed with the property records."],
        });
  return Buffer.from(svg, "utf8");
}

async function findUserByEmail(email) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    throwIfError(error, `listUsers page ${page}`);
    const users = data?.users ?? [];
    const found = users.find((user) => user.email?.toLowerCase() === target);
    if (found) return found;
    if (users.length < 200) return null;
  }
  return null;
}

async function ensureUser(spec, ids) {
  const password = resolvePassword(spec);
  const metadata = {
    first_name: spec.first_name,
    last_name: spec.last_name,
    display_name: `${spec.first_name} ${spec.last_name}`,
  };
  const existing = await findUserByEmail(spec.email);
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: metadata,
    });
    throwIfError(error, `update user ${spec.email}`);
    ids[spec.key] = existing.id;
    console.log(`↻ user ${spec.email}`);
    return;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: spec.email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });
  throwIfError(error, `create user ${spec.email}`);
  if (!data?.user?.id) throw new Error(`No user id for ${spec.email}`);
  ids[spec.key] = data.user.id;
  console.log(`+ user ${spec.email}`);
}

async function listStorageEntries(bucket, prefix) {
  const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) {
    if (/not found|does not exist/i.test(error.message || "")) return [];
    throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
  }
  return data ?? [];
}

async function removeStoragePrefix(bucket, prefix) {
  const entries = await listStorageEntries(bucket, prefix);
  const files = [];
  for (const entry of entries) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (!entry.id) await removeStoragePrefix(bucket, path);
    else files.push(path);
  }
  if (files.length > 0) {
    const { error } = await admin.storage.from(bucket).remove(files);
    if (error) console.warn(`storage remove ${bucket}: ${error.message}`);
  }
}

function countAuthDemoUsers() {
  return Number(
    adminSql(`SELECT count(*) FROM auth.users WHERE lower(email) LIKE '%@filla-demo.test';`)
  );
}

function countLindenOrgs() {
  return Number(adminSql(`SELECT count(*) FROM organisations WHERE slug LIKE 'demo-linden-%';`));
}

async function resetSalesOrgs(slugs) {
  const allowed = new Set(["demo-sales-home", "demo-sales-ops"]);
  for (const slug of slugs) {
    if (!allowed.has(slug) || slug.startsWith("demo-linden")) {
      throw new Error(`Refusing to reset unexpected slug ${slug}.`);
    }
  }
  const listed = slugs.map((slug) => sqlLit(slug)).join(", ");
  const rows = JSON.parse(
    adminSql(
      `SELECT COALESCE(json_agg(json_build_object('id', id, 'slug', slug)), '[]'::json)
       FROM organisations WHERE slug IN (${listed});`
    ) || "[]"
  );
  for (const org of rows) {
    await removeStoragePrefix("task-images", `org/${org.id}`);
    await removeStoragePrefix("inbox", `orgs/${org.id}`);
  }
  if (rows.length === 0) return;
  const ids = rows.map((org) => `${sqlLit(org.id)}::uuid`).join(", ");
  const blockers = adminSql(`
    SELECT DISTINCT kcu.table_name || '.' || kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_name = 'organisations'
      AND rc.delete_rule = 'NO ACTION'
      AND kcu.column_name = 'org_id';
  `);
  const ordered = blockers
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("organisation_members."))
    .sort((a, b) => {
      const rank = (name) => (name.startsWith("messages.") ? 0 : name.startsWith("conversations.") ? 1 : 2);
      return rank(a) - rank(b);
    });
  const deletes = ordered
    .map((qualified) => {
      const [table, column] = qualified.split(".");
      return `DELETE FROM public.${table} WHERE ${column} IN (${ids});`;
    })
    .join("\n");
  adminSql(`
    ${deletes}
    SET session_replication_role = replica;
    DELETE FROM public.organisation_members WHERE org_id IN (${ids});
    SET session_replication_role = origin;
    DELETE FROM public.organisations WHERE id IN (${ids});
  `);
  console.log(`- replaced ${rows.map((org) => org.slug).join(", ")}`);
}

function insertOrgSql(org, orgId, createdBy) {
  adminSql(`
    SET session_replication_role = replica;
    INSERT INTO organisations (id, name, slug, org_type, created_by)
    VALUES (
      ${sqlLit(orgId)}::uuid,
      ${sqlLit(org.name)},
      ${sqlLit(org.slug)},
      ${sqlLit(org.org_type)}::org_type,
      ${sqlLit(createdBy)}::uuid
    );
    SET session_replication_role = origin;
  `);
}

async function upsertOrgSettings(orgId) {
  const { error } = await admin.from("org_settings").upsert(
    {
      org_id: orgId,
      auto_task_creation: false,
      auto_assignment: false,
      auto_assign_contractors: false,
      auto_task_generation: false,
      auto_schedule_compliance: false,
      require_task_photo: false,
      require_task_location: false,
      require_task_category: false,
    },
    { onConflict: "org_id" }
  );
  throwIfError(error, "org_settings");
}

async function upsertSubscription(orgId, planId) {
  const { error } = await admin.from("org_subscriptions").upsert(
    {
      org_id: orgId,
      plan_id: planId,
      status: "active",
      billing_state: "active",
      stripe_customer_id: null,
      stripe_subscription_id: null,
    },
    { onConflict: "org_id" }
  );
  throwIfError(error, "org_subscriptions");
}

async function insertMember(orgId, userId, member) {
  const { error } = await admin.from("organisation_members").insert({
    org_id: orgId,
    user_id: userId,
    role: member.role,
    is_primary_owner: Boolean(member.is_primary_owner),
    membership_status: "active",
    assigned_properties: [],
  });
  throwIfError(error, `membership ${member.userKey}`);
}

let warnedMissingTaskAssets = false;

async function linkTaskAssets(taskId, assetIds) {
  if (assetIds.length === 0) return;
  const { error } = await admin.from("task_assets").insert(
    assetIds.map((asset_id) => ({ task_id: taskId, asset_id }))
  );
  if (error && (error.code === "42P01" || /does not exist|schema cache/i.test(error.message || ""))) {
    if (!warnedMissingTaskAssets) {
      console.warn("task_assets is not in this schema; asset links on tasks were skipped.");
      warnedMissingTaskAssets = true;
    }
    return;
  }
  throwIfError(error, "task_assets");
}

async function wipePropertyContent(propertyId) {
  const { data: taskRows, error: taskListError } = await admin
    .from("tasks")
    .select("id")
    .eq("property_id", propertyId);
  throwIfError(taskListError, "list tasks for wipe");
  const taskIds = (taskRows ?? []).map((row) => row.id);
  if (taskIds.length > 0) {
    const { error } = await admin.from("attachments").delete().eq("parent_type", "task").in("parent_id", taskIds);
    throwIfError(error, "wipe task attachments");
  }
  const steps = [
    ["property attachments", () => admin.from("attachments").delete().eq("parent_type", "property").eq("parent_id", propertyId)],
    ["conversations", () => admin.from("conversations").delete().eq("property_id", propertyId)],
    ["tasks", () => admin.from("tasks").delete().eq("property_id", propertyId)],
    ["assets", () => admin.from("assets").delete().eq("property_id", propertyId)],
    ["compliance_documents", () => admin.from("compliance_documents").delete().eq("property_id", propertyId)],
    ["signals", () => admin.from("signals").delete().eq("property_id", propertyId)],
    ["spaces", () => admin.from("spaces").delete().eq("property_id", propertyId)],
    ["contacts", () => admin.from("contacts").delete().eq("property_id", propertyId)],
  ];
  for (const [label, run] of steps) {
    const { error } = await run();
    if (error && /does not exist|schema cache/i.test(error.message || "")) continue;
    throwIfError(error, `wipe ${label}`);
  }
}

const uploadedFiles = new Map();

async function uploadFile(orgId, propertyId, file, record, asOf) {
  const cached = uploadedFiles.get(`${orgId}:${file.key}`);
  if (cached) return cached;
  const svg = svgBytes(file, record, asOf);
  const bytes = Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: file.kind === "leak" ? 1200 : 900 } }).render().asPng());
  const objectPath = `org/${orgId}/properties/${propertyId}/documents/${randomUUID()}.png`;
  const { error: uploadError } = await admin.storage.from("task-images").upload(objectPath, bytes, {
    contentType: "image/png",
    upsert: false,
  });
  throwIfError(uploadError, `upload ${file.key}`);
  const { data: urlData } = admin.storage.from("task-images").getPublicUrl(objectPath);
  const stored = { url: urlData.publicUrl, size: bytes.length };
  uploadedFiles.set(`${orgId}:${file.key}`, stored);
  return stored;
}

async function insertRecord(org, propertyId, record, filesByKey, asOf, ids, counts) {
  const file = filesByKey.get(record.fileKey);
  if (!file) throw new Error(`Unknown file key ${record.fileKey}`);
  const stored = await uploadFile(ids[org.key], propertyId, file, record, asOf);
  const parentId = record.parent === "task" ? ids[record.taskKey] : propertyId;
  if (!parentId) throw new Error(`Missing parent for ${record.key}`);
  const expiry = record.expiry_offset_days != null ? dateOnly(asOf, record.expiry_offset_days) : null;
  const { data, error } = await admin
    .from("attachments")
    .insert({
      org_id: ids[org.key],
      parent_type: record.parent === "task" ? "task" : "property",
      parent_id: parentId,
      file_url: stored.url,
      file_name: String(record.file_name || "record.svg").replace(/\.svg$/i, ".png"),
      file_type: "image/png",
      file_size: stored.size,
      title: record.title,
      category: record.category,
      document_type: record.document_type,
      expiry_date: expiry,
      notes: record.notes,
      upload_status: "complete",
      created_at: isoAt(asOf, record.created_offset_days),
      metadata: {
        fixture_key: record.key,
        issuer: record.issuer,
        reference: record.reference,
      },
    })
    .select("id")
    .single();
  throwIfError(error, `attachment ${record.key}`);
  ids[record.key] = data.id;
  counts.records += 1;
  if (record.spaceKey && ids[record.spaceKey]) {
    const { error: spaceError } = await admin.from("attachment_spaces").insert({
      org_id: ids[org.key],
      attachment_id: data.id,
      space_id: ids[record.spaceKey],
    });
    throwIfError(spaceError, `attachment_spaces ${record.key}`);
  }
  if (record.assetKey && ids[record.assetKey]) {
    const manual = /manual|o&m/i.test(`${record.category} ${record.document_type}`);
    const { error: assetError } = await admin.from("asset_files").insert({
      asset_id: ids[record.assetKey],
      file_url: stored.url,
      file_type: manual ? "manual" : "image",
      uploaded_at: isoAt(asOf, record.created_offset_days),
      uploaded_by: ids[org.members.find((member) => member.is_primary_owner)?.userKey] ?? null,
    });
    throwIfError(assetError, `asset_files ${record.key}`);
  }
}

function signalInsert(columns, signal, orgId, propertyId, asOf) {
  const values = {
    org_id: orgId,
    property_id: propertyId,
    task_id: null,
    type: "reminder",
    title: signal.title,
    body: signal.body,
    source: "system",
    source_key: signal.key,
    status: signal.state,
    severity: signal.severity,
    created_at: isoAt(asOf, signal.created_offset_days),
    updated_at: isoAt(asOf, signal.created_offset_days),
    resolved_at:
      signal.state === "resolved" || signal.state === "dismissed"
        ? isoAt(asOf, signal.created_offset_days)
        : null,
    snooze_until: signal.state === "snoozed" ? isoAt(asOf, 14) : null,
    metadata: { fixture_key: signal.key, theme: signal.theme, disposition: signal.disposition },
    kind: "system",
    category: signal.theme,
    subtype: "monitoring.note",
    disposition: signal.state === "dismissed" ? "dismissed" : signal.disposition,
    review_state: signal.state,
    payload: { theme: signal.theme },
  };
  const row = {};
  for (const [key, value] of Object.entries(values)) {
    if (columns.has(key)) row[key] = value;
  }
  return row;
}

async function seedProperty(org, property, asOf, ids, filesByKey, signalColumns, counts) {
  const ownerId = ids[org.members.find((member) => member.is_primary_owner)?.userKey];
  const { data: propertyRow, error: propertyError } = await admin
    .from("properties")
    .insert({
      org_id: ids[org.key],
      address: property.address,
      nickname: property.nickname,
      icon_name: property.icon_name ?? "home",
      icon_color_hex: property.icon_color_hex ?? null,
      owner_name: property.owner_name ?? null,
      owner_email: property.owner_email ?? null,
      contact_name: property.contact_name ?? null,
      contact_email: property.contact_email ?? null,
      contact_phone: property.contact_phone ?? null,
    })
    .select("id")
    .single();
  throwIfError(propertyError, `property ${property.key}`);
  const propertyId = propertyRow.id;
  ids[property.key] = propertyId;
  counts.properties += 1;

  const { error: clearError } = await admin.rpc("clear_onboarding_demo_for_property", {
    p_property_id: propertyId,
  });
  throwIfError(clearError, `clear onboarding ${property.key}`);
  await wipePropertyContent(propertyId);

  for (const space of property.spaces) {
    const { data, error } = await admin
      .from("spaces")
      .insert({
        org_id: ids[org.key],
        property_id: propertyId,
        name: space.name,
        icon_name: space.icon_name ?? null,
      })
      .select("id")
      .single();
    throwIfError(error, `space ${space.key}`);
    ids[space.key] = data.id;
    counts.spaces += 1;
  }

  if (property.details) {
    const { error } = await admin.from("property_details").upsert(
      {
        org_id: ids[org.key],
        property_id: propertyId,
        site_type: property.details.site_type ?? null,
        ownership_type: property.details.ownership_type ?? null,
        floor_count: property.details.floor_count ?? null,
      },
      { onConflict: "property_id" }
    );
    throwIfError(error, `property_details ${property.key}`);
  }

  for (const asset of property.assets) {
    const { data, error } = await admin
      .from("assets")
      .insert({
        org_id: ids[org.key],
        property_id: propertyId,
        space_id: ids[asset.spaceKey] ?? null,
        name: asset.name,
        asset_type: asset.asset_type ?? null,
        category: asset.category ?? null,
        condition_score: asset.condition_score ?? null,
        status: asset.status ?? "active",
        icon_name: asset.icon_name ?? null,
        notes: asset.notes ?? null,
        metadata: {
          fixture_key: asset.key,
          group: asset.group,
          ...(asset.warranty_offset_days != null ? { warranty_offset_days: asset.warranty_offset_days } : {}),
        },
      })
      .select("id")
      .single();
    throwIfError(error, `asset ${asset.key}`);
    ids[asset.key] = data.id;
    counts.assets += 1;
  }

  for (const task of property.tasks) {
    const assignedUserId = task.assigned_user_key ? ids[task.assigned_user_key] : null;
    const spaceIds = (task.space_keys ?? []).map((key) => ids[key]).filter(Boolean);
    const when = isoAt(asOf, task.updated_offset_days ?? task.created_offset_days);
    const { data, error } = await admin
      .from("tasks")
      .insert({
        org_id: ids[org.key],
        property_id: propertyId,
        title: task.title,
        description: task.description ?? null,
        status: task.status,
        priority: task.priority,
        type: task.type ?? null,
        is_compliance: Boolean(task.is_compliance),
        due_at: task.due_offset_days != null ? isoAt(asOf, task.due_offset_days) : null,
        completed_at: task.completed_offset_days != null ? isoAt(asOf, task.completed_offset_days) : null,
        created_at: isoAt(asOf, task.created_offset_days),
        updated_at: when,
        assigned_user_id: assignedUserId,
        assigned_vendor_name: vendorName(org, task.contractor_key),
        space_ids: spaceIds,
        owner_user_id: assignedUserId || ownerId,
        source: "manual",
        metadata: { fixture_key: task.key },
      })
      .select("id")
      .single();
    throwIfError(error, `task ${task.key}`);
    ids[task.key] = data.id;
    counts.tasks += 1;
    if (spaceIds.length > 0) {
      const { error: spaceError } = await admin
        .from("task_spaces")
        .insert(spaceIds.map((space_id) => ({ task_id: data.id, space_id })));
      throwIfError(spaceError, `task_spaces ${task.key}`);
    }
    await linkTaskAssets(
      data.id,
      (task.asset_keys ?? []).map((key) => ids[key]).filter(Boolean)
    );
    if (task.recurrence) {
      const due = task.due_offset_days != null ? isoAt(asOf, task.due_offset_days) : when;
      const { error: ruleError } = await admin.from("task_recurrence").insert({
        org_id: ids[org.key],
        task_id: data.id,
        rule: { type: task.recurrence.type, interval: task.recurrence.interval },
        next_run: nextRunIso(due, task.recurrence),
      });
      throwIfError(ruleError, `task_recurrence ${task.key}`);
      counts.recurrence += 1;
    }
  }

  for (const record of property.records) {
    await insertRecord(org, propertyId, record, filesByKey, asOf, ids, counts);
  }

  for (const doc of property.compliance_documents) {
    const expiry = dateOnly(asOf, doc.expiry_offset_days);
    const { data, error } = await admin
      .from("compliance_documents")
      .insert({
        org_id: ids[org.key],
        property_id: propertyId,
        title: doc.title,
        document_type: doc.document_type ?? null,
        expiry_date: expiry,
        next_due_date: expiry,
        notes: doc.notes ?? null,
        linked_asset_ids: (doc.linked_asset_keys ?? []).map((key) => ids[key]).filter(Boolean),
        status: complianceStatus(expiry, asOf),
        created_at: isoAt(asOf, doc.created_offset_days),
      })
      .select("id")
      .single();
    throwIfError(error, `compliance ${doc.key}`);
    ids[doc.key] = data.id;
    counts.certificates += 1;
  }

  for (const conversation of property.conversations) {
    const { data, error } = await admin
      .from("conversations")
      .insert({
        org_id: ids[org.key],
        property_id: propertyId,
        task_id: ids[conversation.taskKey] ?? null,
        channel: conversation.channel,
        subject: conversation.subject ?? null,
      })
      .select("id")
      .single();
    throwIfError(error, `conversation ${conversation.key}`);
    ids[conversation.key] = data.id;
    counts.conversations += 1;
    for (const message of conversation.messages) {
      const { error: messageError } = await admin.from("messages").insert({
        org_id: ids[org.key],
        conversation_id: data.id,
        author_name: message.author_name,
        author_role: message.author_role ?? null,
        author_user_id: message.author_user_key ? ids[message.author_user_key] ?? null : null,
        direction: message.direction,
        source: message.source,
        body: message.body,
        created_at: isoHours(asOf, message.created_offset_hours ?? 0),
      });
      throwIfError(messageError, `message on ${conversation.key}`);
      counts.messages += 1;
    }
  }

  if (signalColumns.size > 0 && property.signals.length > 0) {
    const rows = property.signals.map((signal) =>
      signalInsert(signalColumns, signal, ids[org.key], propertyId, asOf)
    );
    const { error } = await admin.from("signals").insert(rows);
    throwIfError(error, `signals ${property.key}`);
    counts.signals += rows.length;
  }

  if (property.activity.length > 0) {
    const rows = property.activity.map((event) => ({
      org_id: ids[org.key],
      user_id: ownerId,
      entity_type: event.entity_type,
      entity_id: event.taskKey ? ids[event.taskKey] ?? null : propertyId,
      action: event.action,
      metadata: { fixture_key: event.key, summary: event.summary },
      created_at: isoAt(asOf, event.created_offset_days),
    }));
    const { error } = await admin.from("activity_log").insert(rows);
    if (error && /does not exist|schema cache/i.test(error.message || "")) {
      console.warn("activity_log is not in this schema; activity rows were skipped.");
    } else {
      throwIfError(error, `activity ${property.key}`);
      counts.activity += rows.length;
    }
  }

  const { error: clearAgain } = await admin.rpc("clear_onboarding_demo_for_property", {
    p_property_id: propertyId,
  });
  throwIfError(clearAgain, `clear onboarding after seed ${property.key}`);
  console.log(`+ property ${property.nickname}`);
}

async function insertContacts(org, ids, counts) {
  const seen = new Set();
  for (const property of org.properties) {
    for (const contact of property.contacts) {
      if (seen.has(contact.key)) continue;
      seen.add(contact.key);
      const propertyId = contact.propertyKey ? ids[contact.propertyKey] : ids[property.key];
      const { data, error } = await admin
        .from("contacts")
        .insert({
          org_id: ids[org.key],
          property_id: propertyId ?? null,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          role_label: contact.role_label,
          kind: contact.kind,
          notes: contact.notes,
          created_by: ids[org.members.find((member) => member.is_primary_owner)?.userKey] ?? null,
        })
        .select("id")
        .single();
      throwIfError(error, `contact ${contact.key}`);
      ids[contact.key] = data.id;
      counts.contacts += 1;
    }
  }
}

function assertHeroRank(dataset, asOf, slugs) {
  for (const hero of HEROES) {
    if (!slugs.includes(hero.slug)) continue;
    const ranked = rankPropertySuggestions({
      dataset,
      orgKey: hero.orgKey,
      propertyKey: hero.propertyKey,
      userKey: hero.userKey,
      asOf,
    });
    const top = ranked[0];
    if (top?.kind !== "waiting_access" || top.taskId !== hero.taskKey) {
      throw new Error(
        `${hero.taskKey} is not the first recommendation (got ${top?.kind ?? "none"} ${top?.taskId ?? ""}).`
      );
    }
    console.log(`✓ ${hero.taskKey} ranks first (${top.kind})`);
  }
}

async function assertSeededHeroes(ids, asOf, slugs) {
  for (const hero of HEROES) {
    if (!slugs.includes(hero.slug)) continue;
    const { data, error } = await admin
      .from("tasks")
      .select("status, priority, assigned_user_id, due_at, description")
      .eq("id", ids[hero.taskKey])
      .single();
    throwIfError(error, `read ${hero.taskKey}`);
    if (data.status !== "open" || data.priority !== "urgent") {
      throw new Error(`${hero.taskKey} is ${data.status}/${data.priority}, expected open/urgent.`);
    }
    if (data.assigned_user_id !== ids[hero.userKey]) {
      throw new Error(`${hero.taskKey} is not assigned to ${hero.userKey}.`);
    }
    const due = londonDateOnly(new Date(data.due_at));
    const expected = dateOnly(asOf, 2);
    if (due !== expected) {
      throw new Error(`${hero.taskKey} is due ${due}, expected ${expected}.`);
    }
    if (String(data.description || "").includes("[onboarding_demo]")) {
      throw new Error(`${hero.taskKey} contains an onboarding sample marker.`);
    }
  }
}

async function assertNoOnboarding(orgId) {
  const { count, error } = await admin
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .ilike("description", "%[onboarding_demo]%");
  throwIfError(error, "onboarding task count");
  if ((count ?? 0) > 0) {
    throw new Error(`Organisation ${orgId} still has ${count} onboarding sample task(s).`);
  }
}

function printSummary(orgs, counts, asOf) {
  console.log("");
  console.log(`Sales demo seed complete. As of ${londonDateOnly(asOf)} (Europe/London).`);
  console.log(
    `Counts: ${counts.properties} properties, ${counts.spaces} spaces, ${counts.assets} assets, ${counts.tasks} tasks, ${counts.recurrence} recurrence series, ${counts.conversations} conversations, ${counts.messages} messages, ${counts.records} records, ${counts.certificates} certificates, ${counts.contacts} contacts, ${counts.signals} signals, ${counts.activity} activity rows.`
  );
  console.log("Logins (password is DEMO_PASSWORD; the value is not printed):");
  for (const org of orgs) {
    for (const member of org.members) {
      const user = org.users.find((row) => row.key === member.userKey);
      if (!user) continue;
      console.log(`  ${user.email}  ${org.slug}  ${member.role}`);
    }
  }
}

async function main() {
  const slugs = salesSlugsFor(account);
  const dataset = buildSalesDataset();
  const asOf = londonStartOfDay(new Date());
  const orgs = dataset.orgs.filter((org) => slugs.includes(org.slug));
  if (orgs.length !== slugs.length) {
    throw new Error(`Dataset is missing ${slugs.filter((slug) => !orgs.some((org) => org.slug === slug)).join(", ")}.`);
  }
  const userKeys = new Set(orgs.flatMap((org) => org.members.map((member) => member.userKey)));
  const users = dataset.users.filter((user) => userKeys.has(user.key));
  const filesByKey = new Map(dataset.files.map((file) => [file.key, file]));
  const ids = {};
  const counts = {
    properties: 0,
    spaces: 0,
    assets: 0,
    tasks: 0,
    recurrence: 0,
    conversations: 0,
    messages: 0,
    records: 0,
    certificates: 0,
    contacts: 0,
    signals: 0,
    activity: 0,
  };

  const lindenBefore = countLindenOrgs();
  const usersBefore = countAuthDemoUsers();
  const existing = Number(
    adminSql(
      `SELECT count(*) FROM organisations WHERE slug IN (${slugs.map((slug) => sqlLit(slug)).join(", ")});`
    )
  );
  if (!reset && existing > 0) {
    fail("Sales demo organisations already exist. Re-run with --reset to replace them.");
  }
  if (reset) await resetSalesOrgs(slugs);

  for (const spec of users) await ensureUser(spec, ids);
  const usersAfter = countAuthDemoUsers();
  if (usersAfter < usersBefore) {
    throw new Error("Sales reset removed @filla-demo.test users. That must not happen.");
  }

  const signalColumns = new Set(
    adminSql(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'signals';`
    )
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
  );
  if (!signalColumns.has("kind") || !signalColumns.has("disposition")) {
    console.warn(
      "Signals table has no kind/disposition columns. Rows use the legacy type/status/severity fields. Themed dispositions are kept in metadata and will not drive Found-signal review states."
    );
  }

  for (const org of orgs) {
    const orgId = randomUUID();
    const owner = org.members.find((member) => member.is_primary_owner);
    if (!owner) throw new Error(`${org.key} needs a primary owner`);
    insertOrgSql(org, orgId, ids[owner.userKey]);
    ids[org.key] = orgId;
    await insertMember(orgId, ids[owner.userKey], owner);
    await upsertOrgSettings(orgId);
    await upsertSubscription(orgId, org.plan_id);
    for (const member of org.members) {
      if (member.userKey === owner.userKey) continue;
      await insertMember(orgId, ids[member.userKey], member);
    }
    for (const property of org.properties) {
      await seedProperty(org, property, asOf, ids, filesByKey, signalColumns, counts);
    }
    await insertContacts(org, ids, counts);
    for (const member of org.members) {
      if (!member.assigned_property_keys?.length) continue;
      const assigned = member.assigned_property_keys.map((key) => ids[key]).filter(Boolean);
      const { error } = await admin
        .from("organisation_members")
        .update({ assigned_properties: assigned })
        .eq("org_id", orgId)
        .eq("user_id", ids[member.userKey]);
      throwIfError(error, `assigned_properties ${member.userKey}`);
    }
    await assertNoOnboarding(orgId);
    console.log(`+ org ${org.slug}`);
    org.users = users;
  }

  if (countLindenOrgs() !== lindenBefore) {
    throw new Error("Sales reset changed Linden organisations.");
  }
  assertHeroRank(dataset, asOf, slugs);
  await assertSeededHeroes(ids, asOf, slugs);
  printSummary(orgs, counts, asOf);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
