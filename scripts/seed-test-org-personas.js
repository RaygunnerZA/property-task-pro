/**
 * Add all TEST-01…TEST-06 personas to an organisation with canonical roles.
 *
 * Usage:
 *   node scripts/seed-test-org-personas.js <org-id>
 *
 * Requires .env.local with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * Run `node scripts/create-test-users.js` first if accounts do not exist.
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { TEST_USERS } from "./create-test-users.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

if (existsSync(join(__dirname, "..", ".env.local"))) {
  dotenv.config({ path: join(__dirname, "..", ".env.local") });
} else if (existsSync(join(__dirname, "..", ".env"))) {
  dotenv.config({ path: join(__dirname, "..", ".env") });
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const PERSONA_ROLES = {
  "justinplunkett+alice@gmail.com": "staff",
  "justinplunkett+bob@gmail.com": "staff",
  "justinplunkett+carol@gmail.com": "manager",
  "justinplunkett+david@gmail.com": "member",
  "justinplunkett+emma@gmail.com": "staff",
  "justinplunkett+frank@gmail.com": "member",
};

const orgId = process.argv[2];
if (!orgId) {
  console.error("Usage: node scripts/seed-test-org-personas.js <org-id>");
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw listError;

  const usersByEmail = new Map(
    (listData?.users ?? []).map((u) => [u.email?.toLowerCase(), u])
  );

  for (const spec of TEST_USERS) {
    const user = usersByEmail.get(spec.email.toLowerCase());
    if (!user) {
      console.warn(`⚠️  Skip ${spec.email} — user not found (run create-test-users.js)`);
      continue;
    }

    const role = PERSONA_ROLES[spec.email] ?? "member";
    const { data: existing } = await supabase
      .from("organisation_members")
      .select("id, role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      if (existing.role !== role) {
        const { error: updateError } = await supabase
          .from("organisation_members")
          .update({ role })
          .eq("id", existing.id);
        if (updateError) {
          console.error(`❌ ${spec.email}: ${updateError.message}`);
        } else {
          console.log(`🔄 ${spec.email} → role ${role}`);
        }
      } else {
        console.log(`✓ ${spec.email} already member (${role})`);
      }
      continue;
    }

    const { error: insertError } = await supabase.from("organisation_members").insert({
      org_id: orgId,
      user_id: user.id,
      role,
      assigned_properties: [],
    });

    if (insertError) {
      console.error(`❌ ${spec.email}: ${insertError.message}`);
    } else {
      console.log(`✅ ${spec.email} added as ${role}`);
    }
  }

  console.log("\nNext: DevTools → Seed role-play scenario, then Switch test user (TEST-01…06).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
