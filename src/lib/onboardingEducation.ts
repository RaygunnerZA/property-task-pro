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

export const ONBOARDING_SAMPLE_LABEL = "DEMO CONTENT";

export const ONBOARDING_SAMPLE_DISMISSED_EVENT = "filla:onboarding-sample-dismissed";

const SAMPLE_DISMISS_PREFIX = "onboarding-samples-dismissed:";

export function onboardingSampleDismissStorageKey(propertyId: string): string {
  return `${SAMPLE_DISMISS_PREFIX}${propertyId}`;
}

/** UI-only education rows (not Quick wins, not live signals). */
export function isOnboardingSampleNotification(item: {
  id?: string;
  isUiFixture?: boolean;
  isOnboardingExample?: boolean;
}): boolean {
  const id = item.id ?? "";
  if (id.startsWith("onboarding:quick:")) return false;
  return (
    id.startsWith("onboarding:review:") ||
    id.startsWith("onboarding:signal:") ||
    id.startsWith("onboarding:record:")
  );
}

export function readDismissedOnboardingSampleIds(propertyId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(onboardingSampleDismissStorageKey(propertyId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

export function dismissOnboardingSample(propertyId: string, itemId: string): Set<string> {
  const next = readDismissedOnboardingSampleIds(propertyId);
  next.add(itemId);
  try {
    window.localStorage.setItem(
      onboardingSampleDismissStorageKey(propertyId),
      JSON.stringify([...next])
    );
    window.dispatchEvent(
      new CustomEvent(ONBOARDING_SAMPLE_DISMISSED_EVENT, {
        detail: { propertyId, itemId },
      })
    );
  } catch {
    /* ignore */
  }
  return next;
}

/** Hide owner demo tasks from staff/member views — they get Learn Filla tasks instead. */
export function shouldHideOwnerDemoTaskForRole(
  task: { description?: string | null },
  role: string | null | undefined
): boolean {
  if (!role || role === "owner" || role === "manager") return false;
  return isOnboardingDemoTask(task);
}
