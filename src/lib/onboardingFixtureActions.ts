import { propertyHubPath } from "@/lib/propertyRoutes";
import type { IntakeMode } from "@/types/intake";

/** Visual mode for panel/footer CTAs (Create Task = teal, Add Record = coral). */
export function fixtureActionVisualMode(actionId: string): IntakeMode {
  const id = actionId.toLowerCase();
  if (
    id === "create-task" ||
    id === "create-service-task" ||
    id === "create-prep-task" ||
    id === "create-asset" ||
    id === "complete-profile" ||
    id === "report-issue" ||
    id === "treat-as-issue" ||
    id === "signal-assign"
  ) {
    return "report_issue";
  }
  return "add_record";
}

export type OnboardingFixtureNavigateCtx = {
  navigate: (to: string) => void;
  propertyId: string | null;
  onOpenIntake?: (mode: IntakeMode) => void;
};

/**
 * Routes onboarding / fixture CTA ids to intake or navigation.
 * Returns false for dismiss/ignore/unknown so the caller can close or no-op.
 */
export function performOnboardingFixtureAction(
  actionId: string,
  ctx: OnboardingFixtureNavigateCtx
): "intake" | "navigate" | "dismiss" | "noop" {
  const { navigate, propertyId, onOpenIntake } = ctx;

  switch (actionId) {
    case "report-issue":
    case "treat-as-issue":
    case "signal-assign":
    case "create-task":
    case "create-service-task":
    case "create-prep-task":
      onOpenIntake?.("report_issue");
      return "intake";
    case "signal-review":
    case "upload-document":
    case "categorise-document":
    case "review-certificate":
    case "review-documents":
    case "view-certificate":
    case "review-signal":
    case "signal-convert":
      onOpenIntake?.("add_record");
      return "intake";
    case "complete-profile":
      navigate(propertyId ? propertyHubPath(propertyId) : "/home");
      return "navigate";
    case "create-asset":
      navigate(
        propertyId
          ? `/assets?add=true&property=${encodeURIComponent(propertyId)}`
          : "/assets?add=true"
      );
      return "navigate";
    case "view-asset":
      navigate(propertyId ? `/assets?property=${encodeURIComponent(propertyId)}` : "/assets");
      return "navigate";
    case "ignore":
    case "dismiss":
      return "dismiss";
    default:
      return "noop";
  }
}
