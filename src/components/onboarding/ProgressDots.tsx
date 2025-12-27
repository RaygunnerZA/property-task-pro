import { useNavigate, useLocation } from "react-router-dom";
import { getRouteForStep, ONBOARDING_STEPS, TOTAL_STEPS } from "@/utils/onboardingSteps";

interface ProgressDotsProps {
  current: number;
  total?: number;
  allowNavigation?: boolean;
}

export function ProgressDots({ 
  current, 
  total = TOTAL_STEPS,
  allowNavigation = true 
}: ProgressDotsProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleDotClick = (step: number) => {
    if (!allowNavigation) return;
    
    // Mark navigation to prevent AppInitializer interference
    (window as any).__lastOnboardingNavigation = Date.now();
    
    // Allow navigation to previous steps or the current step
    // For future steps, only allow if they're already completed (step < current)
    if (step <= current) {
      // Step 0 (Sign Up) should navigate to login/welcome
      if (step === 0) {
        // Mark that we're leaving onboarding
        (window as any).__lastOnboardingNavigation = Date.now() + 5000; // Longer timeout for logout
        navigate("/welcome", { replace: false });
        return;
      }
      
      const route = getRouteForStep(step);
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
              ${isClickable ? 'cursor-pointer hover:scale-110' : 'cursor-default'}
              ${isCurrent
                ? "w-8 bg-accent"
                : isCompleted
                ? "w-2 bg-accent/50"
                : "w-2 bg-muted/20"
              }
            `}
            style={{
              boxShadow: isCurrent 
                ? "inset 1px 1px 2px rgba(0,0,0,0.1), inset -1px -1px 2px rgba(255,255,255,0.7)"
                : "none"
            }}
            title={ONBOARDING_STEPS[i]?.label || `Step ${i + 1}`}
            aria-label={`Go to ${ONBOARDING_STEPS[i]?.label || `step ${i + 1}`}`}
          />
        );
      })}
    </div>
  );
}
