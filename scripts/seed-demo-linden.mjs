#!/usr/bin/env node
/**
 * Seed the Linden demo organisations from fixtures/demo-linden.
 *
 * Local or dedicated staging only. Refuses the production project.
 * Does not invoke AI, Stripe, email, or notification channels.
 *
 * Usage:
 *   node scripts/seed-demo-linden.mjs --reset
 *
 * Requires .env.local with SUPABASE_URL / VITE_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY. Passwords: DEMO_*_PASSWORD or DEMO_PASSWORD.
 * Org bootstrap uses psql (SUPABASE_DB_URL or local 54322) so organisation
 * INSERT triggers do not run with a null auth.uid().
 */
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const fixtureDir = join(root, "fixtures", "demo-linden");
const filesDir = join(fixtureDir, "files");
const generatedDir = join(fixtureDir, "generated");
const PROD_REF = "gbtexoyvfpnduykmxunc";
const DEMO_EMAIL_DOMAIN = "@filla-demo.test";
const DEMO_SLUG_PREFIX = "demo-linden-";

if (existsSync(join(root, ".env.local"))) {
  dotenv.config({ path: join(root, ".env.local") });
} else if (existsSync(join(root, ".env"))) {
  dotenv.config({ path: join(root, ".env") });
}

const reset = process.argv.includes("--reset");
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const service =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || "";
const dbUrl =
  process.env.SUPABASE_DB_URL ||
  process.env.DB_URL ||
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!url || !service) {
  fail("Need SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.");
}
if (url.includes(PROD_REF)) {
  fail(`Refusing to seed production project ${PROD_REF}.`);
}
const isLocal = /127\.0\.0\.1|localhost/.test(url);
const allowStaging = process.argv.includes("--allow-staging");
if (!isLocal && (process.env.VITE_SUPABASE_PROJECT_ID || "") === PROD_REF) {
  fail(`Refusing to seed production project ${PROD_REF}.`);
}
if (!isLocal && !allowStaging) {
  fail(
    "Refusing hosted Supabase. Point SUPABASE_URL at local 127.0.0.1:54321, or pass --allow-staging for a dedicated non-production project."
  );
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
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "psql failed");
  }
  return (result.stdout || "").trim();
}

function resolvePassword(spec) {
  const raw = spec.password || "";
  if (!raw.startsWith("env:")) return raw;
  const name = raw.slice(4);
  const named = process.env[name];
  if (named) return named;
  if (process.env.DEMO_PASSWORD) return process.env.DEMO_PASSWORD;
  throw new Error(
    `Missing ${name} for ${spec.email}. Set that variable or DEMO_PASSWORD.`
  );
}

function addDays(asOf, days) {
  const date = new Date(asOf);
  date.setUTCDate(date.getUTCDate() + (days ?? 0));
  return date;
}

function isoAt(asOf, days) {
  return addDays(asOf, days).toISOString();
}

function isoHours(asOf, hours) {
  return new Date(asOf.getTime() + (hours ?? 0) * 3600 * 1000).toISOString();
}

function dateOnly(asOf, days) {
  return isoAt(asOf, days).slice(0, 10);
}

function complianceStatusFromExpiry(expiryDate, asOf) {
  if (!expiryDate) return "valid";
  const exp = new Date(expiryDate);
  const now = new Date(asOf);
  now.setHours(0, 0, 0, 0);
  exp.setHours(0, 0, 0, 0);
  const days = Math.round((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return "expired";
  if (days <= 30) return "expiring";
  return "valid";
}

function throwIfError(error, context) {
  if (error) throw new Error(`${context}: ${error.message || error}`);
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
    return existing.id;
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
  return data.user.id;
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
    const isFolder = !entry.id;
    if (isFolder) {
      await removeStoragePrefix(bucket, path);
    } else {
      files.push(path);
    }
  }
  if (files.length > 0) {
    const { error } = await admin.storage.from(bucket).remove(files);
    if (error) console.warn(`storage remove ${bucket}: ${error.message}`);
  }
}

async function resetDemo(idsHint) {
  const slugsJson = adminSql(
    `SELECT COALESCE(json_agg(json_build_object('id', id, 'slug', slug)), '[]'::json)
     FROM organisations WHERE slug LIKE ${sqlLit(`${DEMO_SLUG_PREFIX}%`)};`
  );
  const orgs = JSON.parse(slugsJson || "[]");
  for (const org of orgs) {
    await removeStoragePrefix("task-images", `org/${org.id}`);
    await removeStoragePrefix("inbox", `orgs/${org.id}`);
  }
  if (orgs.length > 0) {
    adminSql(`
      SET session_replication_role = replica;
      DELETE FROM organisations WHERE slug LIKE ${sqlLit(`${DEMO_SLUG_PREFIX}%`)};
      SET session_replication_role = origin;
    `);
    console.log(`- removed ${orgs.length} demo organisation(s)`);
  }
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    throwIfError(error, "listUsers for reset");
    const users = data?.users ?? [];
    for (const user of users) {
      if (!user.email?.toLowerCase().endsWith(DEMO_EMAIL_DOMAIN)) continue;
      const { error: delError } = await admin.auth.admin.deleteUser(user.id);
      throwIfError(delError, `delete ${user.email}`);
      console.log(`- user ${user.email}`);
    }
    if (users.length < 200) break;
  }
  for (const key of Object.keys(idsHint)) delete idsHint[key];
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
  if (error && (error.code === "42P01" || /does not exist/i.test(error.message || ""))) {
    if (!warnedMissingTaskAssets) {
      console.warn("task_assets is not in this schema; skipping asset links (repeated_fault may not compile).");
      warnedMissingTaskAssets = true;
    }
    return;
  }
  throwIfError(error, "task_assets");
}

function buildIntakeScan(asOf, scan, ids) {
  if (!scan) return undefined;
  return {
    source: scan.source,
    captured_at: asOf.toISOString(),
    outcome: scan.outcome ?? null,
    outcome_severity: scan.outcome_severity ?? null,
    primary_issue: scan.primary_issue ?? null,
    dates: (scan.dates ?? []).map((row) => ({
      label: row.label,
      date: dateOnly(asOf, row.date_offset_days),
      kind: row.kind,
    })),
    findings: scan.findings ?? [],
    confirmed_action_ids: [],
    linked_asset_ids: (scan.linked_asset_keys ?? [])
      .map((key) => ids[key])
      .filter(Boolean),
  };
}

async function uploadRecordFile(orgId, propertyId, fileSpec, record, asOf, ids) {
  const abs = join(filesDir, fileSpec.path);
  if (!existsSync(abs)) throw new Error(`Missing file ${fileSpec.path}`);
  const bytes = readFileSync(abs);
  const ext = fileSpec.path.split(".").pop() || "webp";
  const objectPath = `org/${orgId}/properties/${propertyId}/documents/${randomUUID()}.${ext}`;
  const { error: uploadError } = await admin.storage.from("task-images").upload(objectPath, bytes, {
    contentType: fileSpec.mime || record.file_type || "image/webp",
    upsert: false,
  });
  throwIfError(uploadError, `upload ${fileSpec.path}`);
  const { data: urlData } = admin.storage.from("task-images").getPublicUrl(objectPath);
  const expiry = record.expiry_offset_days != null ? dateOnly(asOf, record.expiry_offset_days) : null;
  const intakeScan = buildIntakeScan(asOf, record.intake_scan, ids);
  const metadata = {
    title: record.title,
    category: record.category ?? null,
    document_type: record.document_type ?? null,
    expiry_date: expiry,
    notes: record.notes ?? null,
    fixture_key: record.key,
    ...(intakeScan ? { intake_scan: intakeScan } : {}),
  };
  const { error } = await admin.from("attachments").insert({
    org_id: orgId,
    parent_type: "property",
    parent_id: propertyId,
    file_url: urlData.publicUrl,
    file_name: record.file_name,
    file_type: record.file_type || fileSpec.mime,
    file_size: bytes.length,
    title: record.title,
    category: record.category ?? null,
    document_type: record.document_type ?? null,
    expiry_date: expiry,
    notes: record.notes ?? null,
    ocr_text: record.ocr_text ?? null,
    upload_status: "complete",
    metadata,
  });
  throwIfError(error, `attachment ${record.key}`);
}

async function wipePropertyContent(propertyId) {
  const steps = [
    ["tasks", () => admin.from("tasks").delete().eq("property_id", propertyId)],
    ["assets", () => admin.from("assets").delete().eq("property_id", propertyId)],
    ["compliance_documents", () => admin.from("compliance_documents").delete().eq("property_id", propertyId)],
    [
      "attachments",
      () => admin.from("attachments").delete().eq("parent_type", "property").eq("parent_id", propertyId),
    ],
    ["conversations", () => admin.from("conversations").delete().eq("property_id", propertyId)],
    ["spaces", () => admin.from("spaces").delete().eq("property_id", propertyId)],
  ];
  for (const [label, run] of steps) {
    const { error } = await run();
    throwIfError(error, `wipe ${label}`);
  }
}

async function seedProperty(org, property, asOf, ids, filesByKey) {
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

  const { error: clearError } = await admin.rpc("clear_onboarding_demo_for_property", {
    p_property_id: propertyId,
  });
  throwIfError(clearError, `clear onboarding ${property.key}`);

  await wipePropertyContent(propertyId);
  for (const space of property.spaces ?? []) {
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

  const contractorName = Object.fromEntries(
    (property.contractors ?? []).map((row) => [row.key, row.display_name])
  );

  for (const asset of property.assets ?? []) {
    const { data, error } = await admin
      .from("assets")
      .insert({
        org_id: ids[org.key],
        property_id: propertyId,
        space_id: asset.spaceKey ? ids[asset.spaceKey] : null,
        name: asset.name,
        asset_type: asset.asset_type ?? null,
        category: asset.category ?? null,
        serial_number: asset.serial_number ?? null,
        condition_score: asset.condition_score ?? null,
        status: asset.status ?? "active",
        icon_name: asset.icon_name ?? null,
        notes: asset.notes ?? null,
        metadata: { fixture_key: asset.key },
      })
      .select("id")
      .single();
    throwIfError(error, `asset ${asset.key}`);
    ids[asset.key] = data.id;
  }

  for (const task of property.tasks ?? []) {
    const assignedUserId = task.assigned_user_key ? ids[task.assigned_user_key] : null;
    const spaceIds = (task.space_keys ?? []).map((key) => ids[key]).filter(Boolean);
    const taskInsert = {
      org_id: ids[org.key],
      property_id: propertyId,
      title: task.title,
      description: task.description ?? null,
      status: task.status,
      priority: task.priority,
      type: task.type ?? null,
      is_compliance: Boolean(task.is_compliance),
      due_at: task.due_offset_days != null ? isoAt(asOf, task.due_offset_days) : null,
      completed_at:
        task.completed_offset_days != null ? isoAt(asOf, task.completed_offset_days) : null,
      assigned_user_id: assignedUserId,
      assigned_vendor_name: task.contractor_key ? contractorName[task.contractor_key] ?? null : null,
      space_ids: spaceIds,
      owner_user_id: assignedUserId || ownerId,
      source: "manual",
      metadata: { fixture_key: task.key },
    };
    if (task.created_offset_days != null) {
      taskInsert.created_at = isoAt(asOf, task.created_offset_days);
    }
    const { data, error } = await admin
      .from("tasks")
      .insert(taskInsert)
      .select("id")
      .single();
    throwIfError(error, `task ${task.key}`);
    ids[task.key] = data.id;
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
  }

  for (const record of property.records ?? []) {
    const fileSpec = filesByKey.get(record.file);
    if (!fileSpec) throw new Error(`Unknown file key ${record.file}`);
    await uploadRecordFile(ids[org.key], propertyId, fileSpec, record, asOf, ids);
    ids[record.key] = record.key;
  }

  for (const doc of property.compliance_documents ?? []) {
    const expiry = doc.expiry_offset_days != null ? dateOnly(asOf, doc.expiry_offset_days) : null;
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
        status: complianceStatusFromExpiry(expiry, asOf),
      })
      .select("id")
      .single();
    throwIfError(error, `compliance_documents ${doc.key}`);
    ids[doc.key] = data.id;
  }

  for (const conversation of property.conversations ?? []) {
    const { data, error } = await admin
      .from("conversations")
      .insert({
        org_id: ids[org.key],
        property_id: propertyId,
        task_id: conversation.taskKey ? ids[conversation.taskKey] : null,
        channel: conversation.channel,
        subject: conversation.subject ?? null,
      })
      .select("id")
      .single();
    throwIfError(error, `conversation ${conversation.key}`);
    ids[conversation.key] = data.id;
    for (const message of conversation.messages ?? []) {
      const { error: messageError } = await admin.from("messages").insert({
        org_id: ids[org.key],
        conversation_id: data.id,
        author_name: message.author_name,
        author_role: message.author_role ?? null,
        author_user_id: message.author_user_key ? ids[message.author_user_key] : null,
        direction: message.direction,
        source: message.source,
        body: message.body,
        created_at: isoHours(asOf, message.created_offset_hours ?? 0),
      });
      throwIfError(messageError, `message on ${conversation.key}`);
    }
  }

  console.log(`+ property ${property.nickname}`);
}

async function main() {
  const dataset = JSON.parse(readFileSync(join(fixtureDir, "dataset.json"), "utf8"));
  const asOf = new Date(dataset.asOf);
  const filesByKey = new Map((dataset.files ?? []).map((file) => [file.key, file]));
  const ids = {};

  if (!reset) {
    const existing = adminSql(
      `SELECT count(*) FROM organisations WHERE slug LIKE ${sqlLit(`${DEMO_SLUG_PREFIX}%`)};`
    );
    if (Number(existing) > 0) {
      fail("Demo organisations already exist. Re-run with --reset to replace them.");
    }
  } else {
    await resetDemo(ids);
  }

  for (const spec of dataset.users) {
    await ensureUser(spec, ids);
  }

  for (const org of dataset.orgs) {
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
      await seedProperty(org, property, asOf, ids, filesByKey);
    }
    for (const member of org.members) {
      if (!member.assigned_property_keys) continue;
      const assigned = member.assigned_property_keys.map((key) => ids[key]).filter(Boolean);
      const { error } = await admin
        .from("organisation_members")
        .update({ assigned_properties: assigned })
        .eq("org_id", orgId)
        .eq("user_id", ids[member.userKey]);
      throwIfError(error, `assigned_properties ${member.userKey}`);
    }
    console.log(`+ org ${org.slug}`);
  }

  mkdirSync(generatedDir, { recursive: true });
  writeFileSync(join(generatedDir, "ids.json"), `${JSON.stringify(ids, null, 2)}\n`);
  console.log(`Wrote ${join("fixtures/demo-linden/generated/ids.json")}`);
  console.log("Linden demo seed complete. Do not use these orgs in production.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
