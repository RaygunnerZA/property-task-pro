import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingContainer } from "@/components/onboarding/OnboardingContainer";
import { OnboardingHeader, OnboardingLogoutButton } from "@/components/onboarding/OnboardingHeader";
import { ProgressDots } from "@/components/onboarding/ProgressDots";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";
import { PropertyProfileSlider } from "@/components/onboarding/PropertyProfileSlider";
import { useOnboardingStore } from "@/hooks/useOnboardingStore";
import type { PropertyProfileId } from "@/lib/propertyProfiles";
import { toast } from "sonner";

export default function PropertyProfileScreen() {
  const navigate = useNavigate();
  const { setPropertyProfile } = useOnboardingStore();

  const [confirmedId, setConfirmedId] = useState<PropertyProfileId | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSlideChange = useCallback(() => {
    setConfirmedId(null);
  }, []);

  const handleCardConfirm = (id: PropertyProfileId) => {
    setConfirmedId(id);
    setPropertyProfile(id);
  };

  const handleNext = async () => {
    if (!confirmedId) {
      toast.error("Tap the image or title to choose your property type");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.auth.updateUser({
          data: { ...user.user_metadata, property_profile: confirmedId },
        });
      }
    } catch (err) {
      console.warn("[PropertyProfileScreen] Failed to persist property_profile:", err);
    } finally {
      setSubmitting(false);
    }

    navigate("/onboarding/create-organisation");
  };

  return (
    <OnboardingContainer topRight={<OnboardingLogoutButton />}>
      <div className="animate-fade-in">
        <ProgressDots />

        <OnboardingHeader
          title="What are you managing?"
          subtitle="We'll tailor Filla to your property."
          showLogout={false}
          showBack
          onBack={() => navigate("/verify")}
        />

        <PropertyProfileSlider
          confirmedId={confirmedId}
          onConfirm={handleCardConfirm}
          onSlideChange={handleSlideChange}
        />

        <NeomorphicButton
          variant="primary"
          onClick={handleNext}
          disabled={!confirmedId || submitting}
        >
          {submitting ? "Saving…" : confirmedId ? "Next" : "Continue"}
        </NeomorphicButton>
      </div>
    </OnboardingContainer>
  );
}
