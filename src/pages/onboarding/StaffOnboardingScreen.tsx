import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { markOnboardingComplete } from "@/utils/completeOnboarding";
import { OnboardingContainer } from "@/components/onboarding/OnboardingContainer";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useOrganization } from "@/hooks/use-organization";
import { Users } from "lucide-react";

/**
 * Staff onboarding: orientation only. For invited users (staff/contractors).
 * No organisation creation, property, or space setup. Sets onboarding_completed on Continue.
 */
export default function StaffOnboardingScreen() {
  const navigate = useNavigate();
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const { organization } = useOrganization();
  const [settingComplete, setSettingComplete] = useState(false);

  const orgName = organization?.name ?? "your organisation";

  const handleContinue = async () => {
    setSettingComplete(true);
    try {
      await markOnboardingComplete();
      (window as unknown as { __lastOnboardingNavigation?: number }).__lastOnboardingNavigation =
        Date.now();
      navigate("/", { replace: true });
    } catch {
      setSettingComplete(false);
    }
  };

  useEffect(() => {
    if (!orgLoading && !orgId) {
      navigate("/onboarding/create-organisation", { replace: true });
    }
  }, [orgId, orgLoading, navigate]);

  if (orgLoading || !orgId) {
    return (
      <OnboardingContainer>
        <div className="flex min-h-[200px] items-center justify-center text-[#6D7480]">
          Loading…
        </div>
      </OnboardingContainer>
    );
  }

  return (
    <OnboardingContainer>
      <div className="text-center animate-fade-in">
        <div className="mb-8 flex justify-center">
          <div
            className="p-6 rounded-3xl inline-block"
            style={{
              boxShadow: "inset 2px 2px 6px rgba(0,0,0,0.08), inset -2px -2px 6px rgba(255,255,255,0.7)",
            }}
          >
            <Users className="h-16 w-16 text-primary" />
          </div>
        </div>

        <h1 className="text-4xl font-semibold text-[#1C1C1C] mb-4 heading-xl">
          You&apos;ve been invited
        </h1>

        <p className="text-lg text-[#6D7480] mb-8 px-4">
          You&apos;ve been invited to <strong className="text-[#1C1C1C]">{orgName}</strong>.
          <br />
          You can start working on tasks right away.
        </p>

        <NeomorphicButton
          variant="primary"
          onClick={handleContinue}
          disabled={settingComplete}
        >
          {settingComplete ? "Continuing…" : "Continue"}
        </NeomorphicButton>
      </div>
    </OnboardingContainer>
  );
}
