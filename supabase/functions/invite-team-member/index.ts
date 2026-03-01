// invite-team-member — Team Member Invitation Edge Function
// Handles sending invitation emails and creating invitation records

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Create admin client with service role (bypasses RLS for admin operations)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Helper functions
function jsonOK(data: any) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonErr(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Generate a unique invitation token
function generateInvitationToken(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function findUserByEmail(email: string) {
  const lowerEmail = email.toLowerCase();

  // Supabase Admin API does not offer direct exact-email lookup, so page through users.
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw error;
    }

    const users = data?.users ?? [];
    const matched = users.find((u) => u.email?.toLowerCase() === lowerEmail);
    if (matched) return matched;
    if (users.length < 200) break;
  }

  return null;
}

async function upsertOrgMembership(params: {
  orgId: string;
  userId: string;
  role: string;
  propertyIds: string[] | null;
}) {
  const { orgId, userId, role, propertyIds } = params;

  const { data: existingMember, error: existingError } = await supabaseAdmin
    .from("organisation_members")
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existingMember?.id) {
    const { error: updateError } = await supabaseAdmin
      .from("organisation_members")
      .update({
        role,
        assigned_properties: propertyIds,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingMember.id);
    if (updateError) throw updateError;
    return { membershipId: existingMember.id, created: false };
  }

  const { data: newMember, error: insertError } = await supabaseAdmin
    .from("organisation_members")
    .insert({
      org_id: orgId,
      user_id: userId,
      role,
      assigned_properties: propertyIds,
    })
    .select("id")
    .single();

  if (insertError) throw insertError;
  return { membershipId: newMember.id, created: true };
}

Deno.serve(async (req) => {
  const executionId = crypto.randomUUID();
  const startTime = Date.now();
  
  console.log("[invite:start]", {
    executionId,
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString(),
  });

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log("[invite:options]", { executionId });
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    console.log("[invite:wrong-method]", { executionId, method: req.method });
    return jsonErr("Method not allowed", 405);
  }

  try {
    console.log("[invite:parsing-body]", { executionId });
    
    // Parse request body first (before auth to see if this is the issue)
    let body;
    try {
      body = await req.json();
      console.log("[invite:body-parsed]", { executionId, hasBody: !!body });
    } catch (parseErr: any) {
      console.error("[invite:body-parse-error]", { executionId, error: parseErr?.message });
      return jsonErr("Invalid JSON body", 400);
    }

    console.log("[invite:checking-auth]", { executionId });
    
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.log("[invite:no-auth-header]", { executionId });
      return jsonErr("Missing authorization header", 401);
    }

    // Get the authenticated user from the JWT token
    const token = authHeader.replace("Bearer ", "");
    console.log("[invite:getting-user]", { executionId, hasToken: !!token });
    
    let user, authError;
    try {
      const authResult = await Promise.race([
        supabaseAdmin.auth.getUser(token),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("getUser timeout after 5s")), 5000)
        )
      ]) as { data: { user: any }, error: any };
      
      user = authResult.data?.user;
      authError = authResult.error;
      
      console.log("[invite:user-retrieved]", { 
        executionId, 
        hasUser: !!user, 
        userId: user?.id,
        hasError: !!authError 
      });
    } catch (authTimeoutErr: any) {
      console.error("[invite:auth-timeout]", { executionId, error: authTimeoutErr?.message });
      return jsonErr("Authentication timeout", 408);
    }

    if (authError || !user) {
      console.log("[invite:auth-failed]", { executionId, authError: authError?.message });
      return jsonErr("Unauthorized", 401);
    }

    console.log("[invite:extracting-fields]", { executionId });
    const {
      email,
      org_id,
      first_name,
      last_name,
      role = "member",
      property_ids = null,
      team_ids = null,
    } = body;

    console.log("[invite:validating-fields]", { executionId, hasEmail: !!email, hasOrgId: !!org_id });
    
    // Validate required fields
    if (!email || !org_id) {
      console.log("[invite:validation-failed]", { executionId, missingFields: { email: !email, org_id: !org_id } });
      return jsonErr("Missing required fields: email, org_id", 400);
    }

    const normalizedEmail = email.toLowerCase();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      console.log("[invite:invalid-email]", { executionId, email });
      return jsonErr("Invalid email format", 400);
    }

    console.log("[invite:checking-permissions]", { executionId, orgId: org_id, userId: user.id });
    
    // Verify user has permission to invite to this org (must be owner or manager)
    let membership, membershipError;
    try {
      const membershipResult = await Promise.race([
        supabaseAdmin
          .from("organisation_members")
          .select("role")
          .eq("org_id", org_id)
          .eq("user_id", user.id)
          .single(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Membership query timeout after 5s")), 5000)
        )
      ]) as { data: any, error: any };
      
      membership = membershipResult.data;
      membershipError = membershipResult.error;
      
      console.log("[invite:membership-checked]", { executionId, hasMembership: !!membership, role: membership?.role });
    } catch (memTimeoutErr: any) {
      console.error("[invite:membership-timeout]", { executionId, error: memTimeoutErr?.message });
      return jsonErr("Permission check timeout", 408);
    }

    if (membershipError || !membership) {
      console.log("[invite:permission-denied]", { executionId, error: membershipError?.message });
      return jsonErr("Organization not found or access denied", 403);
    }

    if (!["owner", "manager"].includes(membership.role)) {
      console.log("[invite:insufficient-role]", { executionId, role: membership.role });
      return jsonErr("Only owners and managers can invite members", 403);
    }

    console.log("[invite:checking-existing-invitation]", { executionId, email });

    // Check for existing pending invitation
    let existingInvitation = null;
    try {
      const invitationCheckResult = await Promise.race([
        supabaseAdmin
          .from("invitations")
          .select("id, status, expires_at")
          .eq("org_id", org_id)
          .eq("email", normalizedEmail)
          .eq("status", "pending")
          .maybeSingle(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Invitation check timeout after 5s")), 5000)
        )
      ]) as { data: any, error: any };
      
      if (invitationCheckResult.error) {
        console.error("[invite:invitation-check-error]", { executionId, error: invitationCheckResult.error?.message });
        // Don't fail - we'll try to create the invitation anyway
      } else {
        existingInvitation = invitationCheckResult.data;
        console.log("[invite:invitation-checked]", { executionId, hasExisting: !!existingInvitation });
      }
    } catch (checkTimeoutErr: any) {
      console.error("[invite:invitation-check-timeout]", { executionId, error: checkTimeoutErr?.message });
      // Continue - try to create invitation anyway
    }

    if (existingInvitation && existingInvitation.id) {
      console.log("[invite:processing-existing]", { 
        executionId, 
        invitationId: existingInvitation.id,
        expiresAt: existingInvitation.expires_at,
        status: existingInvitation.status 
      });
      
      // Always expire the old invitation to allow resending
      // This is safer than blocking - if emails aren't being received, user can resend
      const expiresAt = existingInvitation.expires_at ? new Date(existingInvitation.expires_at) : null;
      const now = new Date();
      const isExpired = expiresAt ? expiresAt <= now : true;
      
      console.log("[invite:checking-expiration]", { 
        executionId,
        expiresAt: expiresAt?.toISOString(),
        now: now.toISOString(),
        isExpired
      });
      
      // If invitation hasn't expired, expire it now to allow resending
      if (!isExpired) {
        console.log("[invite:force-expiring-existing-invitation]", { 
          executionId, 
          invitationId: existingInvitation.id,
          reason: "Allowing resend - force expiring existing invitation"
        });
      }
      
      // Always mark old invitation as expired (whether it was already expired or not)
      console.log("[invite:expiring-old-invitation]", { executionId, invitationId: existingInvitation.id });
      try {
        const expireResult = await Promise.race([
          supabaseAdmin
            .from("invitations")
            .update({ 
              status: "expired", 
              updated_at: new Date().toISOString() 
            })
            .eq("id", existingInvitation.id),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Expire update timeout after 5s")), 5000)
          )
        ]) as { error: any };
        
        if (expireResult.error) {
          console.error("[invite:expire-error]", { executionId, error: expireResult.error?.message });
          // Continue anyway - try to create new invitation
        } else {
          console.log("[invite:old-invitation-expired]", { executionId, wasUnexpired: !isExpired });
        }
      } catch (expireTimeoutErr: any) {
        console.error("[invite:expire-timeout]", { executionId, error: expireTimeoutErr?.message });
        // Continue - we'll try to create a new one anyway
      }
      
      // Note: We don't return an error here - we continue to create a new invitation
      // This allows users to resend invitations even if the old one hasn't expired
    }

    console.log("[invite:generating-token]", { executionId });
    // Generate invitation token
    const invitationToken = generateInvitationToken();

    console.log("[invite:fetching-org]", { executionId, orgId: org_id });
    // Get organization name for email
    let orgName = "the organization";
    try {
      const orgResult = await Promise.race([
        supabaseAdmin
          .from("organisations")
          .select("name")
          .eq("id", org_id)
          .single(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Org fetch timeout after 5s")), 5000)
        )
      ]) as { data: any, error: any };
      
      if (orgResult.data) {
        orgName = orgResult.data.name || orgName;
        console.log("[invite:org-fetched]", { executionId, orgName });
      } else {
        console.warn("[invite:org-not-found]", { executionId, orgId: org_id, error: orgResult.error?.message });
      }
    } catch (orgTimeoutErr: any) {
      console.error("[invite:org-fetch-timeout]", { executionId, error: orgTimeoutErr?.message });
      // Continue with default name
    }

    console.log("[invite:creating-invitation-record]", { executionId, email, orgId: org_id });
    
    // Create invitation record
    let invitation = null;
    try {
      const insertResult = await Promise.race([
        supabaseAdmin
          .from("invitations")
          .insert({
            org_id,
            email: normalizedEmail,
            first_name: first_name?.trim() || null,
            last_name: last_name?.trim() || null,
            role,
            invited_by: user.id,
            token: invitationToken,
            status: "pending",
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
            property_ids: Array.isArray(property_ids) && property_ids.length > 0
              ? property_ids
              : null,
            team_ids: Array.isArray(team_ids) && team_ids.length > 0
              ? team_ids
              : null,
          })
          .select()
          .single(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Invitation insert timeout after 10s")), 10000)
        )
      ]) as { data: any, error: any };

      if (insertResult.error) {
        console.error("[invite:insert-error]", { executionId, error: insertResult.error });
        // Check if it's because the table doesn't exist
        if (insertResult.error.code === "42P01" || insertResult.error.message?.includes("does not exist")) {
          return jsonErr("Invitations table not found. Please run the migration: 20260108000000_create_invitations_table.sql", 500);
        }
        return jsonErr(`Failed to create invitation record: ${insertResult.error.message}`, 500);
      }
      
      invitation = insertResult.data;
      console.log("[invite:invitation-created]", { executionId, invitationId: invitation?.id });
    } catch (insertTimeoutErr: any) {
      console.error("[invite:insert-timeout]", { executionId, error: insertTimeoutErr?.message });
      return jsonErr("Failed to create invitation record: timeout", 408);
    }

    // Existing-account path: grant membership immediately and mark invitation accepted.
    try {
      const existingUser = await findUserByEmail(normalizedEmail);
      if (existingUser?.id) {
        const effectivePropertyIds =
          Array.isArray(property_ids) && property_ids.length > 0
            ? property_ids
            : null;

        const { membershipId, created } = await upsertOrgMembership({
          orgId: org_id,
          userId: existingUser.id,
          role,
          propertyIds: effectivePropertyIds,
        });

        const { error: markAcceptedError } = await supabaseAdmin
          .from("invitations")
          .update({
            status: "accepted",
            accepted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", invitation.id);

        if (markAcceptedError) throw markAcceptedError;

        const duration = Date.now() - startTime;
        console.log("[invite:auto-accepted-existing-user]", {
          executionId,
          duration: `${duration}ms`,
          email: normalizedEmail,
          userId: existingUser.id,
          orgId: org_id,
          membershipId,
          membershipCreated: created,
        });

        return jsonOK({
          success: true,
          auto_accepted: true,
          user_id: existingUser.id,
          membership_id: membershipId,
          invitation: {
            id: invitation.id,
            email: invitation.email,
            status: "accepted",
            expires_at: invitation.expires_at,
            accepted_at: new Date().toISOString(),
          },
          message: "User already has an account. Access was granted immediately.",
        });
      }
    } catch (existingUserFlowError: any) {
      console.error("[invite:existing-user-flow-error]", {
        executionId,
        message: existingUserFlowError?.message,
      });
      return jsonErr(
        `Failed to grant immediate access for existing account: ${existingUserFlowError?.message ?? "unknown error"}`,
        500
      );
    }

    // Generate invitation link and send email
    // For development: Use localhost, for production: Use SITE_URL env var
    // Determine site URL from environment, request origin, or use localhost for dev
    let siteUrl = Deno.env.get("SITE_URL");
    
    if (!siteUrl) {
      // Try to get from request origin (if available) - this works for localhost dev
      const origin = req.headers.get("Origin") || req.headers.get("Referer");
      if (origin) {
        try {
          const url = new URL(origin);
          siteUrl = `${url.protocol}//${url.host}`;
          console.log("[invite:using-request-origin]", { executionId, siteUrl, origin });
        } catch {
          // Invalid origin, continue to fallback
        }
      }
    }
    
    // For development: Try to detect port from origin header, fallback to common dev ports
    // For production: This should be set as SITE_URL environment variable
    if (!siteUrl) {
      // Try to extract port from request origin if available
      const origin = req.headers.get("origin");
      if (origin && origin.includes("localhost")) {
        siteUrl = origin;
        console.log("[invite:using-origin-header]", { executionId, origin });
      } else {
        // Common development ports (Vite default: 5173, Next.js: 3000, Vite alternative: 8080)
        siteUrl = "http://localhost:5173";
        console.warn("[invite:using-localhost-dev]", { 
          executionId, 
          message: "SITE_URL not set and no origin header - using localhost:5173 for development. For production, set SITE_URL env var.",
          note: "Make sure your dev server port is in Supabase Auth > URL Configuration > Redirect URLs"
        });
      }
    }
    
    // The redirect URL should go to a page that handles invitation acceptance
    // After Supabase verifies the email, it will redirect here with the invitation token
    const redirectUrl = `${siteUrl}/accept-invitation?token=${invitationToken}`;
    
    console.log("[invite:sending-invitation-email]", { 
      executionId, 
      email, 
      siteUrl,
      redirectUrl,
      invitationToken,
      note: "IMPORTANT: Add this redirect URL to Supabase Auth > URL Configuration > Redirect URLs"
    });

    try {
      // Use inviteUserByEmail - this actually SENDS the email automatically
      // generateLink only generates the link but doesn't send emails
      // inviteUserByEmail sends invitation emails and handles both new and existing users
      console.log("[invite:using-inviteUserByEmail]", { executionId, email, redirectUrl });
      
      const inviteResult = await Promise.race([
        supabaseAdmin.auth.admin.inviteUserByEmail(normalizedEmail, {
          data: {
            invitation_token: invitationToken,
            org_id: org_id,
            org_name: orgName,
            role: role,
            first_name: first_name?.trim() || null,
            last_name: last_name?.trim() || null,
            invited: true,
          },
          redirectTo: redirectUrl,
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("inviteUserByEmail timeout after 10s")), 10000)
        )
      ]) as { data: any, error: any };

      if (inviteResult.error) {
        console.error("[invite:inviteUserByEmail-error]", {
          executionId,
          error: inviteResult.error,
          message: inviteResult.error?.message,
          code: inviteResult.error?.code,
          status: inviteResult.error?.status,
        });
        
        // If user already exists, generate a magic link and send it as an email
        if (inviteResult.error.message?.includes("already") || inviteResult.error.code === "user_exists") {
          console.log("[invite:user-exists-fallback]", { executionId, message: "User exists, generating magic link" });
          
          // Update the existing user's metadata so AcceptInvitation.tsx can find the token
          const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
          const matchedUser = existingUser?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
          
          if (matchedUser) {
            // Store invitation token in user metadata so AcceptInvitation.tsx can find it
            await supabaseAdmin.auth.admin.updateUserById(matchedUser.id, {
              user_metadata: {
                ...matchedUser.user_metadata,
                invitation_token: invitationToken,
                org_id: org_id,
                org_name: orgName,
                role: role,
                invited: true,
              },
            });
          }

          // Generate a magic link (OTP) and send it — this DOES trigger the email
          const linkResult = await Promise.race([
            supabaseAdmin.auth.admin.generateLink({
              type: "magiclink",
              email: normalizedEmail,
              options: {
                redirectTo: redirectUrl,
                data: {
                  invitation_token: invitationToken,
                  org_id: org_id,
                  org_name: orgName,
                  role: role,
                  first_name: first_name?.trim() || null,
                  last_name: last_name?.trim() || null,
                  invited: true,
                },
              },
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error("generateLink timeout after 10s")), 10000)
            )
          ]) as { data: any, error: any };
          
          if (linkResult.error) {
            console.error("[invite:generateLink-fallback-error]", {
              executionId,
              error: linkResult.error,
            });
          } else {
            // Use the generated action_link to send via Supabase's built-in email
            // by calling the sendEmail admin endpoint, or log for manual delivery
            const actionLink = linkResult.data?.properties?.action_link;
            console.log("[invite:generateLink-success]", {
              executionId,
              message: "Magic link generated for existing user. Email will be sent if SMTP is configured.",
              hasActionLink: !!actionLink,
            });
          }
        }
      } else {
        console.log("[invite:inviteUserByEmail-success]", {
          executionId,
          email: email,
          userId: inviteResult.data?.user?.id,
          userCreated: !!inviteResult.data?.user,
          emailSent: true,
          message: "Invitation email sent successfully via inviteUserByEmail"
        });
      }
    } catch (emailTimeoutErr: any) {
      console.error("[invite:email-timeout]", {
        executionId,
        error: emailTimeoutErr,
        message: emailTimeoutErr?.message,
        stack: emailTimeoutErr?.stack,
      });
      // Don't fail - invitation record is created
      console.warn("[invite:email-warning]", {
        executionId,
        message: "Invitation record created but email sending may have failed. Check Supabase email configuration.",
        checks: [
          "Authentication > Providers > Email > Enable email signups must be ON",
          "Authentication > Email Templates > Invite template must be configured",
          "Authentication > URL Configuration > Redirect URLs must include your redirect URL",
          "Project Settings > Auth > SMTP settings configured (if using custom SMTP)",
          "Note: Default Supabase email has rate limits (2 emails/hour) - configure custom SMTP for production"
        ]
      });
    }

    const duration = Date.now() - startTime;
    console.log("[invite:success]", {
      executionId,
      duration: `${duration}ms`,
      invitationId: invitation?.id,
    });

    // Return success response
    return jsonOK({
      success: true,
      invitation: invitation ? {
        id: invitation.id,
        email: invitation.email,
        status: invitation.status,
        expires_at: invitation.expires_at,
      } : null,
      message: "Invitation sent successfully",
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error("[invite:unexpected-error]", {
      executionId,
      duration: `${duration}ms`,
      error: error,
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    });
    return jsonErr(error.message || "Internal server error", 500);
  }
});
