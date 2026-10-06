import { ReactNode } from "react";

interface OnboardingContainerProps {
  children: ReactNode;
  className?: string;
  /** Rendered at top-right on all onboarding screens (e.g. step icon or Skip link) */
  topRight?: ReactNode;
}

export function OnboardingContainer({ children, className, topRight }: OnboardingContainerProps) {
  return (
    <div className={`min-h-screen ${!className ? 'bg-background' : ''} flex flex-col items-center justify-center p-6 relative overflow-hidden ${className || ''}`}>
      {/* Top-right slot (e.g. step icon) */}
      {topRight != null && (
        <div className="absolute top-6 right-6 z-20">
          {topRight}
        </div>
      )}

      <div className="relative z-10 w-full min-w-0 max-w-md">
        {children}
      </div>
    </div>
  );
}
