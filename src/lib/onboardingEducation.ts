/** Marker in seeded demo task / record descriptions (matches DB seed). */
export const ONBOARDING_DEMO_MARKER = "[onboarding_demo]";

/** Visible title cue used by the seed (`Gas Safety Certificate (sample)`). */
const SAMPLE_TITLE_RE = /\(\s*sample(?:\s*[-–—][^)]*)?\s*\)/i;

export function isOnboardingDemoTask(task: {
  description?: string | null;
  title?: string | null;
}): boolean {
  return (
    typeof task.description === "string" &&
    task.description.includes(ONBOARDING_DEMO_MARKER)
  );
}

/** True when title/notes/description carry seed markers used across activity areas. */
export function isSeededSampleContent(fields: {
  title?: string | null;
  name?: string | null;
  notes?: string | null;
  description?: string | null;
  metadata?: unknown;
}): boolean {
  const title = fields.title ?? fields.name ?? "";
  if (SAMPLE_TITLE_RE.test(title)) return true;
  for (const value of [fields.notes, fields.description]) {
    if (typeof value === "string" && value.includes(ONBOARDING_DEMO_MARKER)) return true;
  }
  if (fields.metadata && typeof fields.metadata === "object") {
    const meta = fields.metadata as Record<string, unknown>;
    if (meta.onboarding_demo === true) return true;
  }
  return false;
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
export const SAMPLE_CONTENT_SHORT_LABEL = "SAMPLE";

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

/**
 * Stable dismiss key for seeded DB rows (compliance / documents / assets).
 * Prefer property-scoped keys so samples don't leak across properties.
 */
export function seededSampleDismissId(
  kind: "document" | "compliance" | "asset" | "task",
  entityId: string
): string {
  return `seeded:${kind}:${entityId}`;
}

export type SampleContentSection =
  | "records"
  | "assets"
  | "spaces"
  | "tasks"
  | "signals"
  | "knowledge"
  | "tags"
  | "reports";

export type SampleContentLesson = {
  section: SampleContentSection;
  /** What this area of the product is for. */
  purpose: string;
  /** Why this particular row/card exists. */
  sampleExplanation: string;
  /** Explicit phase-out promise shown before dismiss. */
  phaseOut: string;
};

const SECTION_LESSONS: Record<SampleContentSection, Omit<SampleContentLesson, "section">> = {
  records: {
    purpose:
      "Records holds certificates, documents, and compliance evidence for a property — grouped so you can find and renew them.",
    sampleExplanation:
      "This row is sample content so the list never feels empty on day one. It is not a real certificate or file on this property.",
    phaseOut:
      "When you continue, this sample disappears from your view. It will not come back. Your own uploads replace samples as soon as you add them.",
  },
  assets: {
    purpose:
      "Assets tracks equipment and plant so maintenance, condition, and compliance stay linked to the right kit.",
    sampleExplanation:
      "This is a sample asset so you can see how equipment appears in lists and health stats. It is not real plant on this property.",
    phaseOut:
      "Continuing hides this sample for good. Add your own assets when you are ready — samples step aside once real equipment is here.",
  },
  spaces: {
    purpose:
      "Spaces organise rooms and areas so tasks, assets, and records can be scoped to where work happens.",
    sampleExplanation:
      "This is a sample space to show how rooms appear and group. It is not a confirmed room layout for this property.",
    phaseOut:
      "Continuing hides this sample. Your own spaces replace demos as you organise the property.",
  },
  tasks: {
    purpose:
      "Tasks are the work itself — issues, checks, and follow-ups your team completes with evidence.",
    sampleExplanation:
      "This is a Learn Filla / demo task so you can practise the flow. It is not live work for your team.",
    phaseOut:
      "Continuing removes this sample from your lists. Real tasks you create stay; demos do not.",
  },
  signals: {
    purpose:
      "Signals surface things that may need attention — reviews, renewals, and suggestions — before they become urgent work.",
    sampleExplanation:
      "This card is DEMO CONTENT so you can see how Filla presents a decision. It is not a real issue on this property.",
    phaseOut:
      "Continuing dismisses this sample permanently on this property. Live signals from your data take its place.",
  },
  knowledge: {
    purpose:
      "Knowledge stores verified policies and playbooks the organisation and assistant can reuse.",
    sampleExplanation:
      "This entry is illustrative guidance so you can see how published knowledge looks. Treat it as a template, not policy for your org.",
    phaseOut:
      "Continuing hides this sample. Publish your own guidance when you are ready.",
  },
  tags: {
    purpose:
      "Tags label tasks so related work can be filtered and found across properties.",
    sampleExplanation:
      "This is a sample label so the Tags area shows how classification works. You can create your own tags anytime.",
    phaseOut:
      "Continuing hides this sample tag from teaching lists. Tags you create remain.",
  },
  reports: {
    purpose:
      "Reports lets you browse packs, open a workspace, and export evidence-backed views of the portfolio.",
    sampleExplanation:
      "This is a sample workspace so you can see how saved reports appear. It is not a live export for your org.",
    phaseOut:
      "Continuing hides this sample. Workspaces you create from templates stay in Recent.",
  },
};

export function getSampleContentLesson(
  section: SampleContentSection,
  overrides?: Partial<Omit<SampleContentLesson, "section">>
): SampleContentLesson {
  return {
    section,
    ...SECTION_LESSONS[section],
    ...overrides,
  };
}

/**
 * Clever phase-out: once the section has enough real (non-sample) items,
 * seeded samples stop teaching and should be hidden.
 */
export function shouldAutoHideSeededSamples(args: {
  realItemCount: number;
  /** Default 1 — first real item retires samples for that surface. */
  threshold?: number;
}): boolean {
  const threshold = args.threshold ?? 1;
  return args.realItemCount >= threshold;
}

/** Hide owner demo tasks from staff/member views — they get Learn Filla tasks instead. */
export function shouldHideOwnerDemoTaskForRole(
  task: { description?: string | null },
  role: string | null | undefined
): boolean {
  if (!role || role === "owner" || role === "manager") return false;
  return isOnboardingDemoTask(task);
}
