/** Marker stored in demo task descriptions and sample row notes (matches DB seed). */
export const ONBOARDING_DEMO_MARKER = "[onboarding_demo]";

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

export function onboardingDemoBannerStorageKey(propertyId: string): string {
  return `onboarding-demo-banner-dismissed:${propertyId}`;
}
