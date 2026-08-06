import type { AttentionItem } from "@/components/dashboard/issues/issuesAttentionItem";

/** Fixture primary actions — routed in IssuesSignalCard.runFixtureAction. */
export type OnboardingFixtureActionId =
  | "complete-profile"
  | "create-asset"
  | "upload-document"
  | "create-task"
  | "review-certificate"
  | "create-service-task"
  | "categorise-document"
  | "review-signal"
  | "create-prep-task"
  | "view-certificate"
  | "view-asset"
  | "review-documents"
  | "dismiss"
  | "ignore";

function reviewItem(
  id: string,
  title: string,
  description: string,
  action: { id: OnboardingFixtureActionId; label: string },
  imageUrl: string,
  opts?: { tip?: boolean }
): AttentionItem {
  return {
    id: `onboarding:review:${id}`,
    group: "review",
    title,
    context: opts?.tip ? "Tip" : "Needs a decision",
    description,
    whyHere: "Filla surfaces items like this so you can confirm before routing work.",
    isUiFixture: true,
    isOnboardingExample: true,
    imageUrl,
    fixtureActions: {
      primary: action,
      secondary: [{ id: "dismiss", label: "Dismiss" }],
    },
  };
}

function recentSignal(
  id: string,
  title: string,
  description: string,
  imageUrl: string,
  action: { id: OnboardingFixtureActionId; label: string },
  kind: AttentionItem["signalKind"] = "ai_suggestion"
): AttentionItem {
  return {
    id: `onboarding:signal:${id}`,
    group: "recent",
    title,
    context: "Tip — how Filla surfaces updates",
    description,
    signalKind: kind,
    footChipLabel: "SIGNAL",
    isUiFixture: true,
    isOnboardingExample: true,
    imageUrl,
    confidenceLevel: "medium",
    fixtureActions: {
      primary: action,
      secondary: [{ id: "dismiss", label: "Dismiss" }],
    },
  };
}

function recordItem(id: string, title: string, category: string, imageUrl: string): AttentionItem {
  return {
    id: `onboarding:record:${id}`,
    group: "review",
    title,
    context: `Suggested category: ${category}`,
    description: "Once you upload documents, Filla can categorise and monitor records like this.",
    isUiFixture: true,
    isOnboardingExample: true,
    imageUrl,
    fixtureActions: {
      primary: { id: "categorise-document", label: "Categorise" },
      secondary: [{ id: "dismiss", label: "Dismiss" }],
    },
    complianceSeed: {
      title,
      propertyName: "Your property",
      complianceType: category,
    },
  };
}

function quickWin(
  id: string,
  title: string,
  subtitle: string,
  imageUrl: string,
  action: { id: OnboardingFixtureActionId; label: string }
): AttentionItem {
  return {
    id: `onboarding:quick:${id}`,
    group: "recent",
    title,
    context: subtitle,
    description: "Complete this setup step in under a minute.",
    footChipLabel: "SETUP",
    isUiFixture: true,
    isOnboardingExample: true,
    imageUrl,
    fixtureActions: {
      primary: action,
    },
  };
}

/** Needs review — tips that teach triage / compliance decisions. */
export const ONBOARDING_NEEDS_ATTENTION: AttentionItem[] = [
  reviewItem(
    "fire-ext",
    "Review Fire Extinguisher Certificate",
    "A certificate was uploaded but needs confirmation before it becomes a monitored record.",
    { id: "review-certificate", label: "Review certificate" },
    "/spaces/mini-cards/first-aid.png",
    { tip: true }
  ),
  reviewItem(
    "boiler",
    "Boiler Service Due Soon",
    "Annual service due in 14 days — create a task so someone owns the work.",
    { id: "create-service-task", label: "Create service task" },
    "/spaces/mini-cards/boiler-room.png",
    { tip: true }
  ),
  reviewItem(
    "unknown-doc",
    "Unknown Document Uploaded",
    "Filla couldn't identify a recently uploaded file. Categorise it so it can be monitored.",
    { id: "categorise-document", label: "Categorise document" },
    "/spaces/mini-cards/archive-room.png",
    { tip: true }
  ),
];

/** Signals — tips that demonstrate AI / environmental value. */
export const ONBOARDING_SIGNALS: AttentionItem[] = [
  recentSignal(
    "electricity",
    "High Electricity Usage",
    "Energy use increased compared to last month. Review the signal or raise a check.",
    "/spaces/mini-cards/electrical-room.png",
    { id: "create-task", label: "Create inspection task" },
    "ai_warning"
  ),
  recentSignal(
    "rain",
    "Heavy Rain Expected This Week",
    "Check roofs, gutters, and drainage before the weather hits.",
    "/spaces/mini-cards/garden.png",
    { id: "create-prep-task", label: "Create prep task" },
    "weather"
  ),
  recentSignal(
    "fire-cert",
    "Fire Safety Certificate Expires Soon",
    "Expiry detected in an uploaded document — open the certificate or set a renewal task.",
    "/spaces/mini-cards/first-aid.png",
    { id: "view-certificate", label: "View certificate" },
    "document"
  ),
  recentSignal(
    "warranty",
    "Boiler Warranty Found",
    "A warranty document was identified and linked to an asset. Confirm it on the asset.",
    "/spaces/mini-cards/boiler-room.png",
    { id: "view-asset", label: "View asset" },
    "ai_suggestion"
  ),
  recentSignal(
    "multi-review",
    "Multiple Documents Need Review",
    "Filla found information in uploads but needs confirmation before filing.",
    "/spaces/mini-cards/archive-room.png",
    { id: "review-documents", label: "Review documents" },
    "upload"
  ),
];

/** Records to organise — tips that teach filing. */
export const ONBOARDING_RECORDS: AttentionItem[] = [
  recordItem("insurance", "Building Insurance Policy", "Insurance", "/spaces/mini-cards/archive-room.png"),
  recordItem("lighting", "Emergency Lighting Report", "Compliance", "/spaces/mini-cards/electrical-room.png"),
  recordItem("water", "Water System Inspection", "Maintenance", "/spaces/mini-cards/boiler-room.png"),
];

/** Quick wins — real onboarding / setup steps (not generic “Start”). */
export const ONBOARDING_QUICK_WINS: AttentionItem[] = [
  quickWin(
    "profile",
    "Complete Your Property Profile",
    "Nickname, type, and contacts",
    "/spaces/mini-cards/office.png",
    { id: "complete-profile", label: "Complete profile" }
  ),
  quickWin(
    "asset",
    "Add Your First Asset",
    "Boilers, lifts, vehicles, appliances",
    "/spaces/mini-cards/plant-room.png",
    { id: "create-asset", label: "Create an asset" }
  ),
  quickWin(
    "upload",
    "Upload One Document",
    "Drag and drop any PDF or image",
    "/spaces/mini-cards/archive-room.png",
    { id: "upload-document", label: "Upload document" }
  ),
  quickWin(
    "task",
    "Create Your First Task",
    "See how Filla organises work",
    "/spaces/mini-cards/kitchen.png",
    { id: "create-task", label: "Create a task" }
  ),
];

export const ONBOARDING_EDUCATION_SUMMARY = {
  residential:
    "Good start. Filla has created spaces and identified opportunities to improve organisation. Upload a document or create a task to see Filla begin learning about your property.",
  commercial:
    "Your property is set up. Add documents, assets, and team members to unlock compliance monitoring, maintenance tracking, and automated signals.",
} as const;
