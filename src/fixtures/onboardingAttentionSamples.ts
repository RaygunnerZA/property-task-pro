import type { AttentionItem } from "@/components/dashboard/issues/issuesAttentionItem";
import { ONBOARDING_SAMPLE_LABEL } from "@/lib/onboardingEducation";

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
  | "delete-sample"
  | "ignore";

function reviewItem(
  id: string,
  title: string,
  description: string,
  imageUrl: string
): AttentionItem {
  return {
    id: `onboarding:review:${id}`,
    group: "review",
    title,
    context: ONBOARDING_SAMPLE_LABEL,
    description,
    whyHere: "This is sample content so you can see how Filla presents a decision. It is not a real issue on this property.",
    isUiFixture: true,
    isOnboardingExample: true,
    imageUrl,
    fixtureActions: {
      primary: { id: "delete-sample", label: "DELETE THIS" },
    },
  };
}

function recentSignal(
  id: string,
  title: string,
  description: string,
  imageUrl: string,
  kind: AttentionItem["signalKind"] = "ai_suggestion"
): AttentionItem {
  return {
    id: `onboarding:signal:${id}`,
    group: "recent",
    title,
    context: ONBOARDING_SAMPLE_LABEL,
    description,
    signalKind: kind,
    footChipLabel: ONBOARDING_SAMPLE_LABEL,
    recentSubtitle: ONBOARDING_SAMPLE_LABEL,
    isUiFixture: true,
    isOnboardingExample: true,
    imageUrl,
    fixtureActions: {
      primary: { id: "delete-sample", label: "DELETE THIS" },
    },
  };
}

function recordItem(id: string, title: string, category: string, imageUrl: string): AttentionItem {
  return {
    id: `onboarding:record:${id}`,
    group: "review",
    title,
    context: ONBOARDING_SAMPLE_LABEL,
    description: `When you upload a real ${category.toLowerCase()} document, Filla files it here and can watch dates for you. This row is a sample — not a record on this property.`,
    isUiFixture: true,
    isOnboardingExample: true,
    imageUrl,
    fixtureActions: {
      primary: { id: "delete-sample", label: "DELETE THIS" },
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
  action: { id: OnboardingFixtureActionId; label: string },
  description: string
): AttentionItem {
  return {
    id: `onboarding:quick:${id}`,
    group: "recent",
    title,
    context: subtitle,
    description,
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
    "How a certificate review looks",
    "When a certificate is uploaded, Filla holds it here until you confirm it. This is a sample, not a real certificate.",
    "/spaces/mini-cards/first-aid.png"
  ),
  reviewItem(
    "boiler",
    "How upcoming maintenance looks",
    "When a service is due, Filla puts it here so someone can own the work. This is a sample, not a real booking.",
    "/spaces/mini-cards/boiler-room.png"
  ),
  reviewItem(
    "unknown-doc",
    "How an unidentified file looks",
    "If Filla cannot name an upload, it waits here for you to categorise it. This is a sample, not a real file.",
    "/spaces/mini-cards/archive-room.png"
  ),
];

/** Signals — tips that demonstrate AI / environmental value. */
export const ONBOARDING_SIGNALS: AttentionItem[] = [
  recentSignal(
    "electricity",
    "How an energy warning looks",
    "Filla would surface a spike like this so you can check usage. This is a sample, not live meter data.",
    "/spaces/mini-cards/electrical-room.png",
    "ai_warning"
  ),
  recentSignal(
    "rain",
    "How a weather alert looks",
    "Filla would flag heavy rain so you can check roofs and drains. This is a sample, not a real forecast.",
    "/spaces/mini-cards/garden.png",
    "weather"
  ),
  recentSignal(
    "fire-cert",
    "How an expiry warning looks",
    "When a document’s date is close, Filla warns here. This is a sample, not an expiring certificate.",
    "/spaces/mini-cards/first-aid.png",
    "document"
  ),
  recentSignal(
    "warranty",
    "How a linked warranty looks",
    "Filla would attach a found warranty to the asset and ask you to confirm. This is a sample.",
    "/spaces/mini-cards/boiler-room.png",
    "ai_suggestion"
  ),
  recentSignal(
    "multi-review",
    "How a filing backlog looks",
    "Several uploads waiting for confirmation would stack here. This is a sample, not a real backlog.",
    "/spaces/mini-cards/archive-room.png",
    "upload"
  ),
];

/** Records to organise — tips that teach filing. */
export const ONBOARDING_RECORDS: AttentionItem[] = [
  recordItem("insurance", "How an insurance record looks", "Insurance", "/spaces/mini-cards/archive-room.png"),
  recordItem("lighting", "How a compliance report looks", "Compliance", "/spaces/mini-cards/electrical-room.png"),
  recordItem("water", "How a maintenance record looks", "Maintenance", "/spaces/mini-cards/boiler-room.png"),
];

/** Quick wins — real onboarding / setup steps (not generic “Start”). */
export const ONBOARDING_QUICK_WINS: AttentionItem[] = [
  quickWin(
    "profile",
    "Complete Your Property Profile",
    "Nickname, type, and contacts",
    "/spaces/mini-cards/office.png",
    { id: "complete-profile", label: "Complete profile" },
    "Opens Edit property. Save a nickname or photo so this place is easy to recognise."
  ),
  quickWin(
    "asset",
    "Add Your First Asset",
    "Boilers, lifts, vehicles, appliances",
    "/spaces/mini-cards/plant-room.png",
    { id: "create-asset", label: "Create an asset" },
    "Opens Assets so you can add real equipment — not the sample items Filla seeded."
  ),
  quickWin(
    "upload",
    "Upload One Document",
    "Attach a file in Add Record",
    "/spaces/mini-cards/archive-room.png",
    { id: "upload-document", label: "Upload document" },
    "Opens Add Record. Attach the PDF or image there — dropping a file on this card will not upload it."
  ),
  quickWin(
    "task",
    "Create Your First Task",
    "See how Filla organises work",
    "/spaces/mini-cards/kitchen.png",
    { id: "create-task", label: "Create a task" },
    "Opens Report Issue. Write the work and save it — this card only starts the step."
  ),
];

export const ONBOARDING_EDUCATION_SUMMARY = {
  residential:
    "Good start. Filla has created spaces and identified opportunities to improve organisation. Upload a document or create a task to see Filla begin learning about your property.",
  commercial:
    "Your property is set up. Add documents, assets, and team members to unlock compliance monitoring, maintenance tracking, and automated signals.",
} as const;
