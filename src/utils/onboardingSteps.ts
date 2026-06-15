// Onboarding step definitions and navigation utilities

import type { PropertyProfileId } from "@/lib/propertyProfiles";
import { shouldShowInviteTeamStep } from "@/lib/propertyProfiles";

export interface OnboardingStep {
  step: number;
  route: string;
  label: string;
}

export const INVITE_TEAM_ROUTE = "/onboarding/invite-team";

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { step: 0, route: "/signup", label: "Sign Up" },
  { step: 1, route: "/verify", label: "Verify Email" },
  { step: 2, route: "/onboarding/property-profile", label: "Property Profile" },
  { step: 3, route: "/onboarding/create-organisation", label: "Create Organisation" },
  { step: 4, route: "/onboarding/add-property", label: "Add Property" },
  { step: 5, route: "/onboarding/add-spaces", label: "Add Spaces" },
  { step: 6, route: INVITE_TEAM_ROUTE, label: "Invite Team" },
];

export const TOTAL_STEPS = ONBOARDING_STEPS.length;

/** Steps shown in progress dots — invite team omitted for primary homeowners. */
export function getOnboardingStepsForProfile(
  profile: PropertyProfileId | null
): OnboardingStep[] {
  const steps = ONBOARDING_STEPS.filter(
    (step) => shouldShowInviteTeamStep(profile) || step.route !== INVITE_TEAM_ROUTE
  );
  return steps.map((step, index) => ({ ...step, step: index }));
}

export function getTotalSteps(profile: PropertyProfileId | null = null): number {
  return getOnboardingStepsForProfile(profile).length;
}

/**
 * Get the current step number from the current route
 */
export function getCurrentStep(
  route: string,
  profile: PropertyProfileId | null = null
): number {
  const step = getOnboardingStepsForProfile(profile).find((s) => s.route === route);
  return step?.step ?? 0;
}

/**
 * Get the route for a specific step
 */
export function getRouteForStep(
  step: number,
  profile: PropertyProfileId | null = null
): string {
  return getOnboardingStepsForProfile(profile)[step]?.route ?? "/signup";
}

/**
 * Check if a route is an onboarding route
 */
export function isOnboardingRoute(route: string): boolean {
  return ONBOARDING_STEPS.some((s) => s.route === route);
}
