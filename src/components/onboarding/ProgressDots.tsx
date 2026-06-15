import { useNavigate, useLocation } from "react-router-dom";
import {
  getCurrentStep,
  getOnboardingStepsForProfile,
  getRouteForStep,
  getTotalSteps,
} from "@/utils/onboardingSteps";
import { useOnboardingPropertyProfile } from "@/hooks/useOnboardingPropertyProfile";

interface ProgressDotsProps {
  current?: number;
  total?: number;
  allowNavigation?: boolean;
}

export function ProgressDots({
  current: currentOverride,
  total: totalOverride,
  allowNavigation = true,
}: ProgressDotsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const propertyProfile = useOnboardingPropertyProfile();
  const steps = getOnboardingStepsForProfile(propertyProfile);
  const current =
    currentOverride ?? getCurrentStep(location.pathname, propertyProfile);
  const total = totalOverride ?? getTotalSteps(propertyProfile);

  const handleDotClick = (step: number) => {
    if (!allowNavigation) return;

    // Mark navigation to prevent AppInitializer interference
    (window as any).__lastOnboardingNavigation = Date.now();

    // Allow navigation to previous steps or the current step
    if (step <= current) {
      // Step 0 (Sign Up) should navigate to login/welcome
      if (step === 0) {
        (window as any).__lastOnboardingNavigation = Date.now() + 5000;
        navigate("/welcome", { replace: false });
        return;
      }

      const route = getRouteForStep(step, propertyProfile);
      if (route !== location.pathname) {
        navigate(route, { replace: false });
      }
    }
  };

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => {
        const isClickable = allowNavigation && i <= current;
        const isCurrent = i === current;
        const isCompleted = i < current;

        return (
          <button
            key={i}
            type="button"
            onClick={() => handleDotClick(i)}
            disabled={!isClickable}
            className={`
              h-2 rounded-full transition-all duration-300 ease-out
              ${isClickable ? "cursor-pointer hover:scale-110" : "cursor-default"}
              ${
                isCurrent
                  ? "w-8 bg-accent"
                  : isCompleted
                    ? "w-2 bg-accent/50"
                    : "w-2 bg-muted/20"
              }
            `}
            style={{
              boxShadow: isCurrent
                ? "inset 1px 1px 2px rgba(0,0,0,0.1), inset -1px -1px 2px rgba(255,255,255,0.7)"
                : "none",
            }}
            title={steps[i]?.label || `Step ${i + 1}`}
            aria-label={`Go to ${steps[i]?.label || `step ${i + 1}`}`}
          />
        );
      })}
    </div>
  );
}
