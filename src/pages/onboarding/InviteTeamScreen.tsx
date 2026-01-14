import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { OnboardingContainer } from "@/components/onboarding/OnboardingContainer";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
import { ProgressDots } from "@/components/onboarding/ProgressDots";
import { NeomorphicInput } from "@/components/onboarding/NeomorphicInput";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";
import { useOnboardingStore } from "@/hooks/useOnboardingStore";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { getCurrentStep } from "@/utils/onboardingSteps";
import { toast } from "sonner";
import { X, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function InviteTeamScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { teamInvites, addTeamInvite, removeTeamInvite } = useOnboardingStore();
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const [sending, setSending] = useState(false);
  
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("member");

  const handleAddInvite = () => {
    if (!email.trim()) {
      toast.error("Please enter an email");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email");
      return;
    }

    if (teamInvites.some(invite => invite.email === email)) {
      toast.error("This person is already invited");
      return;
    }

    addTeamInvite({ email, role });
    setEmail("");
    setRole("member");
    toast.success("Invite added");
  };

  const handleSendInvites = async () => {
    if (teamInvites.length === 0) {
      navigate("/onboarding/preferences");
      return;
    }

    if (!orgId) {
      toast.error("Organization not found. Please complete organization setup first.");
      return;
    }

    if (orgLoading) {
      toast.error("Loading organization information...");
      return;
    }

    setSending(true);
    try {
      // Get the current session token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error("You must be logged in to send invitations");
      }

      // Send all invitations
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const invite of teamInvites) {
        try {
          const { data, error } = await supabase.functions.invoke("invite-team-member", {
            body: {
              email: invite.email.trim(),
              org_id: orgId,
              first_name: null, // Onboarding doesn't collect first/last name separately
              last_name: null,
              role: invite.role || "member",
            },
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });

          if (error || data?.error) {
            errorCount++;
            errors.push(`${invite.email}: ${error?.message || data?.error || "Failed to send"}`);
          } else {
            successCount++;
          }
        } catch (err: any) {
          errorCount++;
          errors.push(`${invite.email}: ${err.message || "Failed to send"}`);
        }
      }

      // Show results
      if (successCount > 0) {
        toast.success(`Successfully sent ${successCount} invitation(s)`);
      }
      if (errorCount > 0) {
        toast.error(`Failed to send ${errorCount} invitation(s)`, {
          description: errors.slice(0, 3).join(", "),
        });
      }

      // Clear all invites from store after sending (remove from end to avoid index issues)
      for (let i = teamInvites.length - 1; i >= 0; i--) {
        removeTeamInvite(i);
      }
    } catch (err: any) {
      console.error("Error sending invitations:", err);
      toast.error(err.message || "Failed to send invitations");
    } finally {
      setSending(false);
      // Navigate to next step regardless of errors
      navigate("/onboarding/preferences");
    }
  };

  const handleSkip = () => {
    navigate("/onboarding/preferences");
  };

  return (
    <OnboardingContainer>
      <div className="animate-fade-in">
        <ProgressDots current={getCurrentStep(location.pathname)} />
        
        <OnboardingHeader
          title="Invite your team"
          subtitle="Collaborate with colleagues"
        />

        <div className="space-y-6">
          <div>
            <NeomorphicInput
              label="Email address"
              type="email"
              placeholder="colleague@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddInvite();
                }
              }}
            />

            <div className="mb-4">
              <label className="block text-sm font-medium text-[#6D7480] mb-2">
                Role
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(['member', 'manager'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`
                      px-4 py-3 rounded-xl text-sm font-medium capitalize
                      transition-all duration-150 ease-out
                      ${role === r 
                        ? 'text-[#FF6B6B]' 
                        : 'text-[#6D7480] hover:text-[#1C1C1C]'
                      }
                    `}
                    style={{
                      boxShadow: role === r
                        ? "inset 2px 2px 4px rgba(255,107,107,0.15), inset -2px -2px 4px rgba(255,255,255,0.7)"
                        : "inset 1px 1px 3px rgba(0,0,0,0.08), inset -1px -1px 3px rgba(255,255,255,0.7)"
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleAddInvite}
              className="w-full px-4 py-2 rounded-xl text-[#6D7480] hover:text-[#FF6B6B] transition-colors flex items-center justify-center gap-2"
              style={{
                boxShadow: "inset 1px 1px 3px rgba(0,0,0,0.08), inset -1px -1px 3px rgba(255,255,255,0.7)"
              }}
            >
              <UserPlus className="w-4 h-4" />
              Add invite
            </button>
          </div>

          {teamInvites.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#6D7480]">
                Pending invites ({teamInvites.length})
              </label>
              {teamInvites.map((invite, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{
                    boxShadow: "inset 1px 1px 3px rgba(0,0,0,0.08), inset -1px -1px 3px rgba(255,255,255,0.7)"
                  }}
                >
                  <div>
                    <p className="text-sm text-[#1C1C1C]">{invite.email}</p>
                    <p className="text-xs text-[#6D7480] capitalize">{invite.role}</p>
                  </div>
                  <button
                    onClick={() => removeTeamInvite(index)}
                    className="p-1 text-[#6D7480] hover:text-[#FF6B6B] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 space-y-3">
            <NeomorphicButton
              variant="primary"
              onClick={handleSendInvites}
              disabled={sending || orgLoading}
            >
              {sending 
                ? "Sending invitations..." 
                : teamInvites.length > 0 
                  ? `Send ${teamInvites.length} invite(s)` 
                  : "Continue"}
            </NeomorphicButton>

            <NeomorphicButton
              variant="ghost"
              onClick={handleSkip}
            >
              Skip for now
            </NeomorphicButton>
          </div>
        </div>
      </div>
    </OnboardingContainer>
  );
}
