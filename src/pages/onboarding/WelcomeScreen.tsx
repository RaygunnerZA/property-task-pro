import { useNavigate } from "react-router-dom";
import { OnboardingContainer } from "@/components/onboarding/OnboardingContainer";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";
import { Building2 } from "lucide-react";

export default function WelcomeScreen() {
  const navigate = useNavigate();

  return (
    <OnboardingContainer>
      <div className="text-center animate-fade-in">
        <div className="mb-8 flex justify-center">
          <div 
            className="p-6 rounded-3xl inline-block"
            style={{
              boxShadow: "4px 4px 12px rgba(0,0,0,0.08), -4px -4px 12px rgba(255,255,255,0.7)"
            }}
          >
            <Building2 className="w-16 h-16 text-[#FF6B6B]" />
          </div>
        </div>

        <h1 className="text-4xl font-semibold text-[#1C1C1C] mb-4">
          Welcome to Filla
        </h1>
        
        <p className="text-lg text-[#6D7480] mb-12 px-4">
          The calm, tactile workspace for property teams.
          <br />
          Manage tasks, track compliance, and collaborate—all in one place.
        </p>

        <div className="space-y-4">
          <NeomorphicButton
            variant="primary"
            onClick={() => navigate("/signup")}
          >
            Get Started
          </NeomorphicButton>

          <NeomorphicButton
            variant="ghost"
            onClick={() => navigate("/login")}
          >
            I already have an account
          </NeomorphicButton>
        </div>
      </div>
    </OnboardingContainer>
  );
}
