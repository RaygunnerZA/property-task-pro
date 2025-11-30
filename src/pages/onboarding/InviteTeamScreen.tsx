import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { OnboardingContainer } from "@/components/onboarding/OnboardingContainer";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
import { ProgressDots } from "@/components/onboarding/ProgressDots";
import { NeomorphicInput } from "@/components/onboarding/NeomorphicInput";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";
import { useOnboardingStore } from "@/hooks/useOnboardingStore";
import { toast } from "sonner";
import { X, UserPlus } from "lucide-react";

export default function InviteTeamScreen() {
  const navigate = useNavigate();
  const { teamInvites, addTeamInvite, removeTeamInvite } = useOnboardingStore();
  
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

  const handleSendInvites = () => {
    // In a real app, this would call an API to send emails
    // For now, we'll just show success and continue
    if (teamInvites.length > 0) {
      toast.success(`${teamInvites.length} invite(s) queued for sending`);
    }
    navigate("/onboarding/preferences");
  };

  const handleSkip = () => {
    navigate("/onboarding/preferences");
  };

  return (
    <OnboardingContainer>
      <div className="animate-fade-in">
        <ProgressDots current={4} total={6} />
        
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
            >
              {teamInvites.length > 0 ? `Send ${teamInvites.length} invite(s)` : "Continue"}
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
