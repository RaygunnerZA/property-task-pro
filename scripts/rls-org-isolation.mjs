#!/usr/bin/env node
/**
 * Two-organisation RLS isolation checks against a running Supabase (local or staging).
 * Uses the service role only to create users/orgs; data access uses user JWTs.
 *
 * Requires: SUPABASE_URL or VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * and (for local) the published anon key as VITE_SUPABASE_PUBLISHABLE_KEY.
 *
 * Refuses to run against the production project ref gbtexoyvfpnduykmxunc.
 */
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";

const PROD_REF = "gbtexoyvfpnduykmxunc";
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const anonKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

if (!url || !service || !anonKey) {
  fail("Need SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_PUBLISHABLE_KEY");
}
if (url.includes(PROD_REF)) {
  fail("Refusing RLS harness against production project " + PROD_REF);
}

const admin = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const password = process.env.VITE_DEV_TEST_PASSWORD || "TestPassword123!";
const stamp = Date.now();

async function createUser(email) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user;
}

async function clientFor(email) {
  const c = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function adminSql(sql) {
  const dbUrl =
    process.env.SUPABASE_DB_URL ||
    process.env.DB_URL ||
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
  const r = spawnSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-At", "-c", sql], {
    encoding: "utf8",
  });
  if (r.status !== 0) {
    throw new Error(r.stderr || r.stdout || "psql failed");
  }
  return (r.stdout || "").trim();
}

async function main() {
  const emailA = `rls-a-${stamp}@example.com`;
  const emailB = `rls-b-${stamp}@example.com`;
  const userA = await createUser(emailA);
  const userB = await createUser(emailB);

  const idsJson = adminSql(`
    SET session_replication_role = replica;
    WITH org_a AS (
      INSERT INTO organisations (name, org_type, created_by)
      VALUES ('RLS Org A ${stamp}', 'business', '${userA.id}'::uuid)
      RETURNING id
    ),
    org_b AS (
      INSERT INTO organisations (name, org_type, created_by)
      VALUES ('RLS Org B ${stamp}', 'business', '${userB.id}'::uuid)
      RETURNING id
    ),
    mem AS (
      INSERT INTO organisation_members (org_id, user_id, role, membership_status, is_primary_owner)
      SELECT id, '${userA.id}'::uuid, 'owner', 'active', true FROM org_a
      UNION ALL
      SELECT id, '${userB.id}'::uuid, 'owner', 'active', true FROM org_b
    ),
    prop AS (
      INSERT INTO properties (org_id, address, nickname)
      SELECT id, '1 Isolation Street', 'Alpha' FROM org_a
      RETURNING id
    ),
    task AS (
      INSERT INTO tasks (org_id, property_id, title, status)
      SELECT org_a.id, prop.id, 'Secret task', 'open' FROM org_a, prop
      RETURNING id
    )
    SELECT json_build_object(
      'orgA', (SELECT id FROM org_a),
      'orgB', (SELECT id FROM org_b),
      'propA', (SELECT id FROM prop),
      'taskA', (SELECT id FROM task)
    );
  `);
  const jsonLine = idsJson.split("\n").filter((l) => l.startsWith("{")).pop();
  if (!jsonLine) throw new Error("fixture SQL returned no JSON: " + idsJson);
  const ids = JSON.parse(jsonLine);
  const { orgA, orgB, propA, taskA } = ids;

  const a = await clientFor(emailA);
  const b = await clientFor(emailB);

  const { data: aProps } = await a.from("properties").select("id").eq("id", propA);
  assert(aProps?.length === 1, "Owner A must SELECT own property");

  const { data: bProps } = await b.from("properties").select("id").eq("id", propA);
  assert(!bProps || bProps.length === 0, "Org B must not SELECT Org A property");

  const { data: bTasks } = await b.from("tasks").select("id").eq("id", taskA);
  assert(!bTasks || bTasks.length === 0, "Org B must not SELECT Org A task");

  await b.from("tasks").update({ title: "pwned" }).eq("id", taskA);
  const { data: still } = await admin.from("tasks").select("title").eq("id", taskA).single();
  assert(still?.title === "Secret task", "Org B must not UPDATE Org A task");

  const { error: bInsert } = await b.from("properties").insert({
    org_id: orgA,
    address: "cross-org insert",
  });
  assert(bInsert, "Org B must not INSERT into Org A");

  const anonClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: anonRows } = await anonClient.from("properties").select("id").eq("id", propA);
  assert(!anonRows || anonRows.length === 0, "anon must not SELECT properties");

  const { error: followErr } = await b.from("task_followers").insert({
    task_id: taskA,
    user_id: userB.id,
    org_id: orgA,
    created_by: userB.id,
  });
  assert(followErr, "Org B must not INSERT task_followers on Org A task");

  const emailStaff = `rls-staff-${stamp}@example.com`;
  const staff = await createUser(emailStaff);
  adminSql(`
    SET session_replication_role = replica;
    INSERT INTO organisation_members (org_id, user_id, role, membership_status, is_primary_owner)
    VALUES ('${orgA}', '${staff.id}'::uuid, 'staff', 'active', false);
  `);
  const staffClient = await clientFor(emailStaff);
  const { error: staffTask } = await staffClient.from("tasks").insert({
    org_id: orgA,
    property_id: propA,
    title: "Staff should not create",
    status: "open",
  });
  assert(staffTask, "Staff must not INSERT tasks");

  const wrongPath = `org/${orgA}/probe-${stamp}.txt`;
  const { error: storageErr } = await b.storage.from("task-images").upload(wrongPath, "x", {
    contentType: "text/plain",
    upsert: false,
  });
  assert(storageErr, "Org B must not upload into Org A task-images path");

  console.log("RLS org isolation: PASS");
}

main().catch((err) => {
  console.error("RLS org isolation: FAIL", err);
  process.exit(1);
});
