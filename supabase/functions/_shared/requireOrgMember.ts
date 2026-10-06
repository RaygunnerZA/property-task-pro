import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "./cors.ts";

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Prove the caller JWT belongs to orgId before any service-role read.
 * Returns a Response to send, or null when membership is confirmed.
 */
export async function requireOrgMember(
  req: Request,
  orgId: string
): Promise<Response | null> {
  const header = req.headers.get("Authorization") ?? "";
  const jwt = header.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return json({ ok: false, error: "Unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) return json({ ok: false, error: "Server misconfigured" }, 503);

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser(jwt);
  if (userError || !userData.user) return json({ ok: false, error: "Unauthorized" }, 401);

  const { data: member, error: memberError } = await userClient
    .from("organisation_members")
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (memberError || !member) return json({ ok: false, error: "Forbidden" }, 403);
  return null;
}

export function isMissingRelation(err: unknown, relation: string): boolean {
  const message = err instanceof Error ? err.message : String(err ?? "");
  const code =
    typeof err === "object" && err && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  return code === "42P01" || code === "PGRST205" || message.includes(relation);
}
