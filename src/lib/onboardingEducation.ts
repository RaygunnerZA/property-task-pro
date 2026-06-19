/** Marker in seeded demo task / record descriptions (matches DB seed). */
export const ONBOARDING_DEMO_MARKER = "[onboarding_demo]";

export function isOnboardingDemoTask(task: {
  description?: string | null;
  title?: string | null;
}): boolean {
  return (
    typeof task.description === "string" &&
    task.description.includes(ONBOARDING_DEMO_MARKER)
  );
}

export function propertyHasOnboardingDemoContent(
  tasks: Array<{ property_id?: string | null; description?: string | null }>,
  propertyId: string
): boolean {
  return tasks.some(
    (t) =>
      t.property_id === propertyId &&
      typeof t.description === "string" &&
      t.description.includes(ONBOARDING_DEMO_MARKER)
  );
}

export function orgHasOnboardingDemoContent(
  tasks: Array<{ description?: string | null }>
): boolean {
  return tasks.some(
    (t) =>
      typeof t.description === "string" && t.description.includes(ONBOARDING_DEMO_MARKER)
  );
}

export function onboardingDemoBannerStorageKey(propertyId: string): string {
  return `onboarding-demo-banner-dismissed:${propertyId}`;
}

export function onboardingEducationDismissStorageKey(propertyId: string): string {
  return `onboarding-education-dismissed:${propertyId}`;
}

/** Hide owner demo tasks from staff/member views — they get Learn Filla tasks instead. */
export function shouldHideOwnerDemoTaskForRole(
  task: { description?: string | null },
  role: string | null | undefined
): boolean {
  if (!role || role === "owner" || role === "manager") return false;
  return isOnboardingDemoTask(task);
}
