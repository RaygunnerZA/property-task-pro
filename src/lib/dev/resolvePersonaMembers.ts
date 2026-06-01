import type { SupabaseClient } from "@supabase/supabase-js";
import {
  TEST_PERSONAS,
  type TestPersona,
  type TestPersonaId,
} from "@/lib/dev/testPersonas";

export interface ResolvedPersonaMember {
  persona: TestPersona;
  userId: string;
  displayName: string;
  membershipRole: string;
}

type UserInfoRow = {
  id: string;
  email: string;
  nickname?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

/**
 * Maps configured test personas to org members by email (via `get_users_info` RPC).
 */
export async function resolvePersonaMembers(
  supabase: SupabaseClient,
  orgId: string
): Promise<{
  resolved: Partial<Record<TestPersonaId, ResolvedPersonaMember>>;
  missing: TestPersona[];
}> {
  const { data: memberships, error: membershipError } = await supabase
    .from("organisation_members")
    .select("user_id, role")
    .eq("org_id", orgId);

  if (membershipError) {
    throw membershipError;
  }

  if (!memberships?.length) {
    return { resolved: {}, missing: [...TEST_PERSONAS] };
  }

  const userIds = memberships.map((m) => m.user_id);
  const { data: userData, error: userError } = await supabase.rpc("get_users_info", {
    user_ids: userIds,
  });

  if (userError) {
    throw userError;
  }

  const users = (userData ?? []) as UserInfoRow[];
  const resolved: Partial<Record<TestPersonaId, ResolvedPersonaMember>> = {};
  const missing: TestPersona[] = [];

  for (const persona of TEST_PERSONAS) {
    const membership = memberships.find((m) => {
      const user = users.find((u) => u.id === m.user_id);
      return user?.email?.toLowerCase() === persona.email.toLowerCase();
    });

    if (!membership) {
      missing.push(persona);
      continue;
    }

    const user = users.find((u) => u.id === membership.user_id);
    const displayName =
      user?.nickname ||
      [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
      persona.label;

    resolved[persona.id] = {
      persona,
      userId: membership.user_id,
      displayName,
      membershipRole: membership.role,
    };
  }

  return { resolved, missing };
}
