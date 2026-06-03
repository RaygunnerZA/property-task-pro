// Onboarding step definitions and navigation utilities

export interface OnboardingStep {
  step: number;
  route: string;
  label: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { step: 0, route: "/signup", label: "Sign Up" },
  { step: 1, route: "/verify", label: "Verify Email" },
  { step: 2, route: "/onboarding/property-profile", label: "Property Profile" },
  { step: 3, route: "/onboarding/create-organisation", label: "Create Organisation" },
  { step: 4, route: "/onboarding/add-property", label: "Add Property" },
  { step: 5, route: "/onboarding/add-spaces", label: "Add Spaces" },
  { step: 6, route: "/onboarding/invite-team", label: "Invite Team" },
  { step: 7, route: "/onboarding/preferences", label: "Preferences" },
];

export const TOTAL_STEPS = 8; // 0-7 = 8 steps

/**
 * Get the current step number from the current route
 */
export function getCurrentStep(route: string): number {
  const step = ONBOARDING_STEPS.find(s => s.route === route);
  return step?.step ?? 0;
}

/**
 * Get the route for a specific step
 */
export function getRouteForStep(step: number): string {
  return ONBOARDING_STEPS[step]?.route ?? "/signup";
}

/**
 * Check if a route is an onboarding route
 */
export function isOnboardingRoute(route: string): boolean {
  return ONBOARDING_STEPS.some(s => s.route === route);
}

