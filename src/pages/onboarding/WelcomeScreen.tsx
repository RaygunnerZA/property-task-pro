import { useNavigate } from "react-router-dom";
import { OnboardingContainer } from "@/components/onboarding/OnboardingContainer";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";
import fillaLogo from "@/assets/filla-logo-teal.svg";
export default function WelcomeScreen() {
  const navigate = useNavigate();
  return <OnboardingContainer className="bg-[#2a293e]">
      <div className="text-center animate-fade-in">
        <div className="mb-8 flex justify-center">
          <img src={fillaLogo} alt="Filla" className="h-60 w-auto object-contain" />
        </div>

        <h1 className="text-4xl font-semibold mb-4 text-primary">
          Welcome to Filla
        </h1>
        
        <p className="text-lg text-[#6D7480] mb-12 px-4">
          The calm, tactile workspace for property teams.
          <br />
          Manage tasks, track compliance, and collaborate—all in one place.
        </p>

        <div className="space-y-4 px-[51px]">
          <NeomorphicButton variant="primary" onClick={() => navigate("/signup")} className="px-0 mx-0 ml-0 mr-0 pr-0 shadow-e3 bg-primary">
            Get Started
          </NeomorphicButton>

          <NeomorphicButton variant="ghost" onClick={() => navigate("/login")}>
            I already have an account
          </NeomorphicButton>
        </div>
      </div>
    </OnboardingContainer>;
}