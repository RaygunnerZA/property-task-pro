import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import CreateOrganisationScreen from "@/pages/onboarding/CreateOrganisationScreen";
import AddPropertyScreen from "@/pages/onboarding/AddPropertyScreen";
import AddSpaceScreen from "@/pages/onboarding/AddSpaceScreen";

/**
 * Centralized router component for onboarding screens.
 * This provides a single source of truth for onboarding navigation.
 * 
 * @param step - The onboarding step to render
 */
export function OnboardingRouter({ step }: { step: OnboardingStep }) {
  switch (step) {
    case "ORG_CREATE":
      return <CreateOrganisationScreen />;
    
    case "PROPERTY_CREATE":
      return <AddPropertyScreen />;
    
    case "SPACES_CREATE":
      return <AddSpaceScreen />;
    
    default:
      // Fallback to dashboard if step is unknown
      return <Navigate to="/" replace />;
  }
}

export type OnboardingStep =
  | "ORG_CREATE"
  | "PROPERTY_CREATE"
  | "SPACES_CREATE";

