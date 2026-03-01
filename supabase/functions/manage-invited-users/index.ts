import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") ?? "http://localhost:5173";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generateInvitationToken(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function findUserByEmail(email: string) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const users = data?.users ?? [];
    const hit = users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return hit;
    if (users.length < 200) break;
  }
  return null;
}

async function ensureManagerOrOwner(orgId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("organisation_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data || !["owner", "manager"].includes(data.role)) {
    throw new Error("Only owners and managers can perform this action");
  }
}

async function upsertOrgMembership(params: {
  orgId: string;
  userId: string;
  role: string;
  propertyIds: string[] | null;
}) {
  const { orgId, userId, role, propertyIds } = params;
  const now = new Date().toISOString();

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("organisation_members")
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing?.id) {
    const { error: updateError } = await supabaseAdmin
      .from("organisation_members")
      .update({
        role,
        assigned_properties: propertyIds,
        updated_at: now,
      })
      .eq("id", existing.id);
    if (updateError) throw updateError;
    return { membershipId: existing.id, created: false };
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("organisation_members")
    .insert({
      org_id: orgId,
      user_id: userId,
      role,
      assigned_properties: propertyIds,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (insertError) throw insertError;
  return { membershipId: inserted.id, created: true };
}

async function markInvitationAccepted(invitationId: string) {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("invitations")
    .update({
      status: "accepted",
      accepted_at: now,
      updated_at: now,
    })
    .eq("id", invitationId);

  if (error) throw error;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return err("Method not allowed", 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return err("Missing authorization header", 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(
      token
    );
    if (authError || !authData?.user) return err("Unauthorized", 401);
    const actor = authData.user;

    const body = await req.json();
    const action = body?.action as string | undefined;
    const invitationId = body?.invitation_id as string | undefined;
    const newPassword = body?.new_password as string | undefined;

    if (!action) return err("Missing action", 400);
    if (!invitationId) return err("Missing invitation_id", 400);

    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from("invitations")
      .select(
        "id, org_id, email, first_name, last_name, role, property_ids, status, expires_at"
      )
      .eq("id", invitationId)
      .maybeSingle();

    if (invitationError) return err(invitationError.message, 500);
    if (!invitation) return err("Invitation not found", 404);

    await ensureManagerOrOwner(invitation.org_id, actor.id);

    if (action === "cancel_invite") {
      const { error: cancelError } = await supabaseAdmin
        .from("invitations")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", invitation.id);
      if (cancelError) return err(cancelError.message, 500);
      return ok({ success: true });
    }

    if (action === "resend_invite") {
      const existingUser = await findUserByEmail(invitation.email);

      if (existingUser?.id) {
        const propertyIds =
          Array.isArray(invitation.property_ids) && invitation.property_ids.length > 0
            ? invitation.property_ids
            : null;
        const upsert = await upsertOrgMembership({
          orgId: invitation.org_id,
          userId: existingUser.id,
          role: invitation.role ?? "member",
          propertyIds,
        });
        await markInvitationAccepted(invitation.id);
        return ok({
          success: true,
          auto_accepted: true,
          user_id: existingUser.id,
          membership_id: upsert.membershipId,
        });
      }

      const tokenValue = generateInvitationToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { error: updateInvitationError } = await supabaseAdmin
        .from("invitations")
        .update({
          token: tokenValue,
          status: "pending",
          accepted_at: null,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", invitation.id);
      if (updateInvitationError) return err(updateInvitationError.message, 500);

      const { data: orgData } = await supabaseAdmin
        .from("organisations")
        .select("name")
        .eq("id", invitation.org_id)
        .maybeSingle();
      const orgName = orgData?.name ?? "the organization";

      const redirectTo = `${SITE_URL}/accept-invitation?token=${tokenValue}`;
      const inviteEmail = invitation.email.toLowerCase();

      const inviteResult = await supabaseAdmin.auth.admin.inviteUserByEmail(
        inviteEmail,
        {
          data: {
            invitation_token: tokenValue,
            org_id: invitation.org_id,
            org_name: orgName,
            role: invitation.role,
            first_name: invitation.first_name,
            last_name: invitation.last_name,
            invited: true,
          },
          redirectTo,
        }
      );

      if (inviteResult.error) {
        return err(`Failed to resend invitation: ${inviteResult.error.message}`, 500);
      }

      return ok({ success: true });
    }

    if (action === "send_password_reset") {
      const existingUser = await findUserByEmail(invitation.email);
      if (!existingUser) return err("User account does not exist yet", 400);

      const resetResult = await supabaseAdmin.auth.resetPasswordForEmail(
        invitation.email.toLowerCase(),
        { redirectTo: `${SITE_URL}/login` }
      );

      if (resetResult.error) {
        return err(`Failed to send password reset: ${resetResult.error.message}`, 500);
      }

      return ok({ success: true });
    }

    if (action === "set_password_manual") {
      if (!newPassword || newPassword.length < 8) {
        return err("new_password must be at least 8 characters", 400);
      }

      const normalizedEmail = invitation.email.toLowerCase();
      let user = await findUserByEmail(normalizedEmail);

      if (user?.id) {
        const updateResult = await supabaseAdmin.auth.admin.updateUserById(user.id, {
          password: newPassword,
        });
        if (updateResult.error) {
          return err(`Failed to update password: ${updateResult.error.message}`, 500);
        }
      } else {
        const createResult = await supabaseAdmin.auth.admin.createUser({
          email: normalizedEmail,
          password: newPassword,
          email_confirm: true,
          user_metadata: {
            first_name: invitation.first_name,
            last_name: invitation.last_name,
            invited: true,
          },
        });
        if (createResult.error || !createResult.data.user) {
          return err(
            `Failed to create account: ${createResult.error?.message ?? "unknown error"}`,
            500
          );
        }
        user = createResult.data.user;
      }

      const propertyIds =
        Array.isArray(invitation.property_ids) && invitation.property_ids.length > 0
          ? invitation.property_ids
          : null;

      const upsert = await upsertOrgMembership({
        orgId: invitation.org_id,
        userId: user.id,
        role: invitation.role ?? "member",
        propertyIds,
      });

      await markInvitationAccepted(invitation.id);

      return ok({
        success: true,
        user_id: user.id,
        membership_id: upsert.membershipId,
        auto_accepted: true,
      });
    }

    return err("Unsupported action", 400);
  } catch (e: any) {
    return err(e?.message ?? "Internal server error", 500);
  }
});
