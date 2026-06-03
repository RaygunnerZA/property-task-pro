import { useNavigate } from "react-router-dom";
import { OnboardingContainer } from "@/components/onboarding/OnboardingContainer";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";
import welcomeRadar from "@/assets/onboarding/welcome-radar.gif";

export default function WelcomeScreen() {
  const navigate = useNavigate();

  return (
    <OnboardingContainer>
      <div className="animate-fade-in text-center">
        <div className="mb-8 flex h-[250px] justify-center">
          <img
            src={welcomeRadar}
            alt=""
            className="h-56 w-56 max-w-[min(70vw,14rem)] object-contain"
            width={224}
            height={224}
            decoding="async"
          />
        </div>

        <h1 className="heading-xl mb-4 text-4xl font-semibold text-[#1C1C1C]">
          Welcome to Filla
        </h1>

        <p className="mb-10 px-2 text-lg leading-relaxed text-[#6D7480]">
          AI-powered property management for homes, buildings and portfolios.
        </p>

        <div className="space-y-3">
          <NeomorphicButton variant="primary" onClick={() => navigate("/signup")}>
            Get Started
          </NeomorphicButton>

          <NeomorphicButton variant="ghost" onClick={() => navigate("/login")}>
            Sign In
          </NeomorphicButton>
        </div>
      </div>
    </OnboardingContainer>
  );
}
