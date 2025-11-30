import { useNavigate } from "react-router-dom";
import { OnboardingContainer } from "@/components/onboarding/OnboardingContainer";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";
import { CheckCircle2 } from "lucide-react";
import { useEffect } from "react";

export default function OnboardingCompleteScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    // Mark onboarding as complete
    localStorage.setItem('filla_onboarding_complete', 'true');
  }, []);

  return (
    <OnboardingContainer>
      <div className="text-center animate-fade-in">
        <div className="mb-8 flex justify-center">
          <div 
            className="p-6 rounded-3xl inline-block"
            style={{
              boxShadow: "4px 4px 12px rgba(14, 165, 233, 0.15), -4px -4px 12px rgba(255,255,255,0.7)"
            }}
          >
            <CheckCircle2 className="w-16 h-16 text-[#0EA5E9]" />
          </div>
        </div>

        <h1 className="text-4xl font-semibold text-[#1C1C1C] mb-4">
          You're all set!
        </h1>
        
        <p className="text-lg text-[#6D7480] mb-12 px-4">
          Your workspace is ready.
          <br />
          Let's start managing your properties.
        </p>

        <NeomorphicButton
          variant="primary"
          onClick={() => navigate("/work/tasks")}
        >
          Go to Home
        </NeomorphicButton>
      </div>
    </OnboardingContainer>
  );
}
