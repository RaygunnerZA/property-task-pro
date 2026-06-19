#!/usr/bin/env node
/**
 * Refresh onboarding education v2 demo content for all properties in the active org.
 * Uses space mini-card images and dated example tasks.
 *
 * Requires .env.local:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 *   SEED_EMAIL / SEED_PASSWORD (or run while logged in via service role — email/password preferred)
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(root, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m) continue;
      const val = m[2].replace(/^["']|["']$/g, "");
      if (!process.env[m[1]]) process.env[m[1]] = val;
    }
  }
}

async function main() {
  loadEnv();

  const url = process.env.VITE_SUPABASE_URL;
  const anonKey =
    process.env.VITE_SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.SEED_EMAIL ?? process.env.VITE_DEV_EMAIL;
  const password = process.env.SEED_PASSWORD ?? process.env.VITE_DEV_PASSWORD;

  if (!url || (!anonKey && !serviceKey)) {
    console.error("Missing VITE_SUPABASE_URL and API key");
    process.exit(1);
  }

  const sb = createClient(url, serviceKey ?? anonKey, {
    auth: serviceKey ? { persistSession: false, autoRefreshToken: false } : undefined,
  });

  let userId = null;
  let orgId = null;
  let memberRole = null;

  if (serviceKey) {
    const targetEmail = email;
    if (targetEmail) {
      const { data: listData, error: listErr } = await sb.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (listErr) {
        console.error("admin.listUsers failed:", listErr.message);
        process.exit(1);
      }
      const match = listData.users.find(
        (u) => u.email?.toLowerCase() === targetEmail.toLowerCase()
      );
      if (!match) {
        console.error(`No user found for SEED_EMAIL=${targetEmail}`);
        process.exit(1);
      }
      userId = match.id;
      console.log("Target user:", targetEmail);
    } else {
      const { data: members, error: mErr } = await sb
        .from("organisation_members")
        .select("user_id, org_id, role, created_at")
        .order("created_at", { ascending: false })
        .limit(1);
      if (mErr || !members?.[0]) {
        console.error("Could not resolve a user. Set SEED_EMAIL in .env.local");
        process.exit(1);
      }
      userId = members[0].user_id;
      orgId = members[0].org_id;
      memberRole = members[0].role;
      console.log("Using most recent org member", userId);
    }
  } else if (email && password) {
    const userClient = createClient(url, anonKey);
    const { error } = await userClient.auth.signInWithPassword({ email, password });
    if (error) {
      console.error("Sign-in failed:", error.message);
      process.exit(1);
    }
    console.log("Signed in as", email);
    const {
      data: { user },
    } = await userClient.auth.getUser();
    userId = user?.id ?? null;
    const { data: membership } = await userClient
      .from("organisation_members")
      .select("org_id, role")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    orgId = membership?.org_id ?? null;
    memberRole = membership?.role ?? null;

    // Use user-scoped client for RPCs
    const refreshClient = userClient;
    await runSeed(refreshClient, orgId, userId, memberRole);
    return;
  } else {
    console.error("Set SUPABASE_SERVICE_ROLE_KEY or SEED_EMAIL/SEED_PASSWORD");
    process.exit(1);
  }

  if (!orgId && userId) {
    const { data: membership, error: memErr } = await sb
      .from("organisation_members")
      .select("org_id, role")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (memErr || !membership?.org_id) {
      console.error("No org membership:", memErr?.message);
      process.exit(1);
    }
    orgId = membership.org_id;
    memberRole = membership.role;
  }

  await runSeed(sb, orgId, userId, memberRole);
}

async function runSeed(sb, orgId, userId, memberRole) {
  const { data: properties, error: propErr } = await sb
    .from("properties")
    .select("id, nickname, address")
    .eq("org_id", orgId);

  if (propErr) {
    console.error("Properties query failed:", propErr.message);
    process.exit(1);
  }

  if (!properties?.length) {
    console.error("No properties in org — create one first.");
    process.exit(1);
  }

  console.log(`Refreshing education content for ${properties.length} propert(ies)…`);

  for (const p of properties) {
    const label = p.nickname || p.address || p.id;
    const { error } = await sb.rpc("refresh_onboarding_education_for_property", {
      p_property_id: p.id,
    });
    if (error) {
      console.error(`  ✗ ${label}:`, error.message);
    } else {
      console.log(`  ✓ ${label}`);
    }
  }

  if (memberRole === "staff" || memberRole === "member") {
    const propertyId = properties[0]?.id;
    const { error } = await sb.rpc("seed_staff_training_tasks", {
      p_org_id: orgId,
      p_user_id: userId,
      p_property_id: propertyId,
    });
    if (error) {
      console.warn("Staff training seed:", error.message);
    } else {
      console.log("  ✓ Learn Filla training tasks for current user");
    }
  }

  console.log("\nDone. Open Home → Attention to review example content.");
}

main().catch((err) => {
  console.error(err);
  process.env.exitCode = 1;
});
