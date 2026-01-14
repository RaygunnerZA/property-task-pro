import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingContainer } from "@/components/onboarding/OnboardingContainer";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";
import { NeomorphicPasswordInput } from "@/components/onboarding/NeomorphicPasswordInput";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Lock } from "lucide-react";
import { useActiveOrg } from "@/hooks/useActiveOrg";

export default function AcceptInvitation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const invitationToken = searchParams.get("token");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"loading" | "password" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [settingPassword, setSettingPassword] = useState(false);
  const { orgId } = useActiveOrg();

  useEffect(() => {
    const acceptInvitation = async () => {
      // Check if we're in a redirect loop - if we just came from login, don't redirect back
      const fromLogin = document.referrer.includes("/login") || sessionStorage.getItem("accept_invitation_from_login") === "true";
      if (fromLogin) {
        sessionStorage.removeItem("accept_invitation_from_login");
      }
      
      // Check for various URL parameters that Supabase might include
      const urlToken = searchParams.get("token"); // Our custom invitation token
      const accessToken = searchParams.get("access_token"); // Supabase auth token
      const type = searchParams.get("type"); // invite, magiclink, etc.
      const hash = searchParams.get("#"); // Some Supabase redirects use hash fragments
      
      // Get token to use (from URL or sessionStorage for expired links)
      const tokenToUse = invitationToken || urlToken || sessionStorage.getItem("pending_invitation_token");
      
      console.log("AcceptInvitation page loaded", { 
        invitationToken: urlToken || invitationToken,
        accessToken,
        type,
        hash,
        allParams: Object.fromEntries(searchParams.entries()),
        windowLocation: window.location.href,
      });

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AcceptInvitation.tsx:42',message:'URL inspection - checking for hash tokens',data:{fullUrl:window.location.href,hash:window.location.hash,hashLength:window.location.hash?.length,pathname:window.location.pathname,search:window.location.search,hasHash:!!window.location.hash},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      
      // Check URL hash for access_token (Supabase puts auth tokens in hash fragments)
      let hashAccessToken = null;
      let hashRefreshToken = null;
      let hashType = null;
      let hashError = null;
      let hashErrorCode = null;
      let hashErrorDescription = null;
      if (window.location.hash) {
        try {
          const hashString = window.location.hash.substring(1);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AcceptInvitation.tsx:50',message:'Parsing hash string',data:{hashString,hashStringLength:hashString.length,startsWithHash:hashString.startsWith('#')},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          
          const hashParams = new URLSearchParams(hashString);
          hashAccessToken = hashParams.get("access_token");
          hashRefreshToken = hashParams.get("refresh_token");
          hashType = hashParams.get("type");
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AcceptInvitation.tsx:57',message:'Hash params extracted',data:{hashAccessToken:!!hashAccessToken,hashAccessTokenLength:hashAccessToken?.length,hashRefreshToken:!!hashRefreshToken,hashType,allHashParams:Object.fromEntries(hashParams.entries())},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          
          console.log("Found hash tokens", { hashAccessToken: !!hashAccessToken, hashType });
          
          // Check if hash contains an error (e.g., expired link)
          hashError = hashParams.get("error");
          hashErrorCode = hashParams.get("error_code");
          hashErrorDescription = hashParams.get("error_description");
          
          if (hashError) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AcceptInvitation.tsx:65',message:'Hash contains error - link expired or invalid',data:{hashError,hashErrorCode,hashErrorDescription,hasToken:!!tokenToUse},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            
            console.warn("Supabase link error in hash:", { error: hashError, code: hashErrorCode, description: hashErrorDescription });
            
            // If the link expired but we have a token, we can still find the invitation
            // The user will need to sign in or set a password, but we can proceed with token lookup
            if (hashErrorCode === "otp_expired" && tokenToUse) {
              console.log("Link expired but we have invitation token - will proceed with token lookup");
              // Clear the error hash from URL
              window.history.replaceState({}, '', window.location.pathname + window.location.search);
              // Continue - we'll find invitation by token and handle auth separately
            } else {
              // Other error - show message
              setStatus("error");
              setMessage(hashErrorDescription || "The invitation link has expired or is invalid. Please ask for a new invitation.");
              setLoading(false);
              return;
            }
          } else if (hashAccessToken && hashType === "invite") {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AcceptInvitation.tsx:85',message:'Before setSession call',data:{hasAccessToken:!!hashAccessToken,hasRefreshToken:!!hashRefreshToken,hashType},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            
            console.log("Setting session from hash token...");
            try {
              const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                access_token: hashAccessToken,
                refresh_token: hashRefreshToken || "",
              });
              
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AcceptInvitation.tsx:95',message:'After setSession call',data:{sessionError:!!sessionError,errorCode:sessionError?.code,errorMessage:sessionError?.message,hasSession:!!sessionData?.session,hasUser:!!sessionData?.user},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'E'})}).catch(()=>{});
              // #endregion
              
              if (sessionError) {
                console.error("Error setting session from hash:", sessionError);
              } else if (sessionData?.session) {
                console.log("Session established from hash token");
                // Clear the hash from URL
                window.history.replaceState({}, '', window.location.pathname + window.location.search);
              }
            } catch (err) {
              console.error("Exception setting session from hash:", err);
            }
          } else if (hashAccessToken) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AcceptInvitation.tsx:110',message:'Hash token found but type mismatch',data:{hashAccessToken:!!hashAccessToken,hashType,expectedType:'invite'},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            console.warn("Hash token found but type is not 'invite':", hashType);
          }
        } catch (err) {
          console.error("Error parsing hash:", err);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AcceptInvitation.tsx:93',message:'Error parsing hash',data:{error:err?.message,hash:window.location.hash},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
        }
      } else {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AcceptInvitation.tsx:97',message:'No hash found in URL',data:{fullUrl:window.location.href},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
      }

      // If there's an access_token in query params, try to use it
      if (accessToken && type === "invite") {
        console.log("Setting session from query access_token...");
        try {
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: "",
          });
          
          if (sessionError) {
            console.error("Error setting session from query token:", sessionError);
          } else if (sessionData?.session) {
            console.log("Session established from query token");
          }
        } catch (err) {
          console.error("Exception setting session from query token:", err);
        }
      }
      
      // Wait a moment for session to be established
      await new Promise(resolve => setTimeout(resolve, 1000));

      // tokenToUse is already defined earlier in the function

      try {
        // Get current user - check if they're authenticated
        let { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          // User not authenticated - check if we just tried to set session from hash
          // If we have hash tokens, we already tried to establish session above
          // Don't redirect immediately - give it one more check
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (retrySession?.user) {
            // Session was established, continue with that user
            user = retrySession.user;
            console.log("User authenticated after session check");
            userError = null; // Clear error since we have a user now
          } else {
            // Still not authenticated - check if there's a token to look up invitation
            console.log("User not authenticated yet", { error: userError?.message });
            
            // If we have a token, try to find the invitation even without authentication
            // This allows us to show helpful messages even if the Supabase link expired
            if (tokenToUse) {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AcceptInvitation.tsx:179',message:'User not authenticated - trying token lookup',data:{tokenToUse,hasHashError:!!hashError},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'E'})}).catch(()=>{});
              // #endregion
              
              try {
                // Try to find invitation by token (public RLS policy allows this)
                const { data: invitationByToken, error: tokenError } = await supabase
                  .from("invitations")
                  .select("*")
                  .eq("token", tokenToUse)
                  .eq("status", "pending")
                  .maybeSingle();
                
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AcceptInvitation.tsx:189',message:'Token lookup result',data:{found:!!invitationByToken,errorCode:tokenError?.code,errorMessage:tokenError?.message,hasHashError:!!hashError},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'E'})}).catch(()=>{});
                // #endregion
                
                if (invitationByToken && !tokenError) {
                  // Found invitation - the link expired but invitation is still valid
                  // If we just came from login, don't redirect again - show message instead
                  if (fromLogin) {
                    setStatus("error");
                    setMessage("Please sign in above to accept the invitation. Your invitation is still valid.");
                    setLoading(false);
                    return;
                  }
                  
                  // Ask user to sign in to accept it
                  if (hashErrorCode === "otp_expired") {
                    setStatus("error");
                    setMessage("The invitation link has expired, but your invitation is still valid. Please sign in to accept it.");
                    // Store the token so we can use it after they sign in
                    sessionStorage.setItem("pending_invitation_token", tokenToUse);
                    sessionStorage.setItem("accept_invitation_from_login", "true");
                    toast.info("Please sign in to accept the invitation");
                    navigate(`/login?invite_token=${tokenToUse}`, { replace: true });
                  } else {
                    // Other error or no hash error - just ask to sign in
                    sessionStorage.setItem("pending_invitation_token", tokenToUse);
                    sessionStorage.setItem("accept_invitation_from_login", "true");
                    toast.info("Please sign in to accept the invitation");
                    navigate(`/login?invite_token=${tokenToUse}`, { replace: true });
                  }
                  setLoading(false);
                  return;
                } else if (tokenError) {
                  console.error("Error finding invitation by token:", tokenError);
                  // If we just came from login, don't redirect again
                  if (fromLogin) {
                    setStatus("error");
                    setMessage("Unable to find your invitation. Please contact the person who invited you.");
                    setLoading(false);
                    return;
                  }
                  // RLS error or other issue - still redirect to login
                  sessionStorage.setItem("pending_invitation_token", tokenToUse);
                  sessionStorage.setItem("accept_invitation_from_login", "true");
                  toast.info("Please sign in to accept the invitation");
                  navigate(`/login?invite_token=${tokenToUse}`, { replace: true });
                  setLoading(false);
                  return;
                }
              } catch (err) {
                console.error("Exception looking up invitation:", err);
                // Fall through to redirect
              }
            }
            
            // No token or token lookup failed - redirect to login (but prevent loop)
            if (fromLogin) {
              // We just came from login - show message instead of redirecting again
              setStatus("error");
              setMessage("Please sign in above to accept the invitation.");
              setLoading(false);
              return;
            }
            
            if (hashAccessToken || accessToken) {
              // User was invited but session didn't establish - show password setup
              setNeedsPassword(true);
              setStatus("password");
              setMessage("Set a password to complete your account setup and accept the invitation");
              setLoading(false);
              return;
            }
            
            // No access token - redirect to login (but prevent loop by checking if we're already redirecting)
            if (!window.location.search.includes("invite_token") && tokenToUse) {
              sessionStorage.setItem("accept_invitation_from_login", "true");
              toast.info("Please sign in to accept the invitation");
              navigate(`/login?invite_token=${tokenToUse}`, { replace: true });
            } else if (!window.location.search.includes("invite_token")) {
              sessionStorage.setItem("accept_invitation_from_login", "true");
              toast.info("Please sign in to accept the invitation");
              navigate("/login", { replace: true });
            }
            setLoading(false);
            return;
          }
        }
        
        // Check if user needs to set password
        // inviteUserByEmail creates users without passwords - they need to set one
        // Check if user has an email identity (invited users will have this)
        const hasEmailIdentity = user.identities?.some(id => id.provider === "email");
        // Check if they can sign in with password (if they have a password set)
        // For invited users without password, they might not be able to sign in with password yet
        
        console.log("User identity check:", { 
          hasEmailIdentity, 
          identities: user.identities,
          emailConfirmed: user.email_confirmed_at,
          userCreatedAt: user.created_at
        });
        
        // If user was just created via invitation (has email identity, email confirmed)
        // They might need to set a password, but let's first try to find the invitation
        // We'll check if they need password after finding the invitation
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AcceptInvitation.tsx:116',message:'User authenticated - checking auth state',data:{userId:user.id,userEmail:user.email,emailConfirmed:user.email_confirmed_at,hasSession:true,identities:user.identities?.map(i=>({provider:i.provider,id:i.id}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        
        console.log("User authenticated:", { userId: user.id, email: user.email });

        console.log("Processing invitation acceptance for user:", { 
          userId: user.id, 
          email: user.email, 
          urlToken: tokenToUse,
          metadata: user.user_metadata,
          appMetadata: user.app_metadata
        });

        // Try multiple approaches to find the invitation:
        // 1. By token from URL (if present)
        // 2. By token from user metadata (stored by Supabase)
        // 3. By email (for pending invitations for this user's email)
        let invitation = null;
        let inviteError = null;

        // First, try to get invitation token from user metadata (stored by generateLink/inviteUserByEmail)
        const metadataToken = user.user_metadata?.invitation_token || user.app_metadata?.invitation_token;
        const lookupToken = tokenToUse || metadataToken;

        console.log("Looking up invitation with:", { 
          urlToken: tokenToUse, 
          metadataToken,
          usingToken: lookupToken,
          userEmail: user.email 
        });

        if (lookupToken) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AcceptInvitation.tsx:147',message:'Before token query',data:{lookupToken,hasToken:!!lookupToken},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          
          // Try to find by token first
          // Don't join organisations - user isn't a member yet, so RLS would block it
          const { data: invitationByToken, error: tokenError } = await supabase
            .from("invitations")
            .select("*")
            .eq("token", lookupToken)
            .eq("status", "pending")
            .maybeSingle();

          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AcceptInvitation.tsx:156',message:'After token query',data:{found:!!invitationByToken,errorCode:tokenError?.code,errorMessage:tokenError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion

          if (!tokenError && invitationByToken) {
            invitation = invitationByToken;
            console.log("Found invitation by token:", invitation.id);
            // Don't fetch organisation name - user isn't a member yet, so RLS blocks it
            // We'll use a placeholder name or fetch after they're added as a member
          } else if (tokenError) {
            console.error("Error finding invitation by token:", tokenError);
            inviteError = tokenError;
          }
        }

        // If not found by token, try by email (user's email must match invitation email)
        // This is important because Supabase redirects might not preserve query params
        // Don't join organisations - user isn't a member yet, so RLS would block it
        if (!invitation && user.email) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AcceptInvitation.tsx:200',message:'Before email query - checking user email',data:{userEmail:user.email,userEmailLower:user.email?.toLowerCase(),userId:user.id,emailConfirmed:user.email_confirmed_at},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          
          console.log("Trying to find invitation by email:", user.email);
          const { data: invitationByEmail, error: emailError } = await supabase
            .from("invitations")
            .select("*")
            .eq("email", user.email.toLowerCase())
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AcceptInvitation.tsx:215',message:'After email query - result',data:{found:!!invitationByEmail,errorCode:emailError?.code,errorMessage:emailError?.message,errorDetails:emailError?.details,errorHint:emailError?.hint,queryEmail:user.email.toLowerCase()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C'})}).catch(()=>{});
          // #endregion

          if (!emailError && invitationByEmail) {
            invitation = invitationByEmail;
            console.log("Found invitation by email:", invitation.id);
            // Don't fetch organisation name - user isn't a member yet, so RLS blocks it
            // We'll use a placeholder name or fetch after they're added as a member
            
            // Update the URL to include the token for better UX
            if (invitation.token && !tokenToUse) {
              window.history.replaceState({}, '', `/accept-invitation?token=${invitation.token}`);
            }
            inviteError = null;
          } else if (emailError) {
            console.error("Error finding invitation by email:", emailError);
            // Log RLS policy issues
            if (emailError.code === '42501' || emailError.message?.includes('permission denied') || emailError.code === 'PGRST301') {
              console.error("RLS policy error - user might not have permission to view invitations");
              console.error("Make sure the RLS policy 'Users can view their own pending invitations' is applied");
            }
            if (!inviteError) {
              inviteError = emailError;
            }
          } else {
            console.log("No pending invitation found for email:", user.email);
          }
        }

        if (inviteError) {
          console.error("Error fetching invitation:", inviteError);
          setStatus("error");
          setMessage("Failed to find invitation. Please contact the person who invited you.");
          setLoading(false);
          return;
        }

        if (!invitation) {
          console.error("No invitation found", { 
            hasUrlToken: !!invitationToken, 
            hasMetadataToken: !!metadataToken,
            userEmail: user.email 
          });
          setStatus("error");
          setMessage("Invitation not found or already used. It may have expired. Please ask the person who invited you to resend the invitation.");
          setLoading(false);
          return;
        }

        console.log("Found invitation:", { 
          invitationId: invitation.id, 
          invitationEmail: invitation.email,
          userEmail: user.email,
          orgId: invitation.org_id 
        });
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AcceptInvitation.tsx:448',message:'Invitation found - proceeding to accept',data:{invitationId:invitation.id,invitationEmail:invitation.email,userEmail:user.email,orgId:invitation.org_id,role:invitation.role,status:invitation.status,expiresAt:invitation.expires_at},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'F'})}).catch(()=>{});
        // #endregion

        // Check if invitation has expired
        if (new Date(invitation.expires_at) < new Date()) {
          setStatus("error");
          setMessage("This invitation has expired. Please ask for a new invitation.");
          setLoading(false);
          return;
        }

        // Check if user needs to set password before accepting invitation
        // For invited users, they might not have a password set yet
        // Try to sign in with a test password to see if password is set
        // Actually, better approach: check if they can update password (which requires current password if set)
        // If they can't update without current password, they might need to set initial password
        // But actually, updateUser({ password }) should work even if they don't have a password yet
        
        // For now, let's assume if they're authenticated, they can set a password
        // We'll show password setup if they try to continue without one

        // Check if user is already a member of this organization
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AcceptInvitation.tsx:469',message:'Checking if user already member',data:{userId:user.id,orgId:invitation.org_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'F'})}).catch(()=>{});
        // #endregion
        
        const { data: existingMember, error: checkError } = await supabase
          .from("organisation_members")
          .select("id")
          .eq("org_id", invitation.org_id)
          .eq("user_id", user.id)
          .maybeSingle();

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AcceptInvitation.tsx:477',message:'Existing member check result',data:{isMember:!!existingMember,memberId:existingMember?.id,checkError:!!checkError,checkErrorCode:checkError?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'F'})}).catch(()=>{});
        // #endregion

        if (existingMember) {
          // Already a member - just mark invitation as accepted
          await supabase
            .from("invitations")
            .update({ 
              status: "accepted", 
              accepted_at: new Date().toISOString() 
            })
            .eq("id", invitation.id);
          
          // Try to fetch org name now that user is a member (RLS should allow it)
          const { data: orgData } = await supabase
            .from("organisations")
            .select("name")
            .eq("id", invitation.org_id)
            .maybeSingle();
          
          const orgName = orgData?.name || "the organization";
          setStatus("success");
          setMessage(`You're already a member of ${orgName}!`);
          setTimeout(() => navigate("/work/tasks"), 2000);
          setLoading(false);
          return;
        }

        // Add user to the organization
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AcceptInvitation.tsx:501',message:'Before adding user to organisation',data:{userId:user.id,userEmail:user.email,orgId:invitation.org_id,role:invitation.role||'member',invitationId:invitation.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'F'})}).catch(()=>{});
        // #endregion
        
        const { data: memberData, error: memberError } = await supabase
          .from("organisation_members")
          .insert({
            org_id: invitation.org_id,
            user_id: user.id,
            role: invitation.role || "member",
          })
          .select();

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AcceptInvitation.tsx:512',message:'After adding user to organisation',data:{success:!memberError,errorCode:memberError?.code,errorMessage:memberError?.message,errorDetails:memberError?.details,errorHint:memberError?.hint,memberData:!!memberData,memberId:memberData?.[0]?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'F'})}).catch(()=>{});
        // #endregion

        if (memberError) {
          console.error("Error adding member:", memberError);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AcceptInvitation.tsx:520',message:'Member insert failed - showing error',data:{errorCode:memberError.code,errorMessage:memberError.message,errorDetails:memberError.details,errorHint:memberError.hint},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'F'})}).catch(()=>{});
          // #endregion
          setStatus("error");
          setMessage("Failed to join organization. Please try again or contact support.");
          setLoading(false);
          return;
        }

        // Mark invitation as accepted
        await supabase
          .from("invitations")
          .update({ 
            status: "accepted", 
            accepted_at: new Date().toISOString() 
          })
          .eq("id", invitation.id);

        // Now that user is a member, try to fetch org name (RLS should allow it)
        const { data: orgData } = await supabase
          .from("organisations")
          .select("name")
          .eq("id", invitation.org_id)
          .maybeSingle();
        
        const orgName = orgData?.name || "the organization";
        setStatus("success");
        setMessage(`Successfully joined ${orgName}!`);
        toast.success("Welcome to the team!");
        
        // Redirect to tasks after a short delay
        setTimeout(() => navigate("/work/tasks"), 2000);
        setLoading(false);
      } catch (error: any) {
        console.error("Error accepting invitation:", error);
        setStatus("error");
        setMessage(error.message || "An unexpected error occurred. Please try again.");
        setLoading(false);
      }
    };

    // Only run invitation acceptance if not setting password
    if (status !== "password") {
      acceptInvitation();
    }
  }, [invitationToken, navigate, searchParams, status]);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    if (!password || password.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }

    setSettingPassword(true);
    try {
      // Update user password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setPasswordError(updateError.message || "Failed to set password");
        setSettingPassword(false);
        return;
      }

      toast.success("Password set successfully!");
      
      // After password is set, continue with invitation acceptance
      setNeedsPassword(false);
      setStatus("loading");
      setLoading(true);
      
      // Reload to re-run invitation acceptance flow
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error: any) {
      console.error("Error setting password:", error);
      setPasswordError(error.message || "Failed to set password");
      setSettingPassword(false);
    }
  };

  return (
    <OnboardingContainer>
      <div className="animate-fade-in">
        <OnboardingHeader
          title={status === "loading" ? "Accepting invitation..." : status === "success" ? "Invitation accepted!" : "Invitation error"}
          subtitle={status === "loading" ? "Please wait while we add you to the organization" : message}
        />

        <div className="mb-8 flex justify-center">
          <div 
            className="p-6 rounded-3xl inline-block"
            style={{
              boxShadow: "inset 2px 2px 6px rgba(0,0,0,0.08), inset -2px -2px 6px rgba(255,255,255,0.7)"
            }}
          >
            {status === "loading" && <Loader2 className="w-12 h-12 text-[#8EC9CE] animate-spin" />}
            {status === "success" && <CheckCircle2 className="w-12 h-12 text-green-500" />}
            {status === "error" && <XCircle className="w-12 h-12 text-[#EB6834]" />}
          </div>
        </div>

        {status === "error" && (
          <div className="space-y-4">
            <NeomorphicButton
              variant="primary"
              onClick={() => navigate("/work/tasks")}
            >
              Go to Dashboard
            </NeomorphicButton>
            <NeomorphicButton
              variant="ghost"
              onClick={() => navigate("/login")}
            >
              Sign In
            </NeomorphicButton>
          </div>
        )}

        {status === "loading" && (
          <p className="text-sm text-[#6D7480] text-center">
            This may take a moment...
          </p>
        )}

        {status === "password" && (
          <div className="space-y-6">
            <div className="mb-8 flex justify-center">
              <div 
                className="p-6 rounded-3xl inline-block"
                style={{
                  boxShadow: "inset 2px 2px 6px rgba(0,0,0,0.08), inset -2px -2px 6px rgba(255,255,255,0.7)"
                }}
              >
                <Lock className="w-12 h-12 text-[#8EC9CE]" />
              </div>
            </div>

            <form onSubmit={handleSetPassword} className="space-y-4">
              <NeomorphicPasswordInput
                label="Set Password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={passwordError}
                disabled={settingPassword}
              />

              <NeomorphicButton
                type="submit"
                variant="primary"
                disabled={settingPassword || !password || password.length < 8}
              >
                {settingPassword ? "Setting password..." : "Set Password & Accept Invitation"}
              </NeomorphicButton>
            </form>

            <p className="text-sm text-[#6D7480] text-center">
              After setting your password, you'll be added to the organization automatically.
            </p>
          </div>
        )}
      </div>
    </OnboardingContainer>
  );
}
